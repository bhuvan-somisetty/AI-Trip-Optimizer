"""Destination pages and places near the traveller, without a saved trip.

GET /destinations/{code}  everything about a city: a Wikipedia overview, attractions in their
                          "explore" and "history_culture" sections, restaurants, food markets
                          and dishes (the same data as a trip's Explore tab).
GET /places/nearby        attractions and restaurants around a point, e.g. the browser's location
                          once the user has allowed it. The point is sent to OpenTripMap only.

Both need a login: they spend OpenTripMap requests and, for dishes, the AI model.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app import config, dishes, places
from app.database import get_session
from app.models import User
from app.routers.explore import destination_view
from app.security import get_current_user
from app.travel_data import PLACES, TravelDataError, _cached, country_name

router = APIRouter(tags=["discover"])

NEARBY_ATTRACTIONS = 8
NEARBY_RESTAURANTS = 8
OVERVIEW_CHARS = 600


def city_overview(city: str, country: str) -> dict | None:
    """The city's Wikipedia summary: its own page, or the first search result naming the city."""
    def fetch():
        body = dishes._summary(city)
        if body is None:
            found = dishes._get(dishes.WIKIPEDIA_SEARCH, q=f"{city} {country}", limit=3) or {}
            title = next((p["title"] for p in found.get("pages") or [] if city.lower() in (p.get("title") or "").lower()), None)
            body = dishes._summary(title) if title else None
        if body is None:
            return {}
        text = (body.get("extract") or "").strip()
        if len(text) > OVERVIEW_CHARS:
            text = text[:OVERVIEW_CHARS].rsplit(" ", 1)[0] + "..."
        return {
            "title": body.get("title"),
            "text": text or None,
            "image": (body.get("thumbnail") or {}).get("source"),
            "wikipedia": ((body.get("content_urls") or {}).get("desktop") or {}).get("page"),
            "source": "Wikipedia",
            "image_label": "Photo: Wikipedia" if body.get("thumbnail") else None,
        }
    return _cached(("city_overview", city, country), fetch) or None


@router.get("/destinations/{code}")
def destination(code: str, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """A destination page for any airport city or Indian town: overview, places by section, food."""
    airport = PLACES.get(code) or PLACES.get(code.upper())
    if airport is None:
        raise HTTPException(status_code=404, detail="Unknown place")
    view = destination_view(session, airport["code"])
    country = country_name(airport["country"])
    return {
        **view,
        "country": airport["country"],
        "country_name": country,
        "location": {"latitude": airport["latitude"], "longitude": airport["longitude"]},
        "overview": city_overview(airport["city"], country),
    }


@router.get("/places/nearby")
def nearby_places(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    radius_m: int = Query(3000, ge=500, le=10_000),
    user: User = Depends(get_current_user),
):
    """Attractions (with photo and description when OpenTripMap has them) and restaurants within
    `radius_m` of a point, nearest-first within their fame order. Cached by ~100 m."""
    if not config.OPENTRIPMAP_API_KEY:
        return {"attractions": [], "restaurants": [], "notice": "Tourist places aren't set up on the server (no OPENTRIPMAP_API_KEY)"}
    key = ("nearby", round(lat, 3), round(lon, 3), radius_m)

    def fetch():
        def around(kinds: str, limit: int, rate: str | None = None) -> list[dict]:
            params = {"radius": radius_m, "lon": lon, "lat": lat, "kinds": kinds, "format": "json", "limit": limit}
            if rate:
                params["rate"] = rate
            rows = places._otm("radius", **params)
            return [r for r in rows if isinstance(rows, list) and (r.get("name") or "").strip() and r.get("xid")]

        candidates = []
        for row in around("interesting_places", 20, rate="2")[: NEARBY_ATTRACTIONS * 2]:
            try:
                details = places._otm(f"xid/{row['xid']}")
            except TravelDataError:
                details = None
            candidates.append(places.place(row, details if isinstance(details, dict) else None))
        attractions = places.best_attractions(candidates)[:NEARBY_ATTRACTIONS]
        restaurants = [places.place(r) for r in around("foods", 30)[:NEARBY_RESTAURANTS]]
        return {"attractions": attractions, "restaurants": restaurants}

    try:
        found = _cached(key, fetch)
    except TravelDataError as e:
        return {"attractions": [], "restaurants": [], "notice": f"Nearby places couldn't be loaded right now: {e}"}
    return {**found, "centre": {"latitude": lat, "longitude": lon}, "radius_m": radius_m,
            "source": places.SOURCE, "notice": None if found["attractions"] or found["restaurants"] else "No places found nearby"}
