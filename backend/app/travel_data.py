"""Real flight and hotel search for the pipeline's search_node.

Flights: Google Flights via SerpApi first (live schedules and prices for any date, same key
  as hotels; FLIGHT_SOURCE=travelpayouts turns it off). Fallback, and the only source when
  there's no SERPAPI_API_KEY: Travelpayouts Aviasales Data API (free token,
  https://www.travelpayouts.com). Real fares that Aviasales users found in the last 48 hours, with the real airline,
  flight number and departure time. They are cached fares, not live bookable offers,
  and the API can't re-check a price, so every record carries a `link` to the live
  Aviasales search and `price_status: "cached"`.

Hotels: SerpApi's Google Hotels engine (free plan, https://serpapi.com). The prices
  Google Hotels shows for the stay dates, in INR. With no SERPAPI_API_KEY the hotel
  search reports itself unavailable instead of returning anything made up.

Nothing in this module invents a value: a field the provider didn't send is None.
Results are cached in memory for SEARCH_CACHE_MINUTES to stay inside rate limits.
"""
import hashlib
import json
import logging
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx

from app import config

logger = logging.getLogger(__name__)

TRAVELPAYOUTS_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates"
AIRLINES_URL = "https://api.travelpayouts.com/data/en/airlines.json"
SERPAPI_URL = "https://serpapi.com/search.json"
TIMEOUT_SECONDS = 25
# Flight search also returns fares this many days either side of the requested date.
FLEX_DAYS = 3
# SerpApi answers a search that found nothing with this error instead of an empty list.
SERPAPI_NO_RESULTS = "hasn't returned any results"

# ---- airports and their cities -------------------------------------------------------
# Every airport with scheduled flights (about 4,000; app/data/airports.json, built from the
# public-domain OurAirports data by scripts/build_airports.py). Google Hotels, OpenTripMap and
# Google Maps transit are all searched by city name, so each airport code maps to its city.

AIRPORTS_FILE = Path(__file__).resolve().parent / "data" / "airports.json"

# Where the airport's town isn't the city a traveller means, or a shorter name reads better.
CITY_NAMES = {
    "BLR": "Bangalore", "GOI": "Goa", "GOX": "Goa", "NRT": "Tokyo", "HND": "Tokyo",
    "COK": "Kochi", "TRV": "Thiruvananthapuram", "MAA": "Chennai", "CCU": "Kolkata",
    "BOM": "Mumbai", "DEL": "New Delhi", "EWR": "New York", "LGA": "New York",
    "STN": "London", "LGW": "London", "LTN": "London", "ORY": "Paris", "DMK": "Bangkok",
    "BKK": "Bangkok", "ICN": "Seoul", "KIX": "Osaka", "PVG": "Shanghai", "PEK": "Beijing",
    "PKX": "Beijing", "DWC": "Dubai", "IAD": "Washington", "DCA": "Washington",
    "AYJ": "Ayodhya",  # OurAirports still files it under Faizabad, renamed Ayodhya in 2018
}


def _load_airports() -> tuple[dict[str, dict], dict[str, str]]:
    data = json.loads(AIRPORTS_FILE.read_text(encoding="utf-8"))
    airports = {}
    for code, (city, country, name, lat, lon, size, zone) in data["airports"].items():
        airports[code] = {"code": code, "city": CITY_NAMES.get(code, city), "country": country,
                          "airport": name, "latitude": lat, "longitude": lon, "size": size,
                          "timezone": zone}
    return airports, data["countries"]


AIRPORTS, COUNTRY_NAMES = _load_airports()

# ---- every Indian city and town --------------------------------------------------------
# A trip can also start or end at any Indian city or town (app/data/places_in.json, built from
# OpenStreetMap by scripts/build_places.py), whether or not it has an airport: Ayodhya, Shirdi,
# Katra. Its code is a lowercase slug ("ayodhya"); airport codes stay upper case ("BLR"). Each
# place names its nearest airport, railway station and bus station with their distances, and
# which of the three serve it (within a few km).

PLACES_FILE = Path(__file__).resolve().parent / "data" / "places_in.json"
SERVES = (("flight", 1), ("train", 2), ("bus", 4))


