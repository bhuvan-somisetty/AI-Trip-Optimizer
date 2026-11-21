"""Explore a trip's destination: tourist attractions and restaurants (app/places.py).

Kept apart from the optimizer on purpose: places never change a trip's prices, budget checks
or Trade-off Ledger.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.database import get_session
from app.models import Trip
from app.places import PlacesUnavailable, explore_city
from app.routers.trips import get_owned_trip
from app.travel_data import CITIES, TravelDataError

router = APIRouter(tags=["explore"])


@router.get("/trips/{trip_id}/explore")
def explore_trip(trip: Trip = Depends(get_owned_trip), session: Session = Depends(get_session)):
    """Attractions (with a short description and photo when OpenTripMap has one) and restaurants
    near the trip's destination. When places can't be fetched, the lists are empty and `notice`
    says why; nothing is ever made up."""
    city = trip.destination
    empty = {
        "city": city,
        "city_name": CITIES.get(city, (city, ""))[0],
        "attractions": [],
        "restaurants": [],
        "source": None,
        "fetched_at": None,
        "cached": False,
    }
    try:
        return {**explore_city(session, city), "notice": None}
    except PlacesUnavailable as e:
        return {**empty, "notice": str(e)}
    except TravelDataError as e:
        return {**empty, "notice": f"Tourist places couldn't be loaded right now: {e}"}
