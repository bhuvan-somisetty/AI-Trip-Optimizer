"""Airport search for the trip form: GET /airports?q=.

Every airport with scheduled flights (about 4,000, from OurAirports), so a trip can go to any
of them instead of a fixed list. Public reference data: no login needed.
"""
from fastapi import APIRouter, HTTPException, Query

from app.travel_data import AIRPORTS, country_name, search_airports

router = APIRouter(tags=["airports"])


@router.get("/airports")
def airports(q: str = Query(min_length=1, max_length=60), limit: int = Query(10, ge=1, le=50)):
    """Matching airports, best first: code, city, airport name, country name."""
    return {"airports": search_airports(q, limit), "source": "OurAirports (public domain)"}


@router.get("/airports/{code}")
def airport(code: str):
    """One airport by its IATA code, or 404."""
    found = AIRPORTS.get(code.upper())
    if found is None:
        raise HTTPException(status_code=404, detail="Unknown airport code")
    return {**found, "country_name": country_name(found["country"])}
