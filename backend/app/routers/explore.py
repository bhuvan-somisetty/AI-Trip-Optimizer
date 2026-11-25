"""Explore a trip's destination: tourist attractions and restaurants (app/places.py), famous
local dishes (app/dishes.py), and day trips and famous hotels around the city (app/wikidata.py).

Kept apart from the optimizer on purpose: places never change a trip's prices, budget checks
or Trade-off Ledger.
"""
import logging
import math
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app import google_places, roads, wikidata
from app.database import get_session
from app.dishes import DishesUnavailable, local_dishes
from app.ground import search_ground
from app.models import CityPlaces, Trip
from app.places import PlacesUnavailable, explore_city
from app.routers.trips import get_owned_trip, saved_itinerary
from app.journeys import DEFAULT_VALUE_OF_TIME
from app.routing import haversine_m, path_to, road_matrix, visiting_order
from app.travel_data import CITIES, PLACES, TravelDataError, country_name

router = APIRouter(tags=["explore"])
logger = logging.getLogger(__name__)

# Bumped when dishes changed shape: version 2 keeps only dishes with a Wikipedia article on them.
DISHES_VERSION = 2


def dishes_for(session: Session, city: str) -> tuple[list[dict], str | None]:
    """The city's dishes and, when there are none, why. Saved with the city's places, so the
    AI and Wikipedia are asked once per city; a failure is not saved, so it is retried."""
    row = session.get(CityPlaces, city)
    if row is not None and "dishes" in (row.payload or {}) and row.payload.get("dishes_version") == DISHES_VERSION:
        return row.payload["dishes"], None
    if city not in CITIES:
        return [], f"Local dishes don't know the city for airport {city} yet"
    name, country = CITIES[city]
    try:
        found = local_dishes(name, country_name(country))
    except DishesUnavailable as e:
        return [], str(e)
    except Exception:
        logger.warning("Local dishes failed for %s", city, exc_info=True)
        return [], "Local dishes couldn't be loaded right now, please try again"
    if not found:
        return [], "No famous dishes with a Wikipedia article were found for this city"
    if row is not None:
        row.payload = {**row.payload, "dishes": found, "dishes_version": DISHES_VERSION}
        session.add(row)
        session.commit()
    return found, None


SAME_PLACE_M = 1500  # a day trip this close to a listed attraction is the same place


def around_city(city: str, centre: dict | None, attractions: list[dict]) -> dict:
    """Day trips (famous places 15 to 150 km away) and famous hotels around the city centre
    (the airport when the centre isn't known), without the attractions already listed."""
    airport = PLACES.get(city)
    point = centre or (airport and {"latitude": airport["latitude"], "longitude": airport["longitude"]})
    if not point:
        return {"day_trips": [], "famous_stays": [], "around_source": None, "around_from": None, "around_notice": None}
    lat, lon = point["latitude"], point["longitude"]
    with ThreadPoolExecutor(max_workers=2) as pool:
        trips, stays = pool.map(lambda kind: wikidata.around(kind, lat, lon), ("day_trip", "stay"))
    names = {(a.get("name") or "").strip().lower() for a in attractions}

    def listed(p: dict) -> bool:
        if p["name"].strip().lower() in names:
            return True
        return p["latitude"] is not None and any(
            a.get("latitude") is not None and a.get("longitude") is not None
            and haversine_m(p["latitude"], p["longitude"], a["latitude"], a["longitude"]) < SAME_PLACE_M
            for a in attractions
        )

    return {
        "day_trips": [p for p in trips[0] if not listed(p)],
        "famous_stays": stays[0],
        "around_source": wikidata.SOURCE,
        "around_from": "the city centre" if centre else "the airport",
        "around_notice": trips[1] or stays[1],
    }


def destination_view(session: Session, city: str) -> dict:
    """A city's attractions (each in its "explore" or "history_culture" section), restaurants,
    food markets and dishes. Restaurants get Google's photo, rating and hours when Google Places
    is set up (never cached). When places can't be fetched, the lists are empty and `notice`
    says why; nothing is ever made up."""
    empty = {
        "city": city,
        "city_name": CITIES.get(city, (city, ""))[0],
        "attractions": [],
        "restaurants": [],
        "food_spots": [],
        "source": None,
        "fetched_at": None,
        "cached": False,
    }
    try:
        result = {**empty, **explore_city(session, city), "notice": None}
    except PlacesUnavailable as e:
        result = {**empty, "notice": str(e)}
    except TravelDataError as e:
        result = {**empty, "notice": f"Tourist places couldn't be loaded right now: {e}"}
    result["restaurants"], result["google_notice"] = google_places.enrich(result["restaurants"], result["city_name"])
    dishes, dishes_notice = dishes_for(session, city)
    around = around_city(city, result.get("centre"), result["attractions"])
    return {**result, "dishes": dishes, "dishes_notice": dishes_notice, **around}


