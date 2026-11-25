"""Dijkstra (app/routing.py), the OpenStreetMap road graph (app/roads.py) and GET /trips/{id}/route.

No network: Overpass and OpenTripMap are replaced by canned data.
"""
import math
import random
import uuid

import pytest

from app import roads
from app.database import get_session
from app.main import app
from app.models import Itinerary
from app.routing import dijkstra, haversine_m, path_to, road_matrix, visiting_order
from sqlmodel import select

# A small road map, metres on each edge:
#   A --4-- B --1-- C
#   |               |
#   +------10-------D      and E alone (no road)
SMALL = {
    "A": [("B", 4), ("D", 10)],
    "B": [("A", 4), ("C", 1)],
    "C": [("B", 1), ("D", 2)],
    "D": [("A", 10), ("C", 2)],
    "E": [],
}


def test_dijkstra_finds_the_shortest_road_not_the_fewest_hops():
    dist, prev = dijkstra(SMALL, "A")
    assert dist == {"A": 0, "B": 4, "C": 5, "D": 7}  # A-B-C-D = 7 beats the direct A-D road of 10
    assert path_to(prev, "A", "D") == ["A", "B", "C", "D"]
    assert "E" not in dist and path_to(prev, "A", "E") == []
    assert path_to(prev, "A", "A") == ["A"]


def test_one_way_roads_are_followed_in_their_direction_only():
    one_way = {"A": [("B", 1)], "B": [("C", 1)], "C": [("A", 1)]}  # a loop you can only drive one way
    dist, _ = dijkstra(one_way, "A")
    assert dist["C"] == 2  # A -> B -> C
    back, _ = dijkstra(one_way, "C")
    assert back["B"] == 2  # C -> A -> B, the long way round


def bellman_ford(graph, source):
    nodes = set(graph) | {b for edges in graph.values() for b, _ in edges}
    dist = {n: math.inf for n in nodes}
    dist[source] = 0
    for _ in range(len(nodes) - 1):
        for a, edges in graph.items():
            for b, w in edges:
                if dist[a] + w < dist[b]:
                    dist[b] = dist[a] + w
    return {n: d for n, d in dist.items() if d < math.inf}


def test_dijkstra_matches_a_brute_force_method_on_random_road_maps():
    rng = random.Random(7)
    for _ in range(25):
        n = rng.randint(5, 40)
        graph = {i: [] for i in range(n)}
        for _ in range(n * 3):
            a, b = rng.randrange(n), rng.randrange(n)
            graph[a].append((b, rng.uniform(1, 500)))
        dist, _ = dijkstra(graph, 0)
        expected = bellman_ford(graph, 0)
        assert dist.keys() == expected.keys()
        assert all(abs(dist[k] - expected[k]) < 1e-6 for k in dist)


def test_road_matrix_and_nearest_next_visiting_order():
    matrix, _ = road_matrix(SMALL, ["A", "D", "B", "E"])
    assert matrix[0] == [0, 7, 4, math.inf]
    # From A: B (4) first, then D (3 from B), and E has no road at all.
    assert visiting_order(matrix) == [0, 2, 1]


def test_haversine_is_the_straight_distance():
    assert haversine_m(28.6562, 77.2410, 28.6562, 77.2410) == 0
    assert 13_000 < haversine_m(28.6562, 77.2410, 28.5245, 77.1855) < 16_000  # Red Fort to Qutub Minar


# ---- the OpenStreetMap road graph ---------------------------------------------------

ELEMENTS = [
    {"type": "way", "id": 1, "nodes": [10, 11, 12], "tags": {"highway": "primary"}},
    {"type": "way", "id": 2, "nodes": [12, 13], "tags": {"highway": "residential", "oneway": "yes"}},
    {"type": "way", "id": 3, "nodes": [13, 10], "tags": {"highway": "residential", "oneway": "-1"}},
    {"type": "way", "id": 4, "nodes": [20, 21], "tags": {"highway": "residential"}},  # cut off from the rest
    {"type": "node", "id": 10, "lat": 15.500, "lon": 73.820},
    {"type": "node", "id": 11, "lat": 15.501, "lon": 73.820},
    {"type": "node", "id": 12, "lat": 15.502, "lon": 73.821},
    {"type": "node", "id": 13, "lat": 15.502, "lon": 73.823},
    {"type": "node", "id": 20, "lat": 15.600, "lon": 73.900},
    {"type": "node", "id": 21, "lat": 15.601, "lon": 73.900},
]


def test_roads_become_weighted_edges_respecting_one_way_tags():
    built = roads.build_graph(ELEMENTS)
    targets = lambda n: sorted(b for b, _ in built.graph.get(n, []))
    # way 3 lists 13 then 10 with oneway=-1, so traffic runs against that order: 10 -> 13 only.
    assert targets(10) == [11, 13]
    assert targets(12) == [11, 13]  # way 2 is oneway=yes: 12 -> 13 only
    assert targets(13) == []  # both its roads are one-way into it
    weight = dict(built.graph[10])[11]
    assert weight == pytest.approx(haversine_m(15.500, 73.820, 15.501, 73.820))