def _load_places() -> dict[str, dict]:
    data = json.loads(PLACES_FILE.read_text(encoding="utf-8"))
    places = {}
    for code, (name, state, lat, lon, flags, pop, airport, station, bus, aka) in data["places"].items():
        near = AIRPORTS.get(airport[0], {})
        places[code] = {
            "code": code, "city": name, "state": state, "country": "IN", "latitude": lat, "longitude": lon,
            "timezone": "Asia/Kolkata", "kind": "place", "population": pop, "aka": aka,
            "serves": [mode for mode, bit in SERVES if flags & bit],
            "airport_code": airport[0], "airport": near.get("airport"), "airport_km": airport[1],
            "station": {"name": station[0], "code": station[1] or None, "km": station[2]} if station else None,
            "bus_station": {"name": bus[0], "km": bus[1]} if bus else None,
        }
    return places


INDIA_PLACES = _load_places()
# Every code a trip can use: airports everywhere, plus India's cities and towns.
PLACES: dict[str, dict] = {
    **{code: {**a, "kind": "airport", "serves": ["flight"], "airport_code": code, "airport_km": 0}
       for code, a in AIRPORTS.items()},
    **INDIA_PLACES,
}
# Trip code -> (city name, ISO country code), the shape every search here uses.
CITIES: dict[str, tuple[str, str]] = {code: (p["city"], p["country"]) for code, p in PLACES.items()}


def flight_airport(code: str) -> str:
    """The airport a flight for this trip end uses: the code itself, or a town's nearest airport."""
    place = PLACES.get(code)
    return place["airport_code"] if place else code


def place_label(code: str) -> str:
    """How Google Maps and Google Hotels should read the place: "Ayodhya, Uttar Pradesh, India"."""
    p = PLACES[code]
    if p["kind"] == "place":
        return f"{p['city']}, {p['state']}, India" if p["state"] else f"{p['city']}, India"
    return f"{p['city']}, {country_name(p['country'])}"


def country_name(code: str) -> str:
    return COUNTRY_NAMES.get(code, code)


def search_airports(query: str, limit: int = 10) -> list[dict]:
    """Airports for a search box: an exact code or city first, then cities and airport names that
    start with the text, then ones that contain it; bigger airports and India first."""
    q = query.strip().lower()
    if not q:
        return []

    def rank(a: dict) -> tuple | None:
        city, name, country = a["city"].lower(), a["airport"].lower(), country_name(a["country"]).lower()
        if a["code"].lower() == q or city == q:
            match = 0
        elif city.startswith(q):
            match = 1
        elif name.startswith(q) or any(w.startswith(q) for w in city.split() + name.split()):
            match = 2
        elif q in city or q in name or country.startswith(q):
            match = 3
        else:
            return None
        return (match, -a["size"], a["country"] != "IN", a["city"], a["code"])

    ranked = sorted((r, a) for a in AIRPORTS.values() if (r := rank(a)) is not None)
    return [{**a, "country_name": country_name(a["country"])} for _, a in ranked[:limit]]


def _text_match(q: str, names: list[str]) -> int | None:
    """0 exact, 1 starts with, 2 a word starts with, 3 contains; None when no name matches."""
    best = None
    for name in names:
        n = name.lower()
        if n == q:
            m = 0
        elif n.startswith(q):
            m = 1
        elif any(w.startswith(q) for w in n.split()):
            m = 2
        elif q in n:
            m = 3
        else:
            continue
        best = m if best is None else min(best, m)
    return best


def search_places(query: str, mode: str = "all", limit: int = 10) -> list[dict]:
    """Trip ends for the form's From and To boxes, for the way of travel the trip uses.

    flight: airports anywhere, found by their own names or by an Indian town they serve
    ("Ayodhya" finds AYJ, which OurAirports files under Faizabad). train / bus: Indian places
    with a railway station / bus station of their own. all: every Indian city and town (each
    with its nearest airport, station and bus station), plus airports abroad."""
    q = query.strip().lower()
    if not q:
        return []
    ranked: list[tuple] = []
    if mode == "flight":
        best: dict[str, tuple] = {}
        for a in AIRPORTS.values():
            m = _text_match(q, [a["city"], a["airport"], a["code"]])
            if m is not None:
                best[a["code"]] = ((m, -a["size"], a["country"] != "IN", a["city"]), None)
        for p in INDIA_PLACES.values():
            code = p["airport_code"]
            if "flight" not in p["serves"] or code not in AIRPORTS:
                continue
            m = _text_match(q, [p["city"], *p["aka"]])
            if m is not None and (code not in best or m < best[code][0][0]):
                best[code] = ((m, -AIRPORTS[code]["size"], False, AIRPORTS[code]["city"]), p["city"])
        for code, (key, town) in best.items():
            ranked.append((key, {**PLACES[code], "country_name": country_name(PLACES[code]["country"]),
                                 "for_place": town}))
    else:
        for p in INDIA_PLACES.values():
            if mode != "all" and mode not in p["serves"]:
                continue
            m = _text_match(q, [p["city"], *p["aka"]])
            if m is not None:
                ranked.append(((m, -len(p["serves"]), -p["population"], p["city"]), {**p, "country_name": "India"}))
        if mode == "all":
            for a in AIRPORTS.values():
                if a["country"] == "IN":
                    continue
                m = _text_match(q, [a["city"], a["airport"], a["code"]])
                if m is not None:
                    ranked.append(((m, 0, -a["size"], a["city"]),
                                   {**PLACES[a["code"]], "country_name": country_name(a["country"])}))
    ranked.sort(key=lambda r: r[0])
    return [p for _, p in ranked[:limit]]