@router.get("/trips/{trip_id}/explore")
def explore_trip(trip: Trip = Depends(get_owned_trip), session: Session = Depends(get_session)):
    """The trip destination's places, restaurants, food markets and dishes (destination_view)."""
    return destination_view(session, trip.destination)


MAX_PATH_POINTS = 150  # per leg, enough for a map line, small enough to send


def thin(points: list[list[float]]) -> list[list[float]]:
    if len(points) <= MAX_PATH_POINTS:
        return points
    step = math.ceil(len(points) / MAX_PATH_POINTS)
    return points[::step] + [points[-1]]


def along(graph: dict, path: list[int]) -> float:
    """Total weight of a path: the lightest edge between each pair of consecutive nodes."""
    return sum(min(w for n, w in graph.get(a, []) if n == b) for a, b in zip(path, path[1:]))


@router.get("/trips/{trip_id}/route")
def route_trip(
    stops: int = Query(default=6, ge=1, le=10),
    trip: Trip = Depends(get_owned_trip),
    session: Session = Depends(get_session),
):
    """Shortest road routes from the trip's hotel to its top attractions (Dijkstra on the real
    OpenStreetMap road network), and a visiting order: the nearest attraction by road next.

    Every leg gives its real road metres; no driving time is guessed. When a route can't be
    built, `notice` says why and nothing is made up."""
    result = {"city": trip.destination, "hotel": None, "stops": [], "legs": [], "total_road_m": None,
              "unreachable": [], "source": roads.SOURCE, "data_label": "Map data", "notice": None}
    itinerary = saved_itinerary(session, trip)
    hotel = itinerary.hotel if itinerary else None
    if not hotel:
        return {**result, "notice": "Optimize the trip first: the route starts at its hotel"}
    if hotel.get("latitude") is None or hotel.get("longitude") is None:
        return {**result, "notice": "This trip's hotel has no map location; optimize the trip again"}
    try:
        places = explore_city(session, trip.destination)
    except TravelDataError as e:
        return {**result, "notice": f"Attractions couldn't be loaded: {e}"}
    sights = [a for a in places["attractions"] if a.get("latitude") is not None][:stops]
    if not sights:
        return {**result, "notice": "No attractions with a map location were found for this city"}

    points = [(hotel["latitude"], hotel["longitude"])] + [(a["latitude"], a["longitude"]) for a in sights]
    names = [hotel["name"]] + [a["name"] for a in sights]
    try:
        graph = roads.road_graph(points)
    except TravelDataError as e:
        return {**result, "notice": str(e)}
    snapped = [graph.nearest(lat, lon) for lat, lon in points]
    nodes = [node for node, _ in snapped]
    matrix, prevs = road_matrix(graph.graph, nodes)
    order = visiting_order(matrix)

    legs, from_hotel = [], {}
    for a, b in zip(order, order[1:]):
        path = path_to(prevs[a], nodes[a], nodes[b])
        legs.append({
            "from": names[a],
            "to": names[b],
            "road_m": round(along(graph.graph, path)),
            "straight_m": round(haversine_m(*points[a], *points[b])),
            "path": thin([list(graph.coords[n]) for n in path]),
        })
    for i in order[1:]:
        from_hotel[i] = round(along(graph.graph, path_to(prevs[0], nodes[0], nodes[i])))
    hotel_out = {"name": hotel["name"], "latitude": hotel["latitude"], "longitude": hotel["longitude"],
                 "to_road_m": round(snapped[0][1])}
    stops_out = [
        {"order": position, "name": sights[i - 1]["name"], "category": sights[i - 1].get("category"),
         "latitude": points[i][0], "longitude": points[i][1], "to_road_m": round(snapped[i][1]),
         "road_m_from_hotel": from_hotel[i]}
        for position, i in enumerate(order[1:], start=1)
    ]
    return {
        **result,
        "hotel": hotel_out,
        "stops": stops_out,
        "legs": legs,
        "total_road_m": round(sum(leg["road_m"] for leg in legs)),
        "unreachable": [names[i] for i in range(1, len(names)) if i not in order],
    }


