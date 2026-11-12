import re
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Decision, DecisionOutcome, Itinerary, Trip, User, UserRole
from app.schemas import DashboardResponse
from app.security import get_current_user

router = APIRouter(tags=["dashboard"])

PERIOD = re.compile(r"^(?P<year>\d{4})(?:-(?:Q(?P<quarter>[1-4])|(?P<month>0[1-9]|1[0-2])))?$")


def period_bounds(period: str | None) -> tuple[datetime | None, datetime | None]:
    """Turns "2026", "2026-Q4" or "2026-11" into [start, end) in UTC; no period means all time."""
    if period is None:
        return None, None
    match = PERIOD.match(period)
    if match is None:
        raise HTTPException(
            status_code=422,
            detail="period must look like 2026, 2026-Q4 or 2026-11",
        )
    year = int(match["year"])
    if match["quarter"]:
        first_month, months = (int(match["quarter"]) - 1) * 3 + 1, 3
    elif match["month"]:
        first_month, months = int(match["month"]), 1
    else:
        first_month, months = 1, 12
    start = date(year, first_month, 1)
    end_month = first_month + months
    end = date(year + (end_month - 1) // 12, (end_month - 1) % 12 + 1, 1)
    return (
        datetime(start.year, start.month, 1, tzinfo=timezone.utc),
        datetime(end.year, end.month, 1, tzinfo=timezone.utc),
    )


def in_period(moment: datetime, start: datetime | None, end: datetime | None) -> bool:
    if moment.tzinfo is None:  # SQLite hands back naive datetimes; they were saved in UTC
        moment = moment.replace(tzinfo=timezone.utc)
    return (start is None or moment >= start) and (end is None or moment < end)


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    period: str | None = Query(default=None, description="2026, 2026-Q4 or 2026-11; leave out for all time"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """PRD US-010: total spend, average savings and average turnaround for a period.

    A trip counts in the period it was decided in (or created in, for trips_created).
    Admins see the whole team's trips, members their own, the same split as GET /audit.
    Spend and savings come from approved itineraries; turnaround is from the trip being
    created to its decision.
    """
    start, end = period_bounds(period)
    trips = select(Trip)
    if current_user.role != UserRole.admin:
        trips = trips.where(Trip.created_by == current_user.id)
    own = session.exec(trips).all()
    ids = [t.id for t in own]

    decisions = session.exec(select(Decision).where(Decision.trip_id.in_(ids))).all() if ids else []
    latest: dict = {}
    for decision in decisions:
        if decision.trip_id not in latest or decision.decided_at > latest[decision.trip_id].decided_at:
            latest[decision.trip_id] = decision
    decided = {trip_id: d for trip_id, d in latest.items() if in_period(d.decided_at, start, end)}
    approved = [trip_id for trip_id, d in decided.items() if d.outcome == DecisionOutcome.APPROVED]

    itineraries = {
        i.trip_id: i
        for i in (session.exec(select(Itinerary).where(Itinerary.trip_id.in_(approved))).all() if approved else [])
    }
    spend = sum(float(i.total_cost) for i in itineraries.values())
    savings = [float(i.savings) for i in itineraries.values() if i.savings is not None]

    created_at = {t.id: t.created_at for t in own}
    hours = []
    for trip_id, decision in decided.items():
        made, done = created_at[trip_id], decision.decided_at
        if made.tzinfo is None:
            made = made.replace(tzinfo=timezone.utc)
        if done.tzinfo is None:
            done = done.replace(tzinfo=timezone.utc)
        hours.append((done - made).total_seconds() / 3600)

    return DashboardResponse(
        period=period or "all",
        trips_created=sum(in_period(t.created_at, start, end) for t in own),
        trips_decided=len(decided),
        approved=len(approved),
        rejected=len(decided) - len(approved),
        total_spend=round(spend, 2),
        avg_savings=round(sum(savings) / len(savings), 2) if savings else None,
        avg_turnaround_hours=round(sum(hours) / len(hours), 2) if hours else None,
    )