class TravelDataError(Exception):
    """A search couldn't run (no key, rate limit, provider down). The message is shown to the user."""


class HotelsUnavailable(TravelDataError):
    """No live hotel provider is configured, so hotel prices can't be shown."""


_cache: dict[tuple, tuple[float, object]] = {}


def _cached(key: tuple, fetch):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < config.SEARCH_CACHE_MINUTES * 60:
        return hit[1]
    value = fetch()
    _cache[key] = (time.time(), value)
    return value


def _request(provider: str, method: str, url: str, **kwargs) -> dict | list:
    try:
        response = httpx.request(method, url, **{"timeout": TIMEOUT_SECONDS, **kwargs})
    except httpx.TimeoutException as e:
        raise TravelDataError(f"{provider} took too long to answer, please try again") from e
    except httpx.HTTPError as e:
        logger.warning("%s request failed: %s", provider, e)
        raise TravelDataError(f"{provider} couldn't be reached, please try again") from e
    if response.status_code == 429:
        raise TravelDataError(f"{provider} rate limit reached, please wait a minute and try again")
    if response.status_code in (401, 403):
        raise TravelDataError(f"{provider} rejected the server's API key")
    if response.status_code >= 400:
        logger.warning("%s returned %s: %s", provider, response.status_code, response.text[:300])
        raise TravelDataError(f"{provider} search failed (HTTP {response.status_code})")
    try:
        return response.json()
    except ValueError as e:
        raise TravelDataError(f"{provider} sent a response that couldn't be read") from e


# ---- flights --------------------------------------------------------------

def _airline_names() -> dict[str, str]:
    # IATA code -> name, from Travelpayouts' free reference data. Optional: if it fails,
    # flights still show their airline code.
    def fetch():
        try:
            rows = _request("Travelpayouts", "GET", AIRLINES_URL)
        except TravelDataError:
            return {}
        return {r["code"]: r.get("name") or r["code"] for r in rows if r.get("code")}

    return _cached(("airlines",), fetch)


# SerpApi's google_flights travel_class codes, keyed by the trip's cabin_class preference.
GOOGLE_CABINS = {"economy": 1, "premium_economy": 2, "business": 3, "first": 4}


def search_flights(origin: str, destination: str, day: date, cabin_class: str | None = None) -> list[dict]:
    """Flights for `day`: live Google Flights first, Travelpayouts' cached fares as the fallback.

    Google Flights (via SerpApi) has real schedules and prices for any future date, but only
    for `day` itself. When it isn't set up, fails, or finds nothing, Travelpayouts is tried:
    its cached fares also cover nearby days, so a failed trip can still name the nearest fares.
    """
    # A town without an airport of its own flies to and from its nearest one.
    origin, destination = flight_airport(origin), flight_airport(destination)
    google_tried = config.FLIGHT_SOURCE == "google" and bool(config.SERPAPI_API_KEY)
    google_error = None
    if google_tried:
        try:
            flights = _google_flights(origin, destination, day, cabin_class)
            if flights:
                return flights
        except TravelDataError as e:
            google_error = e
            logger.warning("Google Flights search failed: %s", e)
    if google_tried and not config.TRAVELPAYOUTS_TOKEN:
        # No fallback to ask: report Google's own failure, or that it found no flights.
        if google_error is not None:
            raise google_error
        return []
    return _travelpayouts_flights(origin, destination, day)


