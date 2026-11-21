"""Trains and buses between two Indian cities, from Google Maps transit via SerpApi.

SerpApi's google_maps_directions engine with travel_mode=3 (transit) returns Google Maps'
public-transport routes: for Indian intercity trips these are real trains (number, name,
"Indian Railways", station codes) and buses (e.g. FlixBus), with departure and arrival times,
duration and distance. It uses the same SERPAPI_API_KEY as flights and hotels: one search per
route and day, cached like the other searches.

What is never invented: the vehicle kind comes from Google's own icon (rail / bus), the operator
from `service_run_by`, the fare only from Google's `cost` + `currency` on the rare routes that
carry one ("Google Maps fare"); everywhere else the fare is None and labelled "Not available".
"""
from datetime import date, datetime, timedelta, timezone

from app import config
from app.travel_data import CITIES, SERPAPI_NO_RESULTS, SERPAPI_URL, TravelDataError, _cached, _request

IST = timezone(timedelta(hours=5, minutes=30))
DEPART_HOUR = 5  # search from early morning of the trip's first day, local time
SOURCE = "Google Maps transit via SerpApi"


class GroundUnavailable(TravelDataError):
    """Trains and buses can't be searched for this trip (abroad, unknown city, no key)."""


def kind_of(trip: dict) -> str | None:
    # Google's own vehicle icon for the leg: .../rail2.svg, .../bus2.svg, .../subway2.svg ...
    icon = (trip.get("icon") or "").rsplit("/", 1)[-1]
    if icon.startswith(("rail", "train", "subway", "tram")):
        return "train"
    if icon.startswith("bus"):
        return "bus"
    return None


def _minutes(seconds) -> int | None:
    return round(seconds / 60) if isinstance(seconds, (int, float)) else None


def _stop(stop: dict | None) -> dict:
    stop = stop or {}
    return {"name": stop.get("name"), "code": stop.get("stop_id"), "time": (stop.get("time") or "").replace(" ", " ") or None}


def option(direction: dict, index: int) -> dict | None:
    """One route: its main vehicle (the longest transit leg) decides train or bus."""
    legs = [t for t in direction.get("trips") or [] if t.get("travel_mode") == "Transit"]
    if not legs:
        return None
    main = max(legs, key=lambda t: t.get("duration") or 0)
    kind = kind_of(main)
    if kind is None:
        return None
    cost, currency = direction.get("cost"), direction.get("currency")
    has_fare = isinstance(cost, (int, float)) and currency
    return {
        "id": f"GT-{index}",
        "kind": kind,
        "service": main.get("title"),
        "operator": (main.get("service_run_by") or {}).get("name"),
        "from": _stop(main.get("start_stop")),
        "to": _stop(main.get("end_stop")),
        "departs": (direction.get("start_time") or "").replace(" ", " ") or None,
        "arrives": (direction.get("end_time") or "").replace(" ", " ") or None,
        "duration_minutes": _minutes(direction.get("duration")),
        "distance_km": round(direction["distance"] / 1000) if isinstance(direction.get("distance"), (int, float)) else None,
        "changes": len(legs) - 1,
        "legs": [
            {"service": t.get("title"), "kind": kind_of(t), "from": _stop(t.get("start_stop")),
             "to": _stop(t.get("end_stop")), "duration_minutes": _minutes(t.get("duration"))}
            for t in legs
        ],
        "fare": float(cost) if has_fare else None,
        "currency": currency if has_fare else None,
        "fare_label": "Google Maps fare (may differ by class)" if has_fare else "Not available",
        "source": SOURCE,
        "data_label": "Live schedule",
    }


def search_ground(origin: str, destination: str, day: date) -> list[dict]:
    """Trains and buses from `origin` to `destination` (IATA codes of Indian cities) on `day`."""
    if not config.SERPAPI_API_KEY:
        raise GroundUnavailable("Train and bus search isn't set up on the server (no SERPAPI_API_KEY)")
    if origin not in CITIES or destination not in CITIES:
        raise GroundUnavailable("Trains and buses are only searched between the app's Indian cities")
    (from_city, from_country), (to_city, to_country) = CITIES[origin], CITIES[destination]
    if from_country != "IN" or to_country != "IN":
        raise GroundUnavailable("Trains and buses are only searched within India")
    depart = int(datetime(day.year, day.month, day.day, DEPART_HOUR, tzinfo=IST).timestamp())
    params = {
        "engine": "google_maps_directions",
        "start_addr": f"{from_city}, India",
        "end_addr": f"{to_city}, India",
        "travel_mode": 3,
        "time": f"depart_at:{depart}",
        "hl": "en",
        "gl": "in",
        "api_key": config.SERPAPI_API_KEY,
    }

    def fetch():
        body = _request("SerpApi", "GET", SERPAPI_URL, params=params)
        error = body.get("error")
        if error and SERPAPI_NO_RESULTS in error:
            return {}
        if error:
            raise TravelDataError(f"Train and bus search failed: {error}")
        return body

    body = _cached(("ground", origin, destination, day.isoformat()), fetch)
    options = [option(d, i) for i, d in enumerate(body.get("directions") or [], start=1)]
    return [o for o in options if o is not None]
