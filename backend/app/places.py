"""Tourist attractions and restaurants near a trip's destination, from OpenTripMap.

OpenTripMap (https://dev.opentripmap.org) combines OpenStreetMap, Wikidata and Wikipedia.
Free plan: 5,000 requests a day, 10 a second, non-commercial use; it needs OPENTRIPMAP_API_KEY.

Three calls build a city's list (the API's own field names, from its OpenAPI spec):
  1. GET /places/geoname?name=&country=        -> lat, lon of the city
  2. GET /places/radius?radius=&lon=&lat=&kinds= -> xid, name, kinds, dist, point of nearby places
  3. GET /places/xid/{xid}                      -> wikipedia_extracts.text, preview.source, rate ...

Then one OpenStreetMap request (the Overpass API, free) adds what OpenStreetMap itself has for those
places, opening hours, cuisine and street address, and the named food markets and food courts
around the city ("Taste the destination").

Nothing here invents a value: a field the sources didn't send stays None. A city's result is
kept in the city_places table for PLACES_CACHE_DAYS, so it costs requests once a month.
"""
import logging
import math
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import httpx
from sqlmodel import Session

from app import config
from app.models import CityPlaces
from app.routing import haversine_m
from app.travel_data import AIRPORTS, CITIES, TravelDataError, _request

OTM_URL = "https://api.opentripmap.com/0.1/en/places"
SOURCE = "OpenTripMap (OpenStreetMap, Wikidata, Wikipedia)"
RADIUS_M = 10_000  # around the city centre
MAX_ATTRACTIONS = 12
# Nearby candidates looked up in detail before the best are kept: the radius list is ordered by
# distance, not fame, so the famous places are found among the details (rate, Wikipedia).
MAX_CANDIDATES = 30
MAX_RESTAURANTS = 10
DESCRIPTION_CHARS = 320
MAX_FOOD_SPOTS = 8
# Nature and sightseeing ("Explore" section), searched on their own because the most famous
# places of a city are usually its forts, temples and churches ("History and culture").
SIGHT_KINDS = "natural,view_points,gardens_and_parks,amusements"
MAX_SIGHTS = 6
DETAIL_WORKERS = 5  # OpenTripMap allows 10 requests a second
OVERPASS_TIMEOUT_SECONDS = 60  # the market search can take a while on the public server
# Bump when the cached payload gains fields, so older cached cities are fetched again.
PAYLOAD_VERSION = 2
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OSM_SOURCE = "OpenStreetMap (Overpass API, © OpenStreetMap contributors)"
# Categories shown under "History and culture"; the rest go under "Explore".
HISTORY_CULTURE = {"Fort", "Monument", "Museum", "Historic place", "Religious site", "Architecture", "Culture"}
# Markets that aren't about food (OpenStreetMap tags them all amenity=marketplace).
NOT_FOOD = re.compile(r"jewel|shopping|garment|cloth|textile|electronic|mobile|furniture|\bmall\b|auto|flea|"
                      r"supermarket|hardware|medical|pharma|hostel|\bmess\b|\bworks?\b", re.I)
logger = logging.getLogger(__name__)

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
    ("view_points", "Viewpoint"),
    ("gardens_and_parks", "Park"),
    ("amusements", "Amusement"),
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


# A city found by name further than this from its airport is a namesake elsewhere (Udaipur in
# Tripura for Udaipur airport in Rajasthan); the airport's own location is used instead.
MAX_CITY_FROM_AIRPORT_M = 80_000
USER_AGENT = "AI-Trip-Optimizer/1.0 (https://github.com/bhuvan-somisetty/AI-Trip-Optimizer)"


def city_centre(city: str) -> tuple[float, float]:
    name, country = CITIES[city]
    airport = AIRPORTS.get(city)
    body = _otm("geoname", name=name, country=country)
    found = isinstance(body, dict) and body.get("lat") is not None and body.get("lon") is not None
    if found:
        lat, lon = float(body["lat"]), float(body["lon"])
        if airport is None or haversine_m(lat, lon, airport["latitude"], airport["longitude"]) <= MAX_CITY_FROM_AIRPORT_M:
            return lat, lon
    if airport is not None:
        return near_airport(name, country, airport) or (airport["latitude"], airport["longitude"])
    raise TravelDataError(f"OpenTripMap doesn't know where {name} is")


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_BOX_DEG = 0.7  # about 75 km either side of the airport