def _google_flights(origin: str, destination: str, day: date, cabin_class: str | None) -> list[dict]:
    """Live one-way Google Flights results for `day`, in INR."""
    params = {
        "engine": "google_flights",
        "departure_id": origin,
        "arrival_id": destination,
        "outbound_date": day.isoformat(),
        "type": 2,  # one way; the pipeline searches the return leg on its own
        "travel_class": GOOGLE_CABINS.get(cabin_class or "economy", 1),
        "currency": "INR",
        "gl": "in",
        "hl": "en",
        "api_key": config.SERPAPI_API_KEY,
    }

    def fetch():
        body = _request("SerpApi", "GET", SERPAPI_URL, params=params)
        error = body.get("error")
        if error and SERPAPI_NO_RESULTS in error:
            return {}
        if error:
            raise TravelDataError(f"SerpApi flight search failed: {error}")
        return body

    body = _cached(("google_flights", origin, destination, day.isoformat(), params["travel_class"]), fetch)
    link = (body.get("search_metadata") or {}).get("google_flights_url")
    # Google's own view of this route's prices for the day ("low", "typical", "high"). It is often
    # missing for one-way searches; when it is, the fields stay None rather than being guessed.
    insights = body.get("price_insights") or {}
    typical = insights.get("typical_price_range")
    typical = typical if isinstance(typical, list) and len(typical) == 2 else None
    flights, seen = [], set()
    for row in (body.get("best_flights") or []) + (body.get("other_flights") or []):
        legs = row.get("flights") or []
        price = row.get("price")
        try:
            first, last = legs[0], legs[-1]
            departure = datetime.strptime(first["departure_airport"]["time"], "%Y-%m-%d %H:%M")
            arrival = datetime.strptime(last["arrival_airport"]["time"], "%Y-%m-%d %H:%M")
            flight_no = first["flight_number"].replace(" ", "")
        except (IndexError, KeyError, TypeError, ValueError):
            continue  # no legs, times or flight number: can't be shown or checked
        if price is None or departure.date() != day:
            continue  # no price to compare, or not on the requested day
        flight_id = f"FL-{flight_no}-{departure:%H%M}"
        if flight_id in seen:
            continue
        seen.add(flight_id)
        cabin = (first.get("travel_class") or "Economy").lower().replace(" ", "_")
        flights.append(
            {
                "id": flight_id,
                "origin": first["departure_airport"].get("id") or origin,
                "destination": last["arrival_airport"].get("id") or destination,
                # Local airport times, as Google shows them (no UTC offset).
                "departure_time": departure.isoformat(),
                "arrival_time": arrival.isoformat(),
                "airline": first.get("airline") or flight_no[:2],
                "airline_code": flight_no[:2],
                "flight_number": flight_no,
                "price": price,
                "currency": "INR",
                "cabin_class": cabin,
                "stops": len(legs) - 1,
                # Where and how long each connection waits, as Google lists them.
                "layovers": [
                    {
                        "airport": stop.get("id"),
                        "airport_name": stop.get("name"),
                        "minutes": stop.get("duration"),
                        "overnight": bool(stop.get("overnight")),
                    }
                    for stop in row.get("layovers") or []
                ],
                "duration_minutes": row.get("total_duration"),
                "price_level": insights.get("price_level"),
                "typical_price_range": typical,
                "price_status": "live",
                "link": link,
                "source": "Google Flights via SerpApi",
            }
        )
    return flights


def _travelpayouts_flights(origin: str, destination: str, day: date) -> list[dict]:
    """Real fares from FLEX_DAYS before to FLEX_DAYS after `day`.

    The Data API keeps only the cheapest fare found per departure day, so a single-day
    search gives at most one flight. Nearby days give the pipeline real alternatives;
    check_node still only books a flight on `day` and lists the others in the ledger.
    """
    if not config.TRAVELPAYOUTS_TOKEN:
        raise TravelDataError("Live flight search isn't set up: TRAVELPAYOUTS_TOKEN is missing on the server")
    first, last = day - timedelta(days=FLEX_DAYS), day + timedelta(days=FLEX_DAYS)
    months = sorted({f"{d:%Y-%m}" for d in (first, last)})

    def fetch(month: str):
        params = {
            "origin": origin,
            "destination": destination,
            "departure_at": month,
            "one_way": "true",
            "direct": "false",
            "unique": "false",
            "sorting": "price",
            "currency": "inr",
            "limit": 100,
        }
        body = _request(
            "Travelpayouts", "GET", TRAVELPAYOUTS_URL,
            params=params, headers={"X-Access-Token": config.TRAVELPAYOUTS_TOKEN},
        )
        if not body.get("success", False):
            raise TravelDataError(f"Travelpayouts search failed: {body.get('error') or 'unknown error'}")
        return body.get("data") or []

    rows = [
        row
        for month in months
        for row in _cached(("flights", origin, destination, month), lambda: fetch(month))
    ]
    names = _airline_names()
    flights, seen = [], set()
    for row in rows:
        try:
            departure = datetime.fromisoformat(row["departure_at"])
            price = row["price"]
            airline = row["airline"]
            stops = int(row["transfers"])
        except (KeyError, TypeError, ValueError):
            continue  # a row missing its time, price, airline or stops can't be costed or shown
        if not first <= departure.date() <= last:
            continue
        flight_no = f"{airline}{row.get('flight_number', '')}".strip()
        flight_id = f"FL-{flight_no}-{departure:%H%M}"
        if flight_id in seen:
            continue
        seen.add(flight_id)
        duration = row.get("duration_to") or row.get("duration")
        flights.append(
            {
                "id": flight_id,
                "origin": row.get("origin_airport") or origin,
                "destination": row.get("destination_airport") or destination,
                "departure_time": departure.isoformat(),
                # Departure instant plus the flight's duration, kept in the departure's UTC offset.
                "arrival_time": (departure + timedelta(minutes=duration)).isoformat() if duration else None,
                "airline": names.get(airline, airline),
                "airline_code": airline,
                "flight_number": flight_no,
                "price": price,
                "currency": "INR",
                # Aviasales fares are economy; any other cabin can't be priced from this source.
                "cabin_class": "economy",
                "stops": stops,
                "duration_minutes": duration,
                "price_status": "cached",
                "link": f"https://www.aviasales.com{row['link']}" if row.get("link") else None,
                "source": "Travelpayouts (Aviasales fares found in the last 48 hours)",
            }
        )
    return flights


