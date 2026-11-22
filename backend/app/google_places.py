"""Optional restaurant photos, ratings and opening hours from Google Places (New).

Only used when GOOGLE_PLACES_API_KEY is set; without it restaurants keep OpenStreetMap's data. Google
Places is paid (billed per request on a Google Cloud project with billing), so at most
GOOGLE_PLACES_MAX restaurants are looked up per city view: one Text Search each, plus one photo.

Each restaurant from OpenStreetMap is searched by name near its own map point. Google's answer is
used only when it is the same place: within MATCH_METRES of that point and sharing a word of the
name. Otherwise the restaurant is left as it was, so no other place's photo or rating is shown.

Google's terms don't allow storing this content, so it is added when a city is shown and never
written to the city_places cache; the in-memory search cache keeps repeated views cheap. The photo
link comes from Google's photo endpoint with skipHttpRedirect, so the API key never reaches the
browser. Google requires showing the photo's author, which `photo_attribution` carries.
"""
import logging
import re

from app import config
from app.routing import haversine_m
from app.travel_data import TravelDataError, _cached, _request

logger = logging.getLogger(__name__)

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PHOTO_URL = "https://places.googleapis.com/v1/{name}/media"
FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress", "places.location", "places.rating",
    "places.userRatingCount", "places.regularOpeningHours.weekdayDescriptions", "places.photos",
    "places.googleMapsUri", "places.primaryTypeDisplayName",
])
MATCH_METRES = 300
PHOTO_WIDTH = 480
SOURCE = "Google Places"


def configured() -> bool:
    return bool(config.GOOGLE_PLACES_API_KEY)


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2}


def same_place(item: dict, found: dict) -> bool:
    where = found.get("location") or {}
    if None in (item.get("latitude"), item.get("longitude"), where.get("latitude"), where.get("longitude")):
        return False
    near = haversine_m(item["latitude"], item["longitude"], where["latitude"], where["longitude"]) <= MATCH_METRES
    name = (found.get("displayName") or {}).get("text") or ""
    return near and bool(_words(item["name"]) & _words(name))


def search(item: dict, city_name: str) -> dict | None:
    """Google's place for this restaurant, or None."""
    body = {
        "textQuery": f"{item['name']}, {city_name}",
        "maxResultCount": 1,
        "locationBias": {"circle": {"center": {"latitude": item["latitude"], "longitude": item["longitude"]},
                                    "radius": float(MATCH_METRES)}},
    }
    headers = {"X-Goog-Api-Key": config.GOOGLE_PLACES_API_KEY, "X-Goog-FieldMask": FIELDS}
    found = _cached(("google_places", item["name"], round(item["latitude"], 4), round(item["longitude"], 4)),
                    lambda: _request("Google Places", "POST", SEARCH_URL, json=body, headers=headers))
    places = found.get("places") if isinstance(found, dict) else None
    return places[0] if places else None


def photo(place: dict) -> dict | None:
    """The first photo's public link and its author, without exposing the key."""
    photos = place.get("photos") or []
    if not photos or not photos[0].get("name"):
        return None
    name = photos[0]["name"]
    params = {"maxWidthPx": PHOTO_WIDTH, "skipHttpRedirect": "true", "key": config.GOOGLE_PLACES_API_KEY}
    media = _cached(("google_photo", name), lambda: _request("Google Places", "GET", PHOTO_URL.format(name=name), params=params))
    uri = media.get("photoUri") if isinstance(media, dict) else None
    if not uri:
        return None
    author = (photos[0].get("authorAttributions") or [{}])[0]
    return {"url": uri, "author": author.get("displayName"), "author_url": author.get("uri")}


def enrich(restaurants: list[dict], city_name: str) -> tuple[list[dict], str | None]:
    """Restaurants with Google's photo, rating and hours where Google has the same place.

    Returns the list and a notice when Google couldn't be asked; any failure keeps the
    OpenStreetMap data as it was."""
    if not configured():
        return restaurants, None
    out, notice = [], None
    for index, item in enumerate(restaurants):
        if index >= config.GOOGLE_PLACES_MAX or item.get("latitude") is None or notice:
            out.append(item)
            continue
        try:
            found = search(item, city_name)
            if not found or not same_place(item, found):
                out.append(item)
                continue
            picture = photo(found)
        except TravelDataError as e:
            logger.warning("Google Places skipped: %s", e)
            notice = f"Restaurant photos and ratings from Google couldn't be loaded: {e}"
            out.append(item)
            continue
        out.append({
            **item,
            "image": item.get("image") or (picture or {}).get("url"),
            "image_label": "Photo: Google" if not item.get("image") and picture else item.get("image_label"),
            "photo_attribution": picture and {"author": picture["author"], "author_url": picture["author_url"]},
            "google": {
                "rating": found.get("rating"),
                "rating_count": found.get("userRatingCount"),
                "address": found.get("formattedAddress"),
                "opening_hours": (found.get("regularOpeningHours") or {}).get("weekdayDescriptions"),
                "type": (found.get("primaryTypeDisplayName") or {}).get("text"),
                "maps_url": found.get("googleMapsUri"),
                "source": SOURCE,
                "data_label": "Live",
            },
        })
    return out, notice
