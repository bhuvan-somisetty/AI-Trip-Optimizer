"""Real photos for every card on a destination page: restaurants from Google Maps, and a photo for
any attraction, day trip or famous stay that came without one.

Restaurants: one Google Maps search (SerpApi's google_maps engine, the same key as flights and
hotels) for restaurants around the city centre gives real places with Google's photo, rating,
review count, type, address and hours. They replace the OpenStreetMap list, which has no photos.

A place without a photo is looked up by its own name at its own map point:

1. Wikimedia Commons: a photo taken within COMMONS_METRES whose file name shares a word with
   the place's name (so a photo of a breakfast plate next door is never shown for a plaza).
2. Google Maps: the place searched by name near its point, used only when Google's result is
   within MAPS_METRES and shares a word of the name.

A place for which neither has a photo is left out of the page instead of showing an empty card.
When a lookup can't be made (no key, an error, or MAX_LOOKUPS reached for this view) the place
is kept as it is. Every answer, found or not, is saved with the city's cached places
(CityPlaces.payload["extras"]), so each city costs these searches once per cache period.
"""
import html
import logging
import re

from sqlmodel import Session

from app import config
from app.models import CityPlaces
from app.routing import haversine_m
from app.travel_data import SERPAPI_URL, TravelDataError, _cached, _request

logger = logging.getLogger(__name__)

COMMONS_URL = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "AI-Trip-Optimizer/1.0 (https://github.com/bhuvan-somisetty/AI-Trip-Optimizer)"
COMMONS_METRES = 400
MAPS_METRES = 1000
PHOTO_WIDTH = 640
MAX_RESTAURANTS = 10
MAX_LOOKUPS = 8  # Google Maps searches per page view for places still without a photo
MAPS_SOURCE = "Google Maps (via SerpApi)"
DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
# Words too common in place names to tell two places apart.
COMMON_WORDS = {
    "beach", "hotel", "view", "point", "viewpoint", "temple", "church", "road", "city", "house", "plaza",
    "india", "resort", "park", "garden", "gardens", "market", "restaurant", "cafe", "the", "and", "with",
    "near", "palace", "museum", "lake", "fort", "falls", "waterfall", "island", "national", "sanctuary",
}


def words(name: str) -> set[str]:
    """The words of a name that can tell two places apart: four letters or more, not too common."""
    found = {w for w in re.findall(r"[a-z0-9]+", (name or "").lower()) if len(w) >= 4}
    return (found - COMMON_WORDS) or found


def same_name(a: str, b: str) -> bool:
    return bool(words(a) & words(b))


def _serpapi(params: dict) -> dict:
    body = _request("SerpApi", "GET", SERPAPI_URL, params={**params, "hl": "en", "gl": "in",
                                                           "api_key": config.SERPAPI_API_KEY})
    return body if isinstance(body, dict) else {}


def _hours(operating: dict | None) -> list[str] | None:
    """Google's {"monday": "12-11 PM", ...} as "Monday: 12-11 PM" lines, Monday first."""
    if not isinstance(operating, dict):
        return None
    lines = [f"{day.title()}: {operating[day]}" for day in DAYS if operating.get(day)]
    return lines or None


def maps_link(place_id: str | None, name: str, lat: float | None, lon: float | None) -> str | None:
    if place_id:
        return f"https://www.google.com/maps/search/?api=1&query={name.replace(' ', '+')}&query_place_id={place_id}"
    if lat is not None and lon is not None:
        return f"https://www.google.com/maps/search/?api=1&query={lat},{lon}"
    return None


def restaurant(row: dict, centre: dict | None) -> dict | None:
    """One Google Maps result in the shape of the page's restaurants; None without a photo or point."""
    gps = row.get("gps_coordinates") or {}
    lat, lon = gps.get("latitude"), gps.get("longitude")
    if not row.get("thumbnail") or lat is None or lon is None or not row.get("title"):
        return None
    distance = None
    if centre and centre.get("latitude") is not None:
        distance = round(haversine_m(centre["latitude"], centre["longitude"], lat, lon))
    link = maps_link(row.get("place_id"), row["title"], lat, lon)
    return {
        "id": f"gmaps:{row.get('place_id') or row.get('data_id') or row['title']}",
        "name": row["title"],
        "category": row.get("type") or "Restaurant",
        "section": "food",
        "description": row.get("description"),
        "image": row["thumbnail"],
        "image_label": "Photo: Google Maps",
        "wikipedia": None,
        "rating": None,  # OpenTripMap's popularity field; Google's rating is under "google"
        "rating_label": None,
        "latitude": lat,
        "longitude": lon,
        "distance_m": distance,
        "address": row.get("address"),
        "opening_hours": None,
        "cuisine": None,
        "map_url": link,
        "osm": None,
        "source": MAPS_SOURCE,
        "data_label": "Google Maps",
        "google": {
            "rating": row.get("rating"),
            "rating_count": row.get("reviews"),
            "address": row.get("address"),
            "opening_hours": _hours(row.get("operating_hours")),
            "type": row.get("type"),
            "maps_url": link,
            "source": MAPS_SOURCE,
            "data_label": "Live",
        },
    }


