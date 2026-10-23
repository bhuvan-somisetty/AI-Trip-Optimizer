"""Live flight and hotel search through SerpApi's hosted MCP server.

search_node uses this instead of app/mock_data.py when DATA_SOURCE=live. Results are
converted into exactly the shape of data/mock_flights.json and data/mock_hotels.json,
so check_node, the Trade-off Ledger and the frontend can't tell the two sources apart.
"""
import asyncio
import hashlib
import json
import math
import time
from datetime import date

from app import config

MCP_URL = "https://mcp.serpapi.com/mcp"
# Each optimize run costs two searches out of a small free monthly quota, so repeating
# the same trip (re-runs, demos) is served from memory for a while.
CACHE_SECONDS = 6 * 60 * 60
# Searching "cheapest first" with no star filter returns hostels and guest houses,
# which a company won't book for business travel.
HOTEL_CLASSES = "3,4,5"

# Airport code -> (city name for the hotel search, city-centre latitude, longitude).
CITIES = {
    "BLR": ("Bengaluru", 12.9716, 77.5946),
    "DEL": ("New Delhi", 28.6315, 77.2167),
    "BOM": ("Mumbai", 18.9388, 72.8354),
    "MAA": ("Chennai", 13.0827, 80.2707),
    "HYD": ("Hyderabad", 17.3850, 78.4867),
    "CCU": ("Kolkata", 22.5726, 88.3639),
    "PNQ": ("Pune", 18.5204, 73.8567),
    "GOI": ("Goa", 15.4909, 73.8278),
    "BBI": ("Bhubaneswar", 20.2961, 85.8245),
    "DXB": ("Dubai", 25.2048, 55.2708),
    "SIN": ("Singapore", 1.2903, 103.8520),
    "LHR": ("London", 51.5074, -0.1278),
    "JFK": ("New York", 40.7580, -73.9855),
    "NRT": ("Tokyo", 35.6812, 139.7671),
    "CDG": ("Paris", 48.8566, 2.3522),
    "BKK": ("Bangkok", 13.7563, 100.5018),
    "FRA": ("Frankfurt", 50.1109, 8.6821),
    "SFO": ("San Francisco", 37.7749, -122.4194),
}

# Our cabin names -> Google Flights' travel_class codes.
TRAVEL_CLASS = {"economy": "1", "premium_economy": "2", "business": "3", "first": "4"}

# Google Hotels amenity text -> the amenity codes used in data/mock_hotels.json.
AMENITIES = {
    "wi-fi": "wifi",
    "free breakfast": "breakfast_included",  # not "Breakfast ($)", which is paid
    "pool": "pool",
    "fitness": "gym",
    "gym": "gym",
    "airport shuttle": "airport_shuttle",
}


class LiveSearchError(Exception):
    """The live search couldn't run or returned an error; the message says why."""


_cache: dict[str, tuple[float, dict]] = {}


# ---- searching ----------------------------------------------------------------


def search(params: dict) -> dict:
    """Run SerpApi's `search` MCP tool with these engine params and return its JSON."""
    if not config.SERPAPI_API_KEY:
        raise LiveSearchError("SERPAPI_API_KEY is not set")
    key = json.dumps(params, sort_keys=True)
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]
    try:
        data = asyncio.run(_call_search_tool(params))
    except LiveSearchError:
        raise
    except Exception as e:
        raise LiveSearchError(_root_message(e)) from e
    _cache[key] = (time.monotonic(), data)
    return data


async def _call_search_tool(params: dict) -> dict:
    from mcp import ClientSession
    from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

    http = create_mcp_http_client(headers={"Authorization": f"Bearer {config.SERPAPI_API_KEY}"})
    async with (
        http,
        streamable_http_client(MCP_URL, http_client=http) as (read, write),
        ClientSession(read, write, read_timeout_seconds=60) as session,
    ):
        await session.initialize()
        result = await session.call_tool("search", {"params": params, "mode": "compact"})

    text = "".join(getattr(part, "text", "") for part in result.content)
    if result.is_error:
        raise LiveSearchError(text[:200] or "the search tool returned an error")
    data = (result.structured_content or {}).get("result", text)
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except ValueError:
            raise LiveSearchError(data[:200] or "the search tool returned no data") from None
    if isinstance(data, dict) and data.get("error"):
        raise LiveSearchError(str(data["error"]))
    return data