def flight_option(flight: dict | None) -> dict | None:
    if not flight or flight.get("mode") in ("train", "bus"):
        return None  # a trip by train or bus: its trains and buses are listed already
    departs = (flight.get("departure_time") or "")[11:16] or None
    arrives = (flight.get("arrival_time") or "")[11:16] or None
    return {
        "kind": "flight",
        "service": " ".join(x for x in (flight.get("airline"), flight.get("flight_number")) if x) or flight.get("id"),
        "departs": departs,
        "arrives": arrives,
        "duration_minutes": flight.get("duration_minutes"),
        "stops": flight.get("stops"),
        "fare": flight.get("price"),
        "currency": flight.get("currency") or "INR",
        "fare_label": "Flight fare used by the optimizer",
        "source": flight.get("source"),
        "data_label": "Live" if flight.get("price_status") == "live" else "Cached",
    }


def access(code: str) -> dict | None:
    """How a trip end is reached: its nearest airport, railway station and bus station, with distances."""
    p = PLACES.get(code)
    if p is None:
        return None
    return {"code": code, "name": p["city"], "state": p.get("state"), "serves": p["serves"],
            "airport": {"code": p["airport_code"], "name": p.get("airport"), "km": p["airport_km"]},
            "station": p.get("station"), "bus_station": p.get("bus_station")}


def recommended(rows: list[dict]) -> dict | None:
    """The row to take: the best balance of fare and time among the ones with a fare, counting each
    hour of travel as DEFAULT_VALUE_OF_TIME rupees (the journeys search's "best value"); the fastest
    when no row has a fare to compare."""
    priced = [r for r in rows if r["fare"] is not None and r["duration_minutes"] is not None]
    if priced:
        best = min(priced, key=lambda r: r["fare"] + DEFAULT_VALUE_OF_TIME * r["duration_minutes"] / 60)
        cheapest = min(priced, key=lambda r: r["fare"])
        why = ("cheapest and quick enough" if best is cheapest else
               f"worth the extra over the {cheapest['mode'].lower()} for the time it saves")
        return {"mode": best["mode"], "reason": f"Best value: {why}, counting each hour of travel as "
                                                f"Rs {DEFAULT_VALUE_OF_TIME:,}"}
    timed = [r for r in rows if r["duration_minutes"] is not None]
    if timed:
        best = min(timed, key=lambda r: r["duration_minutes"])
        return {"mode": best["mode"], "reason": "Fastest; no fares are published to compare"}
    return None


@router.get("/trips/{trip_id}/transport")
def transport_trip(trip: Trip = Depends(get_owned_trip), session: Session = Depends(get_session)):
    """Flight, train, bus and ferry for the trip's outbound day, side by side.

    Trains, buses and ferries come from Google Maps transit (via SerpApi), for any two cities:
    real services with times and durations. A fare is shown only when Google gives one, otherwise
    it is null and labelled "Not available". Kept apart from the optimizer: it never changes the
    itinerary or its total."""
    itinerary = saved_itinerary(session, trip)
    flight = flight_option(itinerary.flight if itinerary else None)
    result = {"origin": trip.origin, "destination": trip.destination, "date": trip.start_date.isoformat(),
              "flight": flight, "trains": [], "buses": [], "ferries": [], "comparison": [],
              "recommended": None, "notice": None,
              "access": {"origin": access(trip.origin), "destination": access(trip.destination)}}
    try:
        options = search_ground(trip.origin, trip.destination, trip.start_date)
    except TravelDataError as e:
        options, result["notice"] = [], str(e)
    trains = [o for o in options if o["kind"] == "train"]
    buses = [o for o in options if o["kind"] == "bus"]
    ferries = [o for o in options if o["kind"] == "ferry"]
    fastest = lambda items: min((o for o in items if o["duration_minutes"] is not None),
                                key=lambda o: o["duration_minutes"], default=None)
    rows = [("Flight", flight), ("Train", fastest(trains)), ("Bus", fastest(buses)),
            ("Ferry", fastest(ferries))]
    result["comparison"] = [
        {"mode": mode, "service": o["service"], "departs": o["departs"], "duration_minutes": o["duration_minutes"],
         "fare": o["fare"], "currency": o["currency"], "fare_label": o["fare_label"]}
        for mode, o in rows if o
    ]
    result["recommended"] = recommended(result["comparison"])
    if not options and result["notice"] is None:
        result["notice"] = "Google Maps lists no trains, buses or ferries for this route and day"
    return {**result, "trains": trains, "buses": buses, "ferries": ferries}
