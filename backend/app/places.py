"""Tourist attractions and restaurants near a trip's destination, from OpenTripMap.

OpenTripMap (https://dev.opentripmap.org) combines OpenStreetMap, Wikidata and Wikipedia.
Free plan: 5,000 requests a day, 10 a second, non-commercial use; it needs OPENTRIPMAP_API_KEY.

Three calls build a city's list (the API's own field names, from its OpenAPI spec):
  1. GET /places/geoname?name=&country=        -> lat, lon of the city
  2. GET /places/radius?radius=&lon=&lat=&kinds= -> xid, name, kinds, dist, point of nearby places
  3. GET /places/xid/{xid}                      -> wikipedia_extracts.text, preview.source, rate ...

Nothing here invents a value: a field OpenTripMap didn't send stays None. A city's result is
kept in the city_places table for PLACES_CACHE_DAYS, so it costs requests once a month.
"""
import math
import re
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app import config
from app.models import CityPlaces
from app.travel_data import CITIES, TravelDataError, _request

OTM_URL = "https://api.opentripmap.com/0.1/en/places"
SOURCE = "OpenTripMap (OpenStreetMap, Wikidata, Wikipedia)"
RADIUS_M = 10_000  # around the city centre
MAX_ATTRACTIONS = 12
# Nearby candidates looked up in detail before the best are kept: the radius list is ordered by
# distance, not fame, so the famous places are found among the details (rate, Wikipedia).
MAX_CANDIDATES = 30
MAX_RESTAURANTS = 10
DESCRIPTION_CHARS = 320

# OpenTripMap kinds -> the label shown, most specific first.
CATEGORIES = (
    ("fortifications", "Fort"),
    ("castles", "Fort"),
    ("monuments_and_memorials", "Monument"),
    ("monuments", "Monument"),
    ("museums", "Museum"),
    ("historic", "Historic place"),
    ("religion", "Religious site"),
    ("beaches", "Beach"),
    ("natural", "Nature"),
    ("architecture", "Architecture"),
    ("cultural", "Culture"),
    ("restaurants", "Restaurant"),
    ("cafes", "Cafe"),
    ("fast_food", "Fast food"),
    ("foods", "Food"),
)


class PlacesUnavailable(TravelDataError):
    """No OpenTripMap key on the server, or a destination OpenTripMap can't be asked about."""


def _otm(path: str, **params) -> dict | list:
    return _request("OpenTripMap", "GET", f"{OTM_URL}/{path}", params={**params, "apikey": config.OPENTRIPMAP_API_KEY})


def category(kinds: str | None) -> str | None:
    found = set((kinds or "").split(","))
    return next((label for kind, label in CATEGORIES if kind in found), None)


def city_centre(city: str) -> tuple[float, float]:
    name, country = CITIES[city]
    body = _otm("geoname", name=name, country=country)
    if not isinstance(body, dict) or body.get("lat") is None or body.get("lon") is None:
        raise TravelDataError(f"OpenTripMap doesn't know where {name} is")
    return float(body["lat"]), float(body["lon"])


def nearby(lat: float, lon: float, kinds: str, limit: int, rate: str | None = None) -> list[dict]:
    params = {"radius": RADIUS_M, "lon": lon, "lat": lat, "kinds": kinds, "format": "json", "limit": limit}
    if rate:
        params["rate"] = rate
    rows = _otm("radius", **params)
    named, seen = [], set()
    for row in rows if isinstance(rows, list) else []:
        name = (row.get("name") or "").strip()
        if not name or not row.get("xid") or name.lower() in seen:
            continue  # unnamed map features can't be recommended
        seen.add(name.lower())
        named.append(row)
    return named


def place(row: dict, details: dict | None = None) -> dict:
    details = details or {}
    point = details.get("point") or row.get("point") or {}
    text = ((details.get("wikipedia_extracts") or {}).get("text") or "").strip()
    if len(text) > DESCRIPTION_CHARS:
        text = text[:DESCRIPTION_CHARS].rsplit(" ", 1)[0] + "..."
    return {
        "id": row["xid"],
        "name": details.get("name") or row["name"],
        "category": category(details.get("kinds") or row.get("kinds")),
        "description": text or None,
        "image": (details.get("preview") or {}).get("source"),
        "wikipedia": details.get("wikipedia"),
        "rating": details.get("rate"),  # OpenTripMap's own popularity rate: 1 to 3, "h" = heritage
        "latitude": point.get("lat"),
        "longitude": point.get("lon"),
        "distance_m": round(row["dist"]) if isinstance(row.get("dist"), (int, float)) else None,
        "source": SOURCE,
        "data_label": "Map data",
    }


