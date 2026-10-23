"""Real flight and hotel search for the pipeline's search_node.

Flights: Travelpayouts Aviasales Data API (free token, https://www.travelpayouts.com).
  Real fares that Aviasales users found in the last 48 hours, with the real airline,
  flight number and departure time. They are cached fares, not live bookable offers,
  and the API can't re-check a price, so every record carries a `link` to the live
  Aviasales search and `price_status: "cached"`.

Hotels: LiteAPI (https://liteapi.travel). Only a production key returns live room
  rates; a sandbox key returns test data, so it is refused. With no production key the
  hotel search reports itself unavailable instead of returning anything made up.

Nothing in this module invents a value: a field the provider didn't send is None.
Results are cached in memory for SEARCH_CACHE_MINUTES to stay inside rate limits.
"""
import logging
import time
from datetime import date, datetime, timedelta

import httpx

from app import config

logger = logging.getLogger(__name__)

TRAVELPAYOUTS_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates"
AIRLINES_URL = "https://api.travelpayouts.com/data/en/airlines.json"
LITEAPI_RATES_URL = "https://api.liteapi.travel/v3.0/hotels/rates"
TIMEOUT_SECONDS = 25

# LiteAPI searches hotels by city name + country, not airport code.
CITIES: dict[str, tuple[str, str]] = {
    "BLR": ("Bangalore", "IN"),
    "DEL": ("New Delhi", "IN"),
    "BOM": ("Mumbai", "IN"),
    "MAA": ("Chennai", "IN"),
    "HYD": ("Hyderabad", "IN"),
    "CCU": ("Kolkata", "IN"),
    "PNQ": ("Pune", "IN"),
    "GOI": ("Goa", "IN"),
    "GOX": ("Goa", "IN"),
    "BBI": ("Bhubaneswar", "IN"),
    "AMD": ("Ahmedabad", "IN"),
    "COK": ("Kochi", "IN"),
    "JAI": ("Jaipur", "IN"),
    "LKO": ("Lucknow", "IN"),
    "TRV": ("Thiruvananthapuram", "IN"),
    "IXC": ("Chandigarh", "IN"),
    "GAU": ("Guwahati", "IN"),
    "DXB": ("Dubai", "AE"),
    "SIN": ("Singapore", "SG"),
    "LHR": ("London", "GB"),
    "JFK": ("New York", "US"),
    "NRT": ("Tokyo", "JP"),
    "CDG": ("Paris", "FR"),
    "BKK": ("Bangkok", "TH"),
    "FRA": ("Frankfurt", "DE"),
    "SFO": ("San Francisco", "US"),
}


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
        response = httpx.request(method, url, timeout=TIMEOUT_SECONDS, **kwargs)
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


def search_flights(origin: str, destination: str, day: date, cabin_class: str | None = None) -> list[dict]:
    if not config.TRAVELPAYOUTS_TOKEN:
        raise TravelDataError("Live flight search isn't set up: TRAVELPAYOUTS_TOKEN is missing on the server")
    params = {
        "origin": origin,
        "destination": destination,
        "departure_at": day.isoformat(),
        "one_way": "true",
        "direct": "false",
        "unique": "false",
        "sorting": "price",
        "currency": "inr",
        "limit": 30,
    }

    def fetch():
        body = _request(
            "Travelpayouts", "GET", TRAVELPAYOUTS_URL,
            params=params, headers={"X-Access-Token": config.TRAVELPAYOUTS_TOKEN},
        )
        if not body.get("success", False):
            raise TravelDataError(f"Travelpayouts search failed: {body.get('error') or 'unknown error'}")
        return body.get("data") or []

    rows = _cached(("flights", origin, destination, day.isoformat()), fetch)
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
        if departure.date() != day:
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
    key = config.LITEAPI_API_KEY
    return bool(key) and not key.startswith("sand_")


def search_hotels(city: str, check_in: date, check_out: date) -> list[dict]:
    if not hotels_configured():
        reason = "a sandbox key returns test data" if config.LITEAPI_API_KEY else "no LITEAPI_API_KEY is set"
        raise HotelsUnavailable(f"Live hotel prices are unavailable ({reason}), so this total covers the flight only")
    if city not in CITIES:
        raise TravelDataError(f"Hotel search doesn't know the city for airport {city} yet")
    city_name, country = CITIES[city]
    nights = (check_out - check_in).days
    payload = {
        "cityName": city_name,
        "countryCode": country,
        "checkin": check_in.isoformat(),
        "checkout": check_out.isoformat(),
        "currency": "INR",
        "guestNationality": "IN",
        "occupancies": [{"adults": 1}],
        "limit": 30,
        "timeout": 10,
        "maxRatesPerHotel": 1,
    }

    def fetch():
        return _request(
            "LiteAPI", "POST", LITEAPI_RATES_URL,
            json=payload, headers={"X-API-Key": config.LITEAPI_API_KEY},
        )

    body = _cached(("hotels", city, check_in.isoformat(), check_out.isoformat()), fetch)
    details = {h.get("id"): h for h in body.get("hotels") or []}
    hotels = []
    for row in body.get("data") or []:
        totals = [
            rt["offerRetailRate"]["amount"]
            for rt in row.get("roomTypes") or []
            if (rt.get("offerRetailRate") or {}).get("currency") == "INR"
        ]
        info = details.get(row.get("hotelId"))
        if not totals or not info or not info.get("name"):
            continue  # no INR rate or no name: nothing honest to show
        stay = min(totals)
        review = info.get("rating")
        hotels.append(
            {
                "id": f"HT-{row['hotelId']}",
                "city": city,
                "name": info["name"],
                "address": info.get("address"),
                # LiteAPI's total is for the whole stay; the pipeline compares per-night prices.
                "price_per_night": round(stay / nights, 2),
                "stay_total": stay,
                "currency": "INR",
                # Guest review score is out of 10; trip preferences use a 5-point scale.
                "rating": round(review / 2, 1) if review else None,
                "review_score": review,
                "stars": info.get("stars"),
                "amenities": [],
                "distance_to_center_km": None,
                "price_status": "live",
                "source": "LiteAPI live rates",
            }
        )
    return hotels