def _root_message(error: BaseException) -> str:
    # The MCP client wraps failures in nested ExceptionGroups; the first leaf says what broke.
    while isinstance(error, BaseExceptionGroup) and error.exceptions:
        error = error.exceptions[0]
    return str(error) or type(error).__name__


# ---- flights ------------------------------------------------------------------


def flights_for_trip(origin: str, destination: str, day: date, cabin_class: str | None) -> list[dict]:
    data = search(
        {
            "engine": "google_flights",
            "departure_id": origin,
            "arrival_id": destination,
            "outbound_date": day.isoformat(),
            "type": "2",  # one way: the optimizer prices the outbound flight only
            "travel_class": TRAVEL_CLASS.get(cabin_class or "economy", "1"),
            "currency": "INR",
            "gl": "in",
            "hl": "en",
        }
    )
    options = (data.get("best_flights") or []) + (data.get("other_flights") or [])
    return to_flights(options, origin, destination)


def to_flights(options: list[dict], origin: str, destination: str) -> list[dict]:
    flights: dict[str, dict] = {}
    for option in options:
        legs = option.get("flights") or []
        if not legs or not isinstance(option.get("price"), (int, float)):
            continue  # Google lists some itineraries without a fare; nothing to compare
        number = "+".join(leg.get("flight_number", "?").replace(" ", "") for leg in legs)
        flight = {
            "id": f"FL-{number}",
            "origin": origin,
            "destination": destination,
            "departure_time": _iso(legs[0]["departure_airport"]["time"]),
            "arrival_time": _iso(legs[-1]["arrival_airport"]["time"]),
            "airline": legs[0].get("airline", "Unknown airline"),
            "price": option["price"],
            "cabin_class": legs[0].get("travel_class", "Economy").lower().replace(" ", "_"),
            "stops": len(legs) - 1,
        }
        # The same flight can appear in both lists; keep its cheapest fare.
        if flight["id"] not in flights or flight["price"] < flights[flight["id"]]["price"]:
            flights[flight["id"]] = flight
    return list(flights.values())


def _iso(google_time: str) -> str:
    # "2026-11-12 05:30" -> "2026-11-12T05:30:00", the format mock_flights.json uses.
    return google_time.replace(" ", "T") + ":00"


# ---- hotels -------------------------------------------------------------------


def hotels_for_trip(destination: str, check_in: date, check_out: date) -> list[dict]:
    city = CITIES.get(destination)
    data = search(
        {
            "engine": "google_hotels",
            "q": f"hotels in {city[0]}" if city else f"hotels near {destination} airport",
            "check_in_date": check_in.isoformat(),
            "check_out_date": check_out.isoformat(),
            "adults": "1",
            "hotel_class": HOTEL_CLASSES,
            "sort_by": "3",  # lowest price first
            "currency": "INR",
            "gl": "in",
            "hl": "en",
        }
    )
    return to_hotels(data.get("properties") or [], destination)


def to_hotels(properties: list[dict], destination: str) -> list[dict]:
    city = CITIES.get(destination)
    hotels = []
    for prop in properties:
        price = (prop.get("rate_per_night") or {}).get("extracted_lowest")
        rating = prop.get("overall_rating")
        if not isinstance(price, (int, float)) or not isinstance(rating, (int, float)):
            continue  # without a nightly price and a rating the rules can't judge it
        gps = prop.get("gps_coordinates") or {}
        distance = None
        if city and "latitude" in gps and "longitude" in gps:
            distance = round(_km(city[1], city[2], gps["latitude"], gps["longitude"]), 1)
        token = prop.get("property_token") or prop.get("name", "")
        hotels.append(
            {
                "id": f"HT-{hashlib.sha1(token.encode()).hexdigest()[:8]}",
                "city": destination,
                "name": prop.get("name", "Unnamed hotel"),
                "price_per_night": price,
                "rating": rating,
                "amenities": _amenity_codes(prop.get("amenities") or []),
                "distance_to_center_km": distance,
            }
        )
    return hotels


def _amenity_codes(names: list[str]) -> list[str]:
    codes = []
    for name in names:
        lowered = name.lower()
        code = next((c for text, c in AMENITIES.items() if text in lowered), None)
        if code and code not in codes:
            codes.append(code)
    return codes


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Great-circle distance; close enough for "how far from the city centre".
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))
