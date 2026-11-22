"""Trains, buses and ferries between any two of the app's cities, from Google Maps transit via SerpApi.

SerpApi's google_maps_directions engine with travel_mode=3 (transit) returns Google Maps'
public-transport routes wherever Google has them: Indian Railways trains with number, name and
station codes, FlixBus and state buses, Eurostar, ferries, and so on, with departure and arrival
times, duration and distance. It uses the same SERPAPI_API_KEY as flights and hotels.

Google answers with the next few departures after a given time, so the trip's first day is
searched from three local times (early morning, midday, evening, in the origin airport's own
time zone) and the answers are merged without repeats: night trains and buses are included.
That is up to three searches per route and day, each cached like the other searches.

What is never invented: the vehicle kind comes from Google's own icon (rail / bus / ferry), the
operator from `service_run_by`, the fare only from Google's `cost` + `currency` on the routes that
carry one ("Google Maps fare"); everywhere else the fare is None and labelled "Not available".
A route Google has no public transport for (e.g. across an ocean) comes back empty.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app import config
from app.travel_data import (
    AIRPORTS, SERPAPI_NO_RESULTS, SERPAPI_URL, TravelDataError, _cached, _request, country_name,
)

DEPART_HOURS = (5, 12, 19)  # local times the day is searched from: morning, midday, evening
SOURCE = "Google Maps transit via SerpApi"
KINDS = {  # Google's icon file name starts with one of these
    "train": ("rail", "train", "subway", "metro", "tram", "monorail", "funicular"),
    "bus": ("bus", "trolleybus", "coach"),
    "ferry": ("ferry", "boat"),
}


class GroundUnavailable(TravelDataError):
    """Trains and buses can't be searched for this trip (unknown city, same city, no key)."""


def kind_of(trip: dict) -> str | None:
    # Google's own vehicle icon for the leg: .../rail2.svg, .../bus2.svg, .../ferry2.svg ...
    icon = (trip.get("icon") or "").rsplit("/", 1)[-1].lower()
    for kind, prefixes in KINDS.items():
        if icon.startswith(prefixes):
            return kind
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


def local_timestamp(day: date, hour: int, zone: str | None) -> int:
    """Unix time of `hour`:00 on `day` in the airport's time zone (UTC if it has none)."""
    try:
        tz = ZoneInfo(zone) if zone else timezone.utc
    except (ZoneInfoNotFoundError, ValueError):
        tz = timezone.utc
    return int(datetime(day.year, day.month, day.day, hour, tzinfo=tz).timestamp())


def clock(text: str | None) -> time | None:
    """Google's "6:40 AM" as a time of day; None when it isn't one."""
    try:
        return datetime.strptime((text or "").strip().upper(), "%I:%M %p").time()
    except ValueError:
        return None


def scheduled(route: dict, day: date, from_hour: int) -> dict:
    """Adds the local departure and arrival date-times, so connections can be checked.

    Google answers with departures after the searched time, so one earlier in the day than
    that (by more than half an hour) is the next morning's. Arrival is departure + duration."""
    start = clock(route.get("departs"))
    if start is None or route.get("duration_minutes") is None:
        return {**route, "departure_time": None, "arrival_time": None}
    departure = datetime.combine(day, start)
    if start.hour * 60 + start.minute < from_hour * 60 - 30:
        departure += timedelta(days=1)
    arrival = departure + timedelta(minutes=route["duration_minutes"])
    return {**route, "departure_time": departure.isoformat(), "arrival_time": arrival.isoformat()}


# Where a traveller can check fares and book. Plain links to the provider's own site: no booking,
# availability or price is read from them, and none is shown for operators we don't know.
PROVIDERS = (
    ("indian railways", "https://www.irctc.co.in/nget/train-search", "Check fares on IRCTC"),
    ("flixbus", "https://www.flixbus.com", "Check fares on FlixBus"),
    ("eurostar", "https://www.eurostar.com", "Check fares on Eurostar"),
)
REDBUS = ("https://www.redbus.in", "Check buses on redBus")


def provider_link(route: dict, country: str) -> dict:
    """The operator's booking site when we know it (IRCTC, FlixBus, Eurostar; redBus for other
    buses in India), else no link."""
    text = f"{route.get('operator') or ''} {route.get('service') or ''}".lower()
    for name, url, label in PROVIDERS:
        if name in text:
            return {"link": url, "link_label": label}
    if route.get("kind") == "train" and country == "IN":
        return {"link": PROVIDERS[0][1], "link_label": PROVIDERS[0][2]}
    if route.get("kind") == "bus" and country == "IN":
        return {"link": REDBUS[0], "link_label": REDBUS[1]}
    return {"link": None, "link_label": None}


def place(airport: dict) -> str:
    return f"{airport['city']}, {country_name(airport['country'])}"


def search_ground(origin: str, destination: str, day: date, hours: tuple[int, ...] = DEPART_HOURS) -> list[dict]:
    """Trains, buses and ferries from `origin` to `destination` (airport codes) on `day`.

    `hours` are the local times the day is searched from (one SerpApi search each)."""
    if not config.SERPAPI_API_KEY:
        raise GroundUnavailable("Train and bus search isn't set up on the server (no SERPAPI_API_KEY)")
    start, end = AIRPORTS.get(origin), AIRPORTS.get(destination)
    if start is None or end is None:
        raise GroundUnavailable("Trains and buses can only be searched between known airport cities")
    if place(start) == place(end):
        raise GroundUnavailable("The origin and destination are the same city")

    def fetch(hour):
        params = {
            "engine": "google_maps_directions",
            "start_addr": place(start),
            "end_addr": place(end),
            "travel_mode": 3,
            "time": f"depart_at:{local_timestamp(day, hour, start.get('timezone'))}",
            "hl": "en",
            "gl": start["country"].lower(),
            "api_key": config.SERPAPI_API_KEY,
        }
        body = _request("SerpApi", "GET", SERPAPI_URL, params=params)
        error = body.get("error")
        if error and SERPAPI_NO_RESULTS in error:
            return {}
        if error:
            raise TravelDataError(f"Train and bus search failed: {error}")
        return body

    found, seen = [], set()
    for hour in hours:
        body = _cached(("ground", origin, destination, day.isoformat(), hour), lambda: fetch(hour))
        for direction in body.get("directions") or []:
            route = option(direction, 0)
            if route is None:
                continue
            route = scheduled(route, day, hour)
            key = (route["service"], route["departs"], route["from"]["name"])
            if key in seen:
                continue  # the same departure, found again from a later search time
            seen.add(key)
            found.append({**route, **provider_link(route, start["country"]), "id": f"GT-{len(found) + 1}"})
    return found