def fame(item: dict) -> tuple:
    # OpenTripMap's own signals, best first: heritage ("h" in its rate), then a Wikipedia article,
    # then a photo, then the nearest. Nothing is scored by us beyond ordering what it sent.
    rate = str(item.get("rating") or "")
    return ("h" not in rate, not item.get("wikipedia"), not item.get("image"),
            item.get("distance_m") if item.get("distance_m") is not None else 10**9)


def metres_apart(a: dict, b: dict) -> float | None:
    if None in (a.get("latitude"), a.get("longitude"), b.get("latitude"), b.get("longitude")):
        return None
    lat = math.radians((a["latitude"] + b["latitude"]) / 2)
    dx = math.radians(b["longitude"] - a["longitude"]) * math.cos(lat)
    dy = math.radians(b["latitude"] - a["latitude"])
    return 6_371_000 * math.hypot(dx, dy)


def same_site(a: dict, b: dict) -> bool:
    # One site listed twice: "Jantar Mantar, Delhi" and "Jantar Mantar Astronomical Observatory",
    # or "Reis Magos Fort" and "Reis Magos Church" (one complex). Same first two words AND within
    # 500 m, so two different "Our Lady of ..." churches across town both stay.
    words = lambda item: re.findall(r"[a-z0-9]+", item["name"].lower())[:2]
    apart = metres_apart(a, b)
    return words(a) == words(b) and len(words(a)) == 2 and apart is not None and apart <= 500


def best_attractions(candidates: list[dict]) -> list[dict]:
    """The most notable places: closed or uncategorised ones dropped, one site listed twice
    kept once (its better-known entry)."""
    kept: list[dict] = []
    for item in sorted(candidates, key=fame):
        name = item["name"].lower()
        if item["category"] is None or "(closed)" in name:
            continue
        if any(same_site(item, k) for k in kept):
            continue
        kept.append(item)
        if len(kept) == MAX_ATTRACTIONS:
            break
    return kept


def fetch_city(city: str) -> dict:
    """Attractions (with description and photo) and restaurants around a city, fetched live."""
    if not config.OPENTRIPMAP_API_KEY:
        raise PlacesUnavailable("Tourist places aren't set up on the server (no OPENTRIPMAP_API_KEY)")
    if city not in CITIES:
        raise PlacesUnavailable(f"Tourist places don't know the city for airport {city} yet")
    lat, lon = city_centre(city)
    # Heritage sites first (OpenTripMap rate "3h"), then other top-rated places (3), then 2
    # when a city still has few: each list comes nearest-first, so fame is asked for up front.
    rows: list[dict] = []
    for rate in ("3h", "3", "2"):
        if len(rows) >= MAX_CANDIDATES:
            break
        known = {r["xid"] for r in rows}
        rows += [r for r in nearby(lat, lon, "interesting_places", 50, rate=rate) if r["xid"] not in known]
    candidates = []
    for row in rows[:MAX_CANDIDATES]:
        try:
            details = _otm(f"xid/{row['xid']}")
        except TravelDataError:
            details = None  # keep the place with what the list gave
        candidates.append(place(row, details if isinstance(details, dict) else None))
    attractions = best_attractions(candidates)
    restaurants = [place(row) for row in nearby(lat, lon, "foods", 60)[:MAX_RESTAURANTS]]
    return {
        "city": city,
        "city_name": CITIES[city][0],
        "centre": {"latitude": lat, "longitude": lon},
        "attractions": attractions,
        "restaurants": restaurants,
        "source": SOURCE,
    }


def _aware(moment: datetime) -> datetime:
    # SQLite hands back naive datetimes; they were saved in UTC.
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def explore_city(session: Session, city: str) -> dict:
    """A city's places from the cache when fresh, otherwise fetched and cached."""
    cached = session.get(CityPlaces, city)
    fresh_after = datetime.now(timezone.utc) - timedelta(days=config.PLACES_CACHE_DAYS)
    if cached is not None and _aware(cached.fetched_at) > fresh_after:
        return {**cached.payload, "fetched_at": _aware(cached.fetched_at).isoformat(), "cached": True}
    payload = fetch_city(city)
    now = datetime.now(timezone.utc)
    if cached is None:
        cached = CityPlaces(city=city, payload=payload, fetched_at=now)
    else:
        cached.payload, cached.fetched_at = payload, now
    session.add(cached)
    session.commit()
    return {**payload, "fetched_at": now.isoformat(), "cached": False}
