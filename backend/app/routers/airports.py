"""Airport search for the trip form: GET /airports?q=.

Every airport with scheduled flights (about 4,000, from OurAirports), so a trip can go to any
of them instead of a fixed list. Public reference data: no login needed.
"""
from fastapi import APIRouter, HTTPException, Query

from app.access import plan as access_plan
from app.travel_data import AIRPORTS, PLACES, country_name, search_airports, search_places

router = APIRouter(tags=["airports"])


@router.get("/airports")
def airports(q: str = Query(min_length=1, max_length=60), limit: int = Query(10, ge=1, le=50)):
    """Matching airports, best first: code, city, airport name, country name."""
    return {"airports": search_airports(q, limit), "source": "OurAirports (public domain)"}


@router.get("/locations")
def locations(
    q: str = Query(min_length=1, max_length=60),
    mode: str = Query("all", pattern="^(flight|train|bus|all)$"),
    limit: int = Query(10, ge=1, le=50),
):
    """Trip ends for the way of travel: airports (flight), places with a railway station (train)
    or a bus station (bus), or every Indian city and town plus airports abroad (all). Each Indian
    place lists its nearest airport, railway station and bus station with their distances."""
    return {"locations": search_places(q, mode, limit),
            "source": "OpenStreetMap contributors (ODbL); airports: OurAirports (public domain)"}


@router.get("/access")
def access(origin: str = Query(min_length=2, max_length=40), destination: str = Query(min_length=2, max_length=40)):
    """Door-to-door routes for each way of travel: fly to the nearest airport then bus or cab, train to
    a nearby station then bus or cab, or a bus to the town's bus stand. From the bundled place data,
    so it is instant; live times and fares are searched per leg elsewhere."""
    codes = []
    for code in (origin, destination):
        found = code if code in PLACES else code.upper() if code.upper() in PLACES else None
        if found is None:
            raise HTTPException(status_code=404, detail=f"Unknown place {code!r}")
        codes.append(found)
    if codes[0] == codes[1]:
        raise HTTPException(status_code=422, detail="Origin and destination must be different")
    return access_plan(*codes)


@router.get("/locations/{code}")
def location(code: str):
    """One trip end by its code: an airport ("BLR") or an Indian place ("ayodhya"), or 404."""
    found = PLACES.get(code) or PLACES.get(code.upper())
    if found is None:
        raise HTTPException(status_code=404, detail="Unknown place")
    return {**found, "country_name": country_name(found["country"])}


@router.get("/airports/{code}")
def airport(code: str):
    """One airport by its IATA code, or 404."""
    found = AIRPORTS.get(code.upper())
    if found is None:
        raise HTTPException(status_code=404, detail="Unknown airport code")
    return {**found, "country_name": country_name(found["country"])}
