"""Direct and connecting journeys, including cheaper routes through another city (app/journeys.py).

GET /journeys searches any route and day; GET /trips/{id}/journeys uses a saved trip's route and
first day. Both need a login, because every leg costs a SerpApi search. Kept apart from the
optimizer: nothing here changes a trip's itinerary, budget check or Trade-off Ledger.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.journeys import DEFAULT_VALUE_OF_TIME, DEFAULT_VIAS, MAX_TRAVELLERS, MAX_VIAS, MODES, find_journeys
from app.models import Trip, User
from app.routers.trips import get_owned_trip
from app.security import get_current_user
from app.travel_data import PLACES, TravelDataError

router = APIRouter(tags=["journeys"])
IST = timezone(timedelta(hours=5, minutes=30))


def parse_modes(modes: str) -> set[str]:
    chosen = {m.strip().lower() for m in modes.split(",") if m.strip()}
    unknown = chosen - set(MODES)
    if not chosen or unknown:
        raise HTTPException(status_code=422, detail=f"modes must be a comma-separated list of {', '.join(MODES)}")
    return chosen


def search(origin: str, destination: str, day: date, modes: str, vias: int, value_of_time: float,
           travellers: int = 1, via_depth: int = 1, return_date: date | None = None, via: str | None = None) -> dict:
    if day < datetime.now(IST).date():
        raise HTTPException(status_code=422, detail="The date is in the past")
    try:
        return find_journeys(code(origin), code(destination), day, parse_modes(modes), vias, value_of_time,
                             travellers, via_depth, return_date, via.split(",") if via else None)
    except TravelDataError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/journeys")
def journeys(
    origin: str = Query(min_length=2, max_length=40, description="Airport code (BBI) or Indian town (mydukuru)"),
    destination: str = Query(min_length=2, max_length=40, description="Airport code (BLR) or Indian town (mydukuru)"),
    date: date = Query(description="Departure day, YYYY-MM-DD"),
    modes: str = Query(",".join(MODES), description="Any of flight, train, bus, ferry, comma-separated"),
    vias: int = Query(DEFAULT_VIAS, ge=0, le=MAX_VIAS, description="Via-cities to try (each costs about two searches)"),
    value_of_time: float = Query(DEFAULT_VALUE_OF_TIME, ge=0, le=5000, description="Rupees an hour of travel is worth"),
    travellers: int = Query(1, ge=1, le=MAX_TRAVELLERS, description="Fares are multiplied by this; no extra searches"),
    via_depth: int = Query(1, ge=1, le=2, description="2 also tries two via-cities in a row (more searches)"),
    return_date: date | None = Query(None, description="Also search the way back on this day (doubles the searches)"),
    via: str | None = Query(None, max_length=40, description="Cities to go through, in order, e.g. GOI,BBI (up to 3); replaces the picked via-cities"),
    user: User = Depends(get_current_user),
):
    """Direct and connecting journeys on real departures, with the cheapest direct, cheapest
    connecting, fastest and best-value picks and why each was picked; the way back under
    "return" when return_date is given."""
    return search(code(origin), code(destination), date, modes, vias, value_of_time, travellers, via_depth, return_date, via)


def code(value: str) -> str:
    """An Indian town's code as given ("mydukuru"), an airport's in capitals ("blr" -> "BLR")."""
    return value if value in PLACES else value.upper()


@router.get("/trips/{trip_id}/journeys")
def trip_journeys(
    modes: str = Query(",".join(MODES)),
    vias: int = Query(DEFAULT_VIAS, ge=0, le=MAX_VIAS),
    value_of_time: float = Query(DEFAULT_VALUE_OF_TIME, ge=0, le=5000),
    travellers: int = Query(1, ge=1, le=MAX_TRAVELLERS),
    via_depth: int = Query(1, ge=1, le=2),
    include_return: bool = Query(False, description="Also search the way back on the trip's last day"),
    via: str | None = Query(None, max_length=40, description="Cities to go through, in order, e.g. GOI,BBI"),
    trip: Trip = Depends(get_owned_trip),
):
    """The same search for a saved trip's route and first day (and last day with include_return)."""
    # A town is searched as itself: by road or rail directly, and by air through its nearest airport.
    return search(trip.origin, trip.destination, trip.start_date, modes, vias,
                  value_of_time, travellers,
                  via_depth, trip.end_date if include_return else None, via)