def test_stops_snap_only_to_the_main_road_network():
    built = roads.build_graph(ELEMENTS)
    assert built.main == {10, 11, 12, 13}
    node, metres = built.nearest(15.5995, 73.9)  # right next to the cut-off road 20-21
    assert node in built.main and metres > 1000


def test_road_query_covers_the_stops_with_a_margin(monkeypatch):
    asked = []
    monkeypatch.setattr(roads, "_cache", {})
    monkeypatch.setattr(roads, "fetch_elements", lambda *box: asked.append(box) or ELEMENTS)
    roads.road_graph([(15.5, 73.82), (15.502, 73.823)])
    roads.road_graph([(15.5, 73.82), (15.502, 73.823)])
    assert len(asked) == 1  # the second call is served from the cache
    south, west, north, east = asked[0]
    assert south == pytest.approx(15.49) and north == pytest.approx(15.512)
    assert '"highway"' in roads.query(south, west, north, east)


# ---- GET /trips/{id}/route ----------------------------------------------------------

@pytest.fixture
def db(client):
    sessions = app.dependency_overrides[get_session]()
    yield next(sessions)
    sessions.close()


def optimized_trip(client, headers, payload):
    trip_id = client.post("/trip", json=payload, headers=headers).json()["id"]
    client.post(f"/trips/{trip_id}/optimize", headers=headers)
    return trip_id


def place_hotel(db, trip_id, lat=15.500, lon=73.820):
    itinerary = db.exec(select(Itinerary).where(Itinerary.trip_id == uuid.UUID(trip_id))).one()
    itinerary.hotel = {**itinerary.hotel, "latitude": lat, "longitude": lon}
    db.add(itinerary)
    db.commit()


SIGHTS = {"attractions": [
    {"name": "Old Fort", "category": "Fort", "latitude": 15.502, "longitude": 73.823},
    {"name": "Riverside Church", "category": "Religious site", "latitude": 15.501, "longitude": 73.8201},
    {"name": "No Location Temple", "category": "Religious site", "latitude": None, "longitude": None},
]}


@pytest.fixture
def mapped(monkeypatch):
    import app.routers.explore as explore
    monkeypatch.setattr(explore, "explore_city", lambda session, city: SIGHTS)
    monkeypatch.setattr(roads, "_cache", {})
    monkeypatch.setattr(roads, "fetch_elements", lambda *box: ELEMENTS)


def test_route_orders_attractions_by_road_from_the_hotel(client, db, auth_headers, trip_payload, mapped):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    place_hotel(db, trip_id)
    body = client.get(f"/trips/{trip_id}/route", headers=auth_headers).json()
    assert body["notice"] is None and body["data_label"] == "Map data"
    assert [s["name"] for s in body["stops"]] == ["Riverside Church", "Old Fort"]
    first, second = body["legs"]
    assert first["from"] == body["hotel"]["name"] and first["to"] == "Riverside Church"
    assert second["from"] == "Riverside Church" and second["to"] == "Old Fort"
    # Road metres run between the nearest road points, straight metres between the exact places,
    # so a place a few metres off the road can make them differ either way by that much.
    assert first["road_m"] > 0 and abs(first["road_m"] - first["straight_m"]) < 50
    assert len(first["path"]) >= 2 and body["stops"][0]["to_road_m"] < 50
    assert body["total_road_m"] == first["road_m"] + second["road_m"]
    assert "OpenStreetMap" in body["source"]


def test_route_needs_an_optimized_trip(client, auth_headers, trip_payload, mapped):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    body = client.get(f"/trips/{trip_id}/route", headers=auth_headers).json()
    assert body["stops"] == [] and "Optimize the trip first" in body["notice"]


def test_route_needs_the_hotels_map_location(client, auth_headers, trip_payload, mapped):
    trip_id = optimized_trip(client, auth_headers, trip_payload)  # fixture hotels have no coordinates
    body = client.get(f"/trips/{trip_id}/route", headers=auth_headers).json()
    assert "no map location" in body["notice"]


def test_route_says_when_roads_cannot_be_loaded(client, db, auth_headers, trip_payload, mapped, monkeypatch):
    from app.travel_data import TravelDataError

    def busy(*box):
        raise TravelDataError("OpenStreetMap roads are busy right now, please wait a minute and try again")
    monkeypatch.setattr(roads, "fetch_elements", busy)
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    place_hotel(db, trip_id)
    body = client.get(f"/trips/{trip_id}/route", headers=auth_headers).json()
    assert body["legs"] == [] and "busy" in body["notice"]


def test_route_of_another_users_trip_is_404(client, auth_headers, other_headers, trip_payload, mapped):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert client.get(f"/trips/{trip_id}/route", headers=other_headers).status_code == 404
    assert client.get(f"/trips/{trip_id}/route", headers=auth_headers, params={"stops": 11}).status_code == 422


def test_route_gives_real_road_metres_and_no_guessed_driving_time(client, db, auth_headers, trip_payload, mapped):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    place_hotel(db, trip_id)
    body = client.get(f"/trips/{trip_id}/route", headers=auth_headers).json()
    assert body["notice"] is None and all(leg["road_m"] > 0 for leg in body["legs"])
    assert all("estimated_minutes" not in leg for leg in body["legs"])
    assert "total_estimated_minutes" not in body and "weight" not in body
