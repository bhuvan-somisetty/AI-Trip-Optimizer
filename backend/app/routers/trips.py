import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Itinerary, Traveler, Trip, TripStatus, User
from app.pipeline.graph import pipeline
from app.schemas import TripCreate, TripResponse, TripResultResponse
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
        "itinerary": itinerary,
        "tradeoff_ledger": itinerary.tradeoff_ledger if itinerary else [],
        "reason": trip.failure_reason,
    }


def saved_itinerary(session: Session, trip: Trip) -> Itinerary | None:
    return session.exec(select(Itinerary).where(Itinerary.trip_id == trip.id)).first()


@router.post("/trips/{trip_id}/optimize", response_model=TripResultResponse)
def optimize_trip(trip: Trip = Depends(get_owned_trip), session: Session = Depends(get_session)):
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

    request = {
        "origin": trip.origin,
        "destination": trip.destination,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "budget": float(trip.budget),
        "preferences": trip.preferences,
    }
    try:
        result = pipeline.invoke({"request": request})
    except Exception:
        logger.exception("Pipeline crashed for trip %s", trip.id)
        result = {"failure_reason": "The optimizer hit an unexpected error, please try again"}

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
            hotel=composed["hotel"],
            total_cost=composed["total_cost"],
            within_budget=check["within_budget"],
            flags=check["flags"],
            rationale=composed["rationale"],
            tradeoff_ledger=composed["tradeoff_ledger"],
        )
        session.add(itinerary)
        trip.status = TripStatus.OPTIMIZED
    else:
        trip.status = TripStatus.OPTIMIZATION_FAILED
        trip.failure_reason = result["failure_reason"]

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
