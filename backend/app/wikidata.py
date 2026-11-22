"""Day trips and famous hotels around a destination, from Wikidata (free, no key).

OpenTripMap only looks 10 km around the city centre, so the famous places a short drive away
(Ranthambore and Pushkar from Jaipur, Dudhsagar Falls from Goa) and the city's famous hotels
(Rambagh Palace, the Taj Mahal Palace) never show up there. Wikidata's query service finds
them with one geographic query each (the `wikibase:around` service):

  - day trips: forts, palaces, temples, national parks, lakes, waterfalls, hill stations and
    heritage sites DAY_TRIP_MIN_KM to DAY_TRIP_MAX_KM from the city (DAY_TRIP_FALLBACK_KM when
    the wider search is too slow: around Delhi or Kolkata the service has too many items to scan);
  - famous stays: hotels within STAY_RADIUS_KM.

Fame is the number of Wikipedia language editions with an article on the place (Wikidata's
sitelinks): a place needs an English Wikipedia article and at least MIN_SITELINKS of them, so
the hundreds of budget-chain hotels in Wikidata are left out. Nothing is invented: a place
without a photo has image None. Results are cached in memory for CACHE_HOURS.
"""
import logging
import time
from urllib.parse import quote

import httpx

from app.travel_data import TravelDataError, _request

logger = logging.getLogger(__name__)

SPARQL_URL = "https://query.wikidata.org/sparql"
SOURCE = "Wikidata and Wikipedia"
# Wikimedia's robot policy refuses requests without a contactable User-Agent (HTTP 403).
USER_AGENT = "AI-Trip-Optimizer/1.0 (https://github.com/bhuvan-somisetty/AI-Trip-Optimizer)"
TIMEOUT_SECONDS = 25
CACHE_HOURS = 24 * 7
DAY_TRIP_MIN_KM = 15  # closer places are the city's own sights (OpenTripMap covers them)
DAY_TRIP_MAX_KM = 150
DAY_TRIP_FALLBACK_KM = 80
STAY_RADIUS_KM = 25
MAX_DAY_TRIPS = 9
MAX_STAYS = 6
MIN_SITELINKS = {"day_trip": 4, "stay": 1}

# Wikidata classes (instance of, P31) -> the label shown. Direct classes only: following
# subclasses (wdt:P279*) times out on the public service for a 200 km radius.
DAY_TRIP_TYPES = {
    "Q57821": "Fort",  # fortification
    "Q1785071": "Fort",  # fort
    "Q23413": "Fort",  # castle
    "Q16560": "Palace",
    "Q44539": "Temple",
    "Q842402": "Temple",  # Hindu temple
    "Q160742": "Temple",  # abbey / monastery
    "Q1370598": "Temple",  # structure of worship
    "Q32815": "Mosque",
    "Q16970": "Church",
    "Q2977": "Church",  # cathedral
    "Q839954": "Archaeological site",
    "Q4989906": "Monument",
    "Q33506": "Museum",
    "Q46169": "National park",
    "Q473972": "Protected area",
    "Q2232001": "Wildlife sanctuary",
    "Q23397": "Lake",
    "Q34038": "Waterfall",
    "Q40080": "Beach",
    "Q1144661": "Hill station",
    "Q9259": "World Heritage Site",
    "Q570116": "Tourist attraction",
    "Q15243209": "Historic district",
}
STAY_TYPES = {
    "Q27686": "Hotel",
    "Q1631129": "Heritage hotel",  # luxury hotel
    "Q5056668": "Hotel",  # resort hotel
    "Q1373052": "Resort",
}

QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?type ?image ?dist ?links ?article ?coord WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(%(lon)f %(lat)f)"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "%(radius)d" .
    bd:serviceParam wikibase:distance ?dist .
  }
  ?item wdt:P31 ?type .
  VALUES ?type { %(types)s }
  ?item wikibase:sitelinks ?links .
  FILTER(?dist >= %(min_km)d && ?links >= %(min_links)d)
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL { ?item wdt:P18 ?image }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?links)
LIMIT 60
"""

_cache: dict[tuple, tuple[float, list[dict]]] = {}


def _query(sparql: str) -> list[dict]:
    """Rows of a SPARQL query (tests replace this; it is the only network call here)."""
    body = _request(
        "Wikidata",
        "GET",
        SPARQL_URL,
        params={"query": sparql, "format": "json"},
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
        timeout=TIMEOUT_SECONDS,
    )
    return ((body or {}).get("results") or {}).get("bindings") or []


def thumbnail(commons_url: str | None, width: int = 330) -> str | None:
    """A Commons file (wdt:P18 is a Special:FilePath URL) at a standard thumbnail width."""
    if not commons_url:
        return None
    name = commons_url.rsplit("/", 1)[-1]
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{quote(name, safe='%')}?width={width}"


def _value(row: dict, key: str) -> str | None:
    return (row.get(key) or {}).get("value")


def _point(wkt: str | None) -> tuple[float | None, float | None]:
    # "Point(75.85 26.98)" -> (lat, lon)
    try:
        lon, lat = wkt.removeprefix("Point(").removesuffix(")").split()
        return float(lat), float(lon)
    except (AttributeError, ValueError):
        return None, None


def rows_to_places(rows: list[dict], types: dict[str, str], kind: str, limit: int) -> list[dict]:
    """One entry per Wikidata item (an item with two matching classes comes back twice), most
    famous first, nearer first among equals."""
    seen: dict[str, dict] = {}
    for row in rows:
        item = _value(row, "item") or ""
        qid = item.rsplit("/", 1)[-1]
        name = _value(row, "itemLabel")
        if not qid or not name or name == qid:
            continue  # no English name
        category = types.get((_value(row, "type") or "").rsplit("/", 1)[-1])
        if qid in seen:
            continue
        lat, lon = _point(_value(row, "coord"))
        description = _value(row, "itemDescription")
        seen[qid] = {
            "id": f"wd-{qid}",
            "kind": kind,
            "name": name,
            "category": category,
            "description": description[:1].upper() + description[1:] if description else None,
            # The same fields as an OpenTripMap place (app/places.py), so the same card shows it.
            "distance_m": round(float(_value(row, "dist") or 0) * 1000),
            "latitude": lat,
            "longitude": lon,
            "image": thumbnail(_value(row, "image")),
            "image_label": "Photo: Wikimedia Commons" if _value(row, "image") else None,
            "wikipedia": _value(row, "article"),
            "wikidata": item,
            "rating": None,
            "fame": int(_value(row, "links") or 0),
            "source": SOURCE,
            "data_label": "Wikidata",
        }
    found = sorted(seen.values(), key=lambda p: (-p["fame"], p["distance_m"]))
    return found[:limit]


def _search(kind: str, lat: float, lon: float, radius_km: int) -> list[dict]:
    day_trip = kind == "day_trip"
    types = DAY_TRIP_TYPES if day_trip else STAY_TYPES
    sparql = QUERY % {
        "lat": lat,
        "lon": lon,
        "radius": radius_km,
        "min_km": DAY_TRIP_MIN_KM if day_trip else 0,
        "min_links": MIN_SITELINKS[kind],
        "types": " ".join(f"wd:{q}" for q in types),
    }
    return rows_to_places(_query(sparql), types, kind, MAX_DAY_TRIPS if day_trip else MAX_STAYS)


def around(kind: str, lat: float, lon: float) -> tuple[list[dict], str | None]:
    """("day_trip" | "stay") places around a point, and a notice when Wikidata couldn't answer."""
    key = (kind, round(lat, 2), round(lon, 2))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_HOURS * 3600:
        return hit[1], None
    radii = (DAY_TRIP_MAX_KM, DAY_TRIP_FALLBACK_KM) if kind == "day_trip" else (STAY_RADIUS_KM,)
    for i, radius in enumerate(radii):
        try:
            found = _search(kind, lat, lon, radius)
            break
        except (TravelDataError, httpx.HTTPError, ValueError) as e:
            logger.warning("Wikidata %s search within %s km failed: %s", kind, radius, e)
            if i == len(radii) - 1:
                return [], f"Wikidata couldn't be reached right now: {e}"
    _cache[key] = (time.time(), found)
    return found, None