def maps_restaurants(label: str, centre: dict) -> list[dict]:
    """Restaurants around the city centre from one Google Maps search, each with Google's photo."""
    body = _cached(("maps-restaurants", label), lambda: _serpapi({
        "engine": "google_maps", "type": "search", "q": f"restaurants in {label}",
        "ll": f"@{centre['latitude']},{centre['longitude']},14z",
    }))
    rows = [restaurant(r, centre) for r in body.get("local_results") or []]
    return [r for r in rows if r][:MAX_RESTAURANTS]


def _commons_photo(name: str, lat: float, lon: float) -> dict | None:
    body = _cached(("commons", round(lat, 4), round(lon, 4)), lambda: _request("Wikimedia Commons", "GET", COMMONS_URL, params={
        "action": "query", "format": "json", "generator": "geosearch", "ggscoord": f"{lat}|{lon}",
        "ggsradius": COMMONS_METRES, "ggslimit": 20, "ggsnamespace": 6, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": PHOTO_WIDTH,
    }, headers={"User-Agent": USER_AGENT}))
    pages = sorted(((body or {}).get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    for page in pages:
        title = re.sub(r"^File:|\.\w+$", "", page.get("title", ""))
        info = (page.get("imageinfo") or [{}])[0]
        url = info.get("thumburl") or info.get("url")
        if not url or not re.search(r"\.(jpe?g|png|webp)$", info.get("url", ""), re.I) or not same_name(name, title):
            continue
        artist = ((info.get("extmetadata") or {}).get("Artist") or {}).get("value") or ""
        author = html.unescape(re.sub(r"<[^>]+>", "", artist)).strip() or None
        return {"image": url, "image_label": "Photo: Wikimedia Commons",
                "photo_attribution": {"author": author, "author_url": info.get("descriptionurl")}}
    return None


def _maps_photo(name: str, lat: float, lon: float) -> dict | None:
    body = _cached(("maps-photo", name, round(lat, 4), round(lon, 4)), lambda: _serpapi({
        "engine": "google_maps", "type": "search", "q": name, "ll": f"@{lat},{lon},16z",
    }))
    found = [body["place_results"]] if isinstance(body.get("place_results"), dict) else body.get("local_results") or []
    for row in found[:5]:
        gps = row.get("gps_coordinates") or {}
        if not row.get("thumbnail") or gps.get("latitude") is None:
            continue
        if haversine_m(lat, lon, gps["latitude"], gps["longitude"]) <= MAPS_METRES and same_name(name, row.get("title", "")):
            return {"image": row["thumbnail"], "image_label": "Photo: Google Maps", "photo_attribution": None}
    return None


def _key(item: dict) -> str:
    return f"{item.get('name')}|{round(item['latitude'], 4)}|{round(item['longitude'], 4)}"


def with_photos(items: list[dict], known: dict, budget: list[int]) -> list[dict]:
    """`items` with a photo filled in where one is found; places that have none anywhere are left out.

    `known` holds earlier answers by place ("" = none found) and is updated; `budget` is the Google
    Maps searches still allowed for this view, shared across lists."""
    out = []
    for item in items:
        if item.get("image") or item.get("latitude") is None:
            out.append(item)
            continue
        key = _key(item)
        if key not in known:
            try:
                photo = _commons_photo(item["name"], item["latitude"], item["longitude"])
                if photo is None and config.SERPAPI_API_KEY and budget[0] > 0:
                    budget[0] -= 1
                    photo = _maps_photo(item["name"], item["latitude"], item["longitude"])
                elif photo is None:
                    out.append(item)  # Google Maps couldn't be asked this time: keep the place
                    continue
            except TravelDataError as e:
                logger.warning("Photo lookup skipped for %s: %s", item.get("name"), e)
                out.append(item)
                continue
            known[key] = photo or ""
        if known[key]:
            out.append({**item, **known[key]})
    return out


def apply(session: Session, city: str, label: str, result: dict) -> dict:
    """The destination view with Google Maps restaurants and a photo on every place card.

    Answers are kept in the city's cached places, so a second view makes no new searches."""
    row = session.get(CityPlaces, city)
    extras = dict((row.payload or {}).get("extras") or {}) if row else {}
    known = dict(extras.get("photos") or {})
    changed = False
    out = dict(result)
    centre = result.get("centre")
    if config.SERPAPI_API_KEY and centre and not any(r.get("image") for r in result.get("restaurants") or []):
        if "restaurants" not in extras:
            try:
                extras["restaurants"] = maps_restaurants(label, centre)
                changed = True
            except TravelDataError as e:
                logger.warning("Google Maps restaurants skipped for %s: %s", city, e)
        if extras.get("restaurants"):
            out["restaurants"] = extras["restaurants"]
    budget = [MAX_LOOKUPS]
    before = len(known)
    for field in ("attractions", "day_trips", "famous_stays"):
        out[field] = with_photos(result.get(field) or [], known, budget)
    if len(known) != before:
        extras["photos"], changed = known, True
    if changed and row is not None:
        row.payload = {**row.payload, "extras": extras}
        session.add(row)
        session.commit()
    return out