# ---- hotels ---------------------------------------------------------------

def hotels_configured() -> bool:
    return bool(config.SERPAPI_API_KEY)


def search_hotels(city: str, check_in: date, check_out: date) -> list[dict]:
    if not hotels_configured():
        raise HotelsUnavailable(
            "Live hotel prices are unavailable (no SERPAPI_API_KEY is set), so this total covers the flights only"
        )
    if city not in CITIES:
        raise TravelDataError(f"Hotel search doesn't know the city for airport {city} yet")
    city_name, _country = CITIES[city]
    if PLACES[city]["kind"] == "place" and PLACES[city]["state"]:
        city_name = f"{city_name}, {PLACES[city]['state']}"
    nights = (check_out - check_in).days
    params = {
        "engine": "google_hotels",
        "q": f"hotels in {city_name}",
        "check_in_date": check_in.isoformat(),
        "check_out_date": check_out.isoformat(),
        "adults": 1,
        "currency": "INR",
        "gl": "in",
        "hl": "en",
        "api_key": config.SERPAPI_API_KEY,
    }

    def fetch():
        body = _request("SerpApi", "GET", SERPAPI_URL, params=params)
        error = body.get("error")
        if error and SERPAPI_NO_RESULTS in error:
            return {"properties": []}
        if error:
            raise TravelDataError(f"SerpApi hotel search failed: {error}")
        return body

    body = _cached(("hotels", city, check_in.isoformat(), check_out.isoformat()), fetch)
    hotels = []
    for row in body.get("properties") or []:
        stay = (row.get("total_rate") or {}).get("extracted_lowest")
        token = row.get("property_token")
        if row.get("type") != "hotel" or not stay or not token or not row.get("name"):
            continue  # vacation rentals, or no price/name: nothing honest to compare
        hotels.append(
            {
                # property_token is ~40 chars; a short stable hash keeps ledger lines readable.
                "id": f"HT-{hashlib.sha1(token.encode()).hexdigest()[:8]}",
                "city": city,
                "name": row["name"],
                "address": None,
                # The total is for the whole stay; the pipeline compares per-night prices.
                # Not rounded, so per-night x nights gives back the exact stay total.
                "price_per_night": stay / nights,
                "stay_total": stay,
                "currency": "INR",
                # Google's guest rating is already on the 5-point scale trip preferences use.
                "rating": row.get("overall_rating"),
                "reviews": row.get("reviews"),
                "stars": row.get("extracted_hotel_class"),
                "amenities": row.get("amenities") or [],
                "distance_to_center_km": None,
                # Where the hotel is (for the route to attractions) and Google's photos of it.
                "latitude": (row.get("gps_coordinates") or {}).get("latitude"),
                "longitude": (row.get("gps_coordinates") or {}).get("longitude"),
                "images": [
                    {"thumbnail": image.get("thumbnail"), "original": image.get("original_image")}
                    for image in (row.get("images") or [])[:5]
                    if image.get("thumbnail") or image.get("original_image")
                ],
                "price_status": "live",
                "link": row.get("link"),
                "source": "Google Hotels via SerpApi",
            }
        )
    return hotels
