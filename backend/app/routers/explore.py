"""Explore a trip's destination: tourist attractions and restaurants (app/places.py) and
famous local dishes (app/dishes.py).

Kept apart from the optimizer on purpose: places never change a trip's prices, budget checks
or Trade-off Ledger.
"""
import logging
import math
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app import google_places, roads
from app.database import get_session
from app.dishes import DishesUnavailable, local_dishes
from app.ground import search_ground
from app.models import CityPlaces, Trip
from app.places import PlacesUnavailable, explore_city
from app.routers.trips import get_owned_trip, saved_itinerary
from app.routing import haversine_m, path_to, road_matrix, visiting_order
from app.travel_data import CITIES, TravelDataError, country_name

router = APIRouter(tags=["explore"])
logger = logging.getLogger(__name__)

def dishes_for(session: Session, city: str) -> tuple[list[dict], str | None]:
    """The city's dishes and, when there are none, why. Saved with the city's places, so the
    AI and Wikipedia are asked once per city; a failure is not saved, so it is retried."""
    row = session.get(CityPlaces, city)
    if row is not None and "dishes" in (row.payload or {}):
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
        return [], "The AI model gave no usable dish suggestions, please try again"
    if row is not None:
        row.payload = {**row.payload, "dishes": found}
        session.add(row)
        session.commit()
    return found, None


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
    return {**result, "dishes": dishes, "dishes_notice": dishes_notice}


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
    weight: Literal["distance", "time"] = Query(default="distance", description="What Dijkstra minimises"),
    trip: Trip = Depends(get_owned_trip),
    session: Session = Depends(get_session),
):
    """Shortest road routes from the trip's hotel to its top attractions (Dijkstra on the real
    OpenStreetMap road network), and a visiting order: the nearest attraction by road next.

    `weight=distance` (default) minimises road metres; `weight=time` minimises estimated driving
    time (speed limits where mapped, typical speeds by road class otherwise). Every leg gives both
    its road metres and its estimated minutes; the minutes are an estimate, not traffic data.
    When a route can't be built, `notice` says why and nothing is made up."""
    result = {"city": trip.destination, "weight": weight, "hotel": None, "stops": [], "legs": [], "total_road_m": None,
              "total_estimated_minutes": None, "unreachable": [], "source": roads.SOURCE, "data_label": "Map data",
              "time_label": "Estimated from speed limits and typical road speeds, not live traffic", "notice": None}
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
    weighted = graph.time_graph if weight == "time" else graph.graph
    matrix, prevs = road_matrix(weighted, nodes)
    order = visiting_order(matrix)

    legs, from_hotel = [], {}
    for a, b in zip(order, order[1:]):
        path = path_to(prevs[a], nodes[a], nodes[b])
        legs.append({
            "from": names[a],
            "to": names[b],
            "road_m": round(along(graph.graph, path)),
            "estimated_minutes": round(along(graph.time_graph, path) / 60, 1),
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
        "total_estimated_minutes": round(sum(leg["estimated_minutes"] for leg in legs), 1),
        "unreachable": [names[i] for i in range(1, len(names)) if i not in order],
    }


def flight_option(flight: dict | None) -> dict | None:
    if not flight:
        return None
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
              "notice": None}
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
    if not options and result["notice"] is None:
        result["notice"] = "Google Maps lists no trains, buses or ferries for this route and day"
    return {**result, "trains": trains, "buses": buses, "ferries": ferries}