def near_airport(name: str, country: str, airport: dict) -> tuple[float, float] | None:
    """The city named `name` within reach of its airport, from OpenStreetMap's geocoder
    (Nominatim: free, no key, one request a second; used only when the name alone found a
    namesake, and the result is cached with the city's places)."""
    lat, lon = airport["latitude"], airport["longitude"]
    box = f"{lon - NOMINATIM_BOX_DEG},{lat + NOMINATIM_BOX_DEG},{lon + NOMINATIM_BOX_DEG},{lat - NOMINATIM_BOX_DEG}"
    try:
        response = httpx.get(
            NOMINATIM_URL,
            params={"q": name, "countrycodes": country.lower(), "viewbox": box, "bounded": 1,
                    "format": "jsonv2", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        rows = response.json() if response.status_code == 200 else []
    except (httpx.HTTPError, ValueError):
        return None
    if not rows:
        return None
    return float(rows[0]["lat"]), float(rows[0]["lon"])


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


def section(category: str | None) -> str:
    return "history_culture" if category in HISTORY_CULTURE else "explore"


def map_url(lat: float | None, lon: float | None) -> str | None:
    if lat is None or lon is None:
        return None
    return f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=17/{lat}/{lon}"


def address_text(address: dict | None) -> str | None:
    """"12 MG Road, Fontainhas, Panaji" from the parts OpenTripMap or OpenStreetMap give."""
    a = address or {}
    street = " ".join(x for x in (a.get("house_number"), a.get("road")) if x)
    parts = [street, a.get("suburb") or a.get("neighbourhood"), a.get("city") or a.get("town") or a.get("village")]
    text = ", ".join(x for x in parts if x)
    return text or None


def place(row: dict, details: dict | None = None) -> dict:
    details = details or {}
    point = details.get("point") or row.get("point") or {}
    text = ((details.get("wikipedia_extracts") or {}).get("text") or "").strip()
    if len(text) > DESCRIPTION_CHARS:
        text = text[:DESCRIPTION_CHARS].rsplit(" ", 1)[0] + "..."
    kind = category(details.get("kinds") or row.get("kinds"))
    return {
        "id": row["xid"],
        "name": details.get("name") or row["name"],
        "category": kind,
        "section": section(kind),
        "description": text or None,
        "image": (details.get("preview") or {}).get("source"),
        "wikipedia": details.get("wikipedia"),
        "rating": details.get("rate"),  # OpenTripMap's own popularity rate: 1 to 3, "h" = heritage
        "rating_label": "OpenTripMap popularity (1 to 3, h = heritage)" if details.get("rate") else None,
        "latitude": point.get("lat"),
        "longitude": point.get("lon"),
        "distance_m": round(row["dist"]) if isinstance(row.get("dist"), (int, float)) else None,
        "address": address_text(details.get("address")),
        "opening_hours": None,  # from OpenStreetMap, filled in by with_osm_tags
        "cuisine": None,
        "map_url": map_url(point.get("lat"), point.get("lon")),
        "osm": details.get("osm") or row.get("osm"),
        "source": SOURCE,
        "data_label": "Map data",
    }


def overpass_query(osm_ids: list[str], lat: float, lon: float) -> str:
    """Tags of our places by their OpenStreetMap ids, then the named markets and food courts."""
    by_type: dict[str, list[str]] = {}
    for ref in osm_ids:
        kind, _, number = (ref or "").partition("/")
        if kind in ("node", "way", "relation") and number.isdigit():
            by_type.setdefault(kind, []).append(number)
    ids = "".join(f"{kind}(id:{','.join(numbers)});" for kind, numbers in by_type.items())
    lookup = f"({ids});out tags;" if ids else ""
    return (f"[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS - 5}];{lookup}"
            f'nwr["amenity"~"^(marketplace|food_court)$"]["name"](around:{RADIUS_M},{lat},{lon});out tags center 40;')


def osm_address(tags: dict) -> str | None:
    return address_text({"house_number": tags.get("addr:housenumber"), "road": tags.get("addr:street"),
                         "suburb": tags.get("addr:suburb"), "city": tags.get("addr:city")})


def osm_details(osm_ids: list[str], lat: float, lon: float) -> tuple[dict[str, dict], list[dict]]:
    """OpenStreetMap tags by "node/123" id, and the food markets around (lat, lon). Empty when
    Overpass is busy or down: these only add detail, so the places are kept without them."""
    try:
        body = _request("Overpass", "POST", OVERPASS_URL, data={"data": overpass_query(osm_ids, lat, lon)},
                        headers={"User-Agent": USER_AGENT}, timeout=OVERPASS_TIMEOUT_SECONDS)
    except TravelDataError as e:
        logger.warning("OpenStreetMap details skipped: %s", e)
        return {}, []
    wanted, tags_by_id, spots, names = set(osm_ids), {}, [], set()
    for element in body.get("elements", []) if isinstance(body, dict) else []:
        ref, tags = f"{element.get('type')}/{element.get('id')}", element.get("tags") or {}
        if ref in wanted:
            tags_by_id[ref] = tags
            continue
        name = (tags.get("name") or "").strip()
        point = element.get("center") or element
        if not name or NOT_FOOD.search(name) or point.get("lat") is None or name.lower() in names:
            continue  # not food, no location, or a second market of the same name
        names.add(name.lower())
        spots.append({
            "id": ref,
            "name": name,
            "category": "Food court" if tags.get("amenity") == "food_court" else "Market",
            "latitude": point["lat"],
            "longitude": point["lon"],
            "distance_m": round(haversine_m(lat, lon, point["lat"], point["lon"])),
            "opening_hours": tags.get("opening_hours"),
            "address": osm_address(tags),
            "map_url": map_url(point["lat"], point["lon"]),
            "image": None,
            "source": OSM_SOURCE,
            "data_label": "Map data",
        })
    spots.sort(key=lambda s: (s["opening_hours"] is None, s["distance_m"]))  # better-mapped first
    return tags_by_id, spots[:MAX_FOOD_SPOTS]


def with_osm_tags(item: dict, tags: dict | None) -> dict:
    """Adds OpenStreetMap's opening hours, cuisine and address, where it has them."""
    if not tags:
        return item
    cuisine = (tags.get("cuisine") or "").replace("_", " ").replace(";", ", ") or None
    return {**item, "opening_hours": tags.get("opening_hours"), "cuisine": cuisine,
            "address": item.get("address") or osm_address(tags)}


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


def best_attractions(candidates: list[dict], limit: int = MAX_ATTRACTIONS) -> list[dict]:
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
        if len(kept) == limit:
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
    known = {r["xid"] for r in rows}
    sights = [r for r in nearby(lat, lon, SIGHT_KINDS, 40) if r["xid"] not in known][: MAX_SIGHTS * 2]

    def detailed(row: dict) -> dict:
        try:
            details = _otm(f"xid/{row['xid']}")
        except TravelDataError:
            details = None  # keep the place with what the list gave
        return place(row, details if isinstance(details, dict) else None)

    with ThreadPoolExecutor(max_workers=DETAIL_WORKERS) as pool:
        candidates = list(pool.map(detailed, rows[:MAX_CANDIDATES] + sights))
    # Up to MAX_ATTRACTIONS history-and-culture places and MAX_SIGHTS nature / sightseeing ones.
    history = best_attractions([c for c in candidates if c["section"] == "history_culture"])
    explore = best_attractions([c for c in candidates if c["section"] == "explore"], MAX_SIGHTS)
    attractions = sorted(history + explore, key=fame)
    restaurants = [place(row) for row in nearby(lat, lon, "foods", 60)[:MAX_RESTAURANTS]]
    tags, food_spots = osm_details([p["osm"] for p in attractions + restaurants if p.get("osm")], lat, lon)
    return {
        "version": PAYLOAD_VERSION,
        "city": city,
        "city_name": CITIES[city][0],
        "centre": {"latitude": lat, "longitude": lon},
        "attractions": [with_osm_tags(p, tags.get(p.get("osm"))) for p in attractions],
        "restaurants": [with_osm_tags(p, tags.get(p.get("osm"))) for p in restaurants],
        "food_spots": food_spots,
        "source": SOURCE,
    }


def _aware(moment: datetime) -> datetime:
    # SQLite hands back naive datetimes; they were saved in UTC.
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def explore_city(session: Session, city: str) -> dict:
    """A city's places from the cache when fresh, otherwise fetched and cached."""
    cached = session.get(CityPlaces, city)
    fresh_after = datetime.now(timezone.utc) - timedelta(days=config.PLACES_CACHE_DAYS)
    if cached is not None and _aware(cached.fetched_at) > fresh_after and cached.payload.get("version") == PAYLOAD_VERSION:
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
