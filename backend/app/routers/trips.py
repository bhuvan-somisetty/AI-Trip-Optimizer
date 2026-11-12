import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.audit import record
from app.database import get_session
from app.models import AuditEventType, Decision, DecisionOutcome, Itinerary, Traveler, Trip, TripStatus, User
from app.pipeline.graph import EditRefused, edit_itinerary, pipeline, rerun
from app.schemas import (
    DecisionCreate,
    DecisionResponse,
    ItineraryEdit,
    TripCreate,
    TripResponse,
    TripResultResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from app.security import get_current_user

router = APIRouter(tags=["trips"])
logger = logging.getLogger(__name__)

# Once a trip is under review or decided, its itinerary is the record and can't be re-run.
OPTIMIZABLE = {TripStatus.DRAFT, TripStatus.OPTIMIZED, TripStatus.OPTIMIZATION_FAILED}


def get_owned_trip(
    trip_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Trip:
    """Load a trip the current user created, or 404.

    Someone else's trip returns the same 404 as a missing one, so the API doesn't
    reveal which trip IDs exist. Reuse this dependency on every /trips/{trip_id}/... route.
    """
    trip = session.get(Trip, trip_id)
    if trip is None or trip.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return trip


@router.post("/trip", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip(
    body: TripCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    traveler = session.get(Traveler, body.traveler_id)
    if traveler is None or traveler.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Traveler not found")

    trip = Trip(
        traveler_id=body.traveler_id,
        origin=body.origin,
        destination=body.destination,
        start_date=body.dates[0],
        end_date=body.dates[1],
        budget=body.budget,
        preferences=body.preferences,
        created_by=current_user.id,
    )
    session.add(trip)
    # Insert the trip first: the event references it, and the flush doesn't order the two.
    session.flush()
    record(
        session, user=current_user, event_type=AuditEventType.TRIP_CREATED, trip_id=trip.id,
        summary=f"Created trip {trip.origin}→{trip.destination} for {traveler.name}, budget {trip.budget:,.0f}",
        payload={"traveler_id": traveler.id, "origin": trip.origin, "destination": trip.destination,
                 "dates": [trip.start_date, trip.end_date], "budget": trip.budget,
                 "preferences": trip.preferences},
    )
    session.commit()
    session.refresh(trip)
    return trip


@router.get("/trips", response_model=list[TripResponse])
def list_trips(
    trip_status: TripStatus | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Trip).where(Trip.created_by == current_user.id)
    if trip_status is not None:
        query = query.where(Trip.status == trip_status)
    return session.exec(query.order_by(Trip.created_at.desc())).all()


@router.get("/trips/{trip_id}", response_model=TripResponse)
def get_trip(trip: Trip = Depends(get_owned_trip)):
    return trip


def trip_result(trip: Trip, itinerary: Itinerary | None) -> dict:
    return {
        "status": trip.status,
        "itinerary": None
        if itinerary is None
        else {
            "flight": itinerary.flight,
            "return_flight": itinerary.return_flight,
            "hotel": itinerary.hotel,
            "total_cost": itinerary.total_cost,
            "savings": itinerary.savings,
            "within_budget": itinerary.within_budget,
            "flags": itinerary.flags,
            "rationale": itinerary.rationale,
            "picked": itinerary.picked or [],
            "editable": itinerary.search_results is not None,
        },
        "tradeoff_ledger": itinerary.tradeoff_ledger if itinerary else [],
        "reason": trip.failure_reason,
    }


def saved_itinerary(session: Session, trip: Trip) -> Itinerary | None:
    return session.exec(select(Itinerary).where(Itinerary.trip_id == trip.id)).first()


def trip_request(trip: Trip) -> dict:
    return {
        "origin": trip.origin,
        "destination": trip.destination,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "budget": float(trip.budget),
        "preferences": trip.preferences,
    }


def search_results(result: dict) -> dict:
    # What an itinerary keeps of a run's search, so edits and previews never search again.
    return {
        "flight_options": result.get("flight_options", []),
        "return_options": result.get("return_options", []),
        "hotel_options": result.get("hotel_options", []),
        "hotels_unavailable": result.get("hotels_unavailable"),
        "return_unavailable": result.get("return_unavailable"),
    }


def saved_state(request: dict, found: dict) -> dict:
    """A pipeline state rebuilt from an itinerary's saved search results."""
    state = {"request": request, "flight_options": found["flight_options"], "hotel_options": found["hotel_options"]}
    # Itineraries saved before return flights were searched have no return_options at all.
    if "return_options" in found:
        state["return_options"] = found["return_options"]
    for key in ("hotels_unavailable", "return_unavailable"):
        if found.get(key):
            state[key] = found[key]
    return state


def changeable_itinerary(session: Session, trip: Trip, action: str) -> Itinerary:
    """The trip's itinerary when its status and saved search results allow `action`, else 409."""
    if trip.status not in {TripStatus.OPTIMIZED, TripStatus.UNDER_REVIEW}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Trip is {trip.status.value}; only OPTIMIZED or UNDER_REVIEW itineraries can be {action}",
        )
    itinerary = saved_itinerary(session, trip)
    if itinerary is None or itinerary.search_results is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This itinerary was saved before it could be {action}; optimize the trip again first",
        )
    return itinerary


def option_summary(option: dict | None) -> dict | None:
    # What the audit keeps about a chosen flight/hotel: enough to trace it back to its source.
    if option is None:
        return None
    keys = ("id", "airline", "flight_number", "name", "price", "price_per_night", "rating", "price_status", "source")
    return {k: option[k] for k in keys if k in option}


@router.post("/trips/{trip_id}/optimize", response_model=TripResultResponse)
def optimize_trip(
    trip: Trip = Depends(get_owned_trip),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if trip.status not in OPTIMIZABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Trip is {trip.status.value}; only DRAFT, OPTIMIZED or OPTIMIZATION_FAILED trips can be optimized",
        )

    # Committed before the pipeline runs, so a second click sees OPTIMIZING and gets 409.
    trip.status = TripStatus.OPTIMIZING
    trip.failure_reason = None
    session.add(trip)
    session.commit()

    request = trip_request(trip)
    started = time.monotonic()
    try:
        result = pipeline.invoke({"request": request})
    except Exception:
        logger.exception("Pipeline crashed for trip %s", trip.id)
        result = {"failure_reason": "The optimizer hit an unexpected error, please try again"}

    run_ms = round((time.monotonic() - started) * 1000)

    old = saved_itinerary(session, trip)
    if old is not None:
        session.delete(old)
        session.flush()

    itinerary = None
    if "itinerary" in result:
        composed, check = result["itinerary"], result["check"]
        itinerary = Itinerary(
            trip_id=trip.id,
            flight=composed["flight"],
            return_flight=composed["return_flight"],
            hotel=composed["hotel"],
            total_cost=composed["total_cost"],
            savings=composed["savings"],
            within_budget=check["within_budget"],
            flags=check["flags"],
            rationale=composed["rationale"],
            tradeoff_ledger=composed["tradeoff_ledger"],
            search_results=search_results(result),
        )
        session.add(itinerary)
        trip.status = TripStatus.OPTIMIZED
        record(
            session, user=current_user, event_type=AuditEventType.PIPELINE_RUN, trip_id=trip.id,
            summary=(
                f"Optimized {trip.origin}→{trip.destination}: total {float(itinerary.total_cost):,.0f}, "
                f"{'within' if itinerary.within_budget else 'over'} budget {trip.budget:,.0f}"
            ),
            # Every pipeline run is kept here even after a re-run replaces the itinerary.
            payload={
                "request": request,
                "flight": option_summary(itinerary.flight),
                "return_flight": option_summary(itinerary.return_flight),
                "hotel": option_summary(itinerary.hotel),
                "total_cost": itinerary.total_cost,
                "savings": itinerary.savings,
                "within_budget": itinerary.within_budget,
                "flags": itinerary.flags,
                "options_compared": len(itinerary.tradeoff_ledger),
                "rationale": itinerary.rationale,
                "run_ms": run_ms,
            },
        )
    else:
        trip.status = TripStatus.OPTIMIZATION_FAILED
        trip.failure_reason = result["failure_reason"]
        record(
            session, user=current_user, event_type=AuditEventType.PIPELINE_FAILED, trip_id=trip.id,
            summary=f"Optimization failed for {trip.origin}→{trip.destination}: {trip.failure_reason}",
            payload={"request": request, "failure_reason": trip.failure_reason, "run_ms": run_ms},
        )

    session.add(trip)
    session.commit()
    if itinerary is not None:
        session.refresh(itinerary)
    return trip_result(trip, itinerary)


@router.get("/trips/{trip_id}/itinerary", response_model=TripResultResponse)
def get_itinerary(trip: Trip = Depends(get_owned_trip), session: Session = Depends(get_session)):
    itinerary = saved_itinerary(session, trip)
    if itinerary is None and trip.failure_reason is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip has not been optimized yet")
    return trip_result(trip, itinerary)


@router.post("/trips/{trip_id}/review", response_model=TripResponse)
def start_review(
    trip: Trip = Depends(get_owned_trip),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if trip.status != TripStatus.OPTIMIZED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Trip is {trip.status.value}; only OPTIMIZED trips can be moved to review",
        )
    trip.status = TripStatus.UNDER_REVIEW
    session.add(trip)
    record(
        session, user=current_user, event_type=AuditEventType.REVIEW_STARTED, trip_id=trip.id,
        summary=f"Started review of {trip.origin}→{trip.destination}",
    )
    session.commit()
    session.refresh(trip)
    return trip


@router.patch("/trips/{trip_id}/itinerary", response_model=TripResultResponse)
def edit_trip_itinerary(
    body: ItineraryEdit,
    trip: Trip = Depends(get_owned_trip),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """PRD US-007: swap one line item for another option; totals and flags are recalculated."""
    itinerary = changeable_itinerary(session, trip, "edited")
    state = saved_state(trip_request(trip), itinerary.search_results)
    before = float(itinerary.total_cost)
    current = {"flight": itinerary.flight, "return_flight": itinerary.return_flight, "hotel": itinerary.hotel}
    try:
        edited = edit_itinerary(state, current, body.kind, body.option_id, itinerary.picked or [])
    except EditRefused as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    itinerary.flight = edited["flight"]
    itinerary.return_flight = edited["return_flight"]
    itinerary.hotel = edited["hotel"]
    itinerary.total_cost = edited["total_cost"]
    itinerary.savings = edited["savings"]
    itinerary.within_budget = edited["within_budget"]
    itinerary.flags = edited["flags"]
    itinerary.rationale = edited["rationale"]
    itinerary.tradeoff_ledger = edited["tradeoff_ledger"]
    itinerary.picked = edited["picked"]
    trip.status = TripStatus.UNDER_REVIEW
    session.add(itinerary)
    session.add(trip)
    item = {"flight": "flight", "return": "return flight", "stay": "hotel"}[body.kind]
    record(
        session, user=current_user, event_type=AuditEventType.ITINERARY_EDITED, trip_id=trip.id,
        summary=f"Swapped {item} to {body.option_id}; total {before:,.0f} -> {edited['total_cost']:,.0f}",
        payload={"kind": body.kind, "option_id": body.option_id, "before": before, "after": edited["total_cost"]},
    )
    session.commit()
    session.refresh(itinerary)
    return trip_result(trip, itinerary)


# ---- What-If Simulator (PRD US-011) -----------------------------------------

PREFERENCES = ("cabin_class", "max_stops", "min_hotel_rating")


def changed_request(trip: Trip, body: WhatIfRequest) -> tuple[dict, list[dict]]:
    """The trip's request with the What-If changes applied, and the inputs that changed."""
    request = trip_request(trip)
    preferences = dict(trip.preferences)
    inputs = []
    if "budget" in body.model_fields_set and float(body.budget) != request["budget"]:
        inputs.append({"field": "budget", "before": request["budget"], "after": float(body.budget)})
        request["budget"] = float(body.budget)
    for key in PREFERENCES:
        if key not in body.model_fields_set:
            continue
        before, after = preferences.get(key), getattr(body, key)
        if before == after:
            continue
        inputs.append({"field": key, "before": before, "after": after})
        if after is None:
            preferences.pop(key, None)
        else:
            preferences[key] = after
    if not inputs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to preview: every input already has that value",
        )
    request["preferences"] = preferences
    return request, inputs


def option_id(option: dict | None) -> str | None:
    return option["id"] if option else None


def itinerary_diff(itinerary: Itinerary, result: dict) -> list[dict]:
    """What changes in the itinerary between the saved one and a rerun's result."""
    after = result.get("itinerary")
    check = result["check"]
    rows = [
        ("flight", option_id(itinerary.flight), option_id(after["flight"]) if after else None),
        ("return_flight", option_id(itinerary.return_flight), option_id(after["return_flight"]) if after else None),
        ("hotel", option_id(itinerary.hotel), option_id(after["hotel"]) if after else None),
        ("total_cost", float(itinerary.total_cost), after["total_cost"] if after else None),
        ("within_budget", itinerary.within_budget, check["within_budget"] if after else None),
        ("savings", None if itinerary.savings is None else float(itinerary.savings), after["savings"] if after else None),
        ("flags", len(itinerary.flags), len(check["flags"])),
    ]
    return [{"field": field, "before": before, "after": now} for field, before, now in rows if before != now]


def preview_result(result: dict) -> dict:
    after = result.get("itinerary")
    return {
        "status": TripStatus.OPTIMIZED if after else TripStatus.OPTIMIZATION_FAILED,
        "itinerary": None if after is None else {
            **{k: after[k] for k in ("flight", "return_flight", "hotel", "total_cost", "savings", "rationale")},
            "within_budget": result["check"]["within_budget"],
            "flags": result["check"]["flags"],
            "picked": [],
            "editable": True,
        },
        "tradeoff_ledger": after["tradeoff_ledger"] if after else [],
        "reason": result.get("failure_reason"),
    }


@router.post("/trips/{trip_id}/preview", response_model=WhatIfResponse)
def preview_trip(
    body: WhatIfRequest,
    trip: Trip = Depends(get_owned_trip),
    session: Session = Depends(get_session),
):
    """PRD US-011: reruns the optimizer on the trip's saved search results with changed inputs.

    Nothing is saved and nothing is searched again, so a preview is instant and compares like
    with like. The rationale is the template one; applying the preview writes the real one.
    """
    itinerary = changeable_itinerary(session, trip, "previewed")
    request, inputs = changed_request(trip, body)
    result = rerun(saved_state(request, itinerary.search_results), use_llm=False)
    return {"inputs": inputs, "preview": preview_result(result), "diff": itinerary_diff(itinerary, result)}


@router.post("/trips/{trip_id}/preview/apply", response_model=TripResultResponse)
def apply_preview(
    body: WhatIfRequest,
    trip: Trip = Depends(get_owned_trip),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """PRD US-011: saves a preview: the trip's inputs change and its itinerary is rebuilt.

    The optimizer picks every line item again under the new inputs, so earlier hand-picked
    edits are dropped. A change that can't build an itinerary is refused and saves nothing.
    """
    itinerary = changeable_itinerary(session, trip, "previewed")
    request, inputs = changed_request(trip, body)
    result = rerun(saved_state(request, itinerary.search_results))
    if "itinerary" not in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This change can't build an itinerary, so nothing was saved: {result['failure_reason']}",
        )
    before = float(itinerary.total_cost)
    diff = itinerary_diff(itinerary, result)
    composed = result["itinerary"]
    trip.budget = request["budget"]
    trip.preferences = request["preferences"]
    itinerary.flight = composed["flight"]
    itinerary.return_flight = composed["return_flight"]
    itinerary.hotel = composed["hotel"]
    itinerary.total_cost = composed["total_cost"]
    itinerary.savings = composed["savings"]
    itinerary.within_budget = result["check"]["within_budget"]
    itinerary.flags = result["check"]["flags"]
    itinerary.rationale = composed["rationale"]
    itinerary.tradeoff_ledger = composed["tradeoff_ledger"]
    itinerary.picked = []
    trip.status = TripStatus.UNDER_REVIEW
    session.add(itinerary)
    session.add(trip)
    changed = ", ".join(f"{i['field']} {i['before']} -> {i['after']}" for i in inputs)
    record(
        session, user=current_user, event_type=AuditEventType.ITINERARY_EDITED, trip_id=trip.id,
        summary=f"Applied what-if ({changed}); total {before:,.0f} -> {composed['total_cost']:,.0f}",
        payload={"what_if": True, "inputs": inputs, "diff": diff, "before": before, "after": composed["total_cost"]},
    )
    session.commit()
    session.refresh(itinerary)
    return trip_result(trip, itinerary)


@router.post("/trips/{trip_id}/decision", response_model=DecisionResponse)
def decide_trip(
    body: DecisionCreate,
    trip: Trip = Depends(get_owned_trip),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if trip.status not in {TripStatus.OPTIMIZED, TripStatus.UNDER_REVIEW}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Trip is {trip.status.value}; only OPTIMIZED or UNDER_REVIEW trips can be decided",
        )
    if body.outcome == DecisionOutcome.REJECTED and body.reason is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="reason is required when outcome is REJECTED"
        )

    decision = Decision(trip_id=trip.id, decided_by=current_user.id, outcome=body.outcome, reason=body.reason)
    trip.status = TripStatus.DECIDED
    session.add(decision)
    session.add(trip)
    itinerary = saved_itinerary(session, trip)
    record(
        session, user=current_user, event_type=AuditEventType.DECISION, trip_id=trip.id,
        summary=(
            f"{body.outcome.value.capitalize()} {trip.origin}→{trip.destination}"
            + (f": {body.reason}" if body.reason else "")
        ),
        payload={
            "decision_id": decision.id,
            "outcome": body.outcome,
            "reason": body.reason,
            # The itinerary as it stood when decided, in case it's ever edited later.
            "total_cost": itinerary.total_cost if itinerary else None,
            "flight": option_summary(itinerary.flight) if itinerary else None,
            "hotel": option_summary(itinerary.hotel) if itinerary else None,
        },
    )
    session.commit()
    session.refresh(decision)
    return decision


@router.get("/trips/{trip_id}/decision", response_model=DecisionResponse)
def get_decision(trip: Trip = Depends(get_owned_trip), session: Session = Depends(get_session)):
    decision = session.exec(
        select(Decision).where(Decision.trip_id == trip.id).order_by(Decision.decided_at.desc())
    ).first()
    if decision is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip has not been decided yet")
    return decision
