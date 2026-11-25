"""Any Indian city or town as a trip end: the OpenStreetMap place list, search per way of travel,
the nearest airport for flights, and Google Maps' text for trains and buses."""
from datetime import date

from app import ground, travel_data
from app.pipeline import graph
from app.routers.explore import recommended
from app.travel_data import INDIA_PLACES, PLACES, flight_airport, place_label, search_places


def codes(q, mode, n=5):
    return [p["code"] for p in search_places(q, mode, n)]


def test_thousands_of_indian_places_with_their_nearest_services():
    assert len(INDIA_PLACES) > 5000
    ayodhya = INDIA_PLACES["ayodhya"]
    assert ayodhya["state"] == "Uttar Pradesh" and ayodhya["serves"] == ["flight", "train", "bus"]
    assert ayodhya["airport_code"] == "AYJ" and ayodhya["airport_km"] < 20
    assert ayodhya["station"]["code"] == "AY"  # Ayodhya Dham Junction, not a nearer halt
    assert ayodhya["bus_station"]["km"] < 10
    # No metro stations count as railway stations.
    assert "Vidhana Soudha" not in INDIA_PLACES["bengaluru"]["station"]["name"]
    assert all(code == code.lower() for code in INDIA_PLACES)  # never clashes with an airport code


def test_search_follows_the_way_of_travel():
    assert codes("ayod", "all")[0] == "ayodhya"
    assert codes("ayod", "train")[0] == "ayodhya"
    # Flights: Ayodhya's airport (OurAirports still says Faizabad), and an airport found by the
    # town it serves when its own name differs (Mysuru's is filed under Mysore).
    first = search_places("ayod", "flight", 3)[0]
    assert first["code"] == "AYJ" and first["city"] == "Ayodhya"
    mysuru = search_places("mysuru", "flight", 3)[0]
    assert mysuru["code"] == "MYQ" and mysuru["for_place"] == "Mysuru"
    # Kedarnath has no airport, station or bus station of its own: only Compare all lists it.
    assert "kedarnath" in codes("kedarnath", "all")
    assert "kedarnath" not in codes("kedarnath", "train") + codes("kedarnath", "bus")
    # Old names a traveller still types.
    assert codes("bangalore", "all")[0] == "bengaluru"
    # Abroad: airports, in Compare all and Flights.
    assert {"DXB", "DWC"} <= set(codes("dubai", "all"))
    assert search_places("  ", "all") == []


def test_a_town_flies_from_its_nearest_airport():
    assert flight_airport("BLR") == "BLR"
    assert flight_airport("ayodhya") == "AYJ"
    assert flight_airport("kedarnath") == INDIA_PLACES["kedarnath"]["airport_code"]
    flags = graph.airport_flags({"origin": "BLR", "destination": "kedarnath"})
    assert len(flags) == 1 and "Kedarnath has no airport" in flags[0] and "km away" in flags[0]
    assert graph.airport_flags({"origin": "BLR", "destination": "ayodhya"}) == []


def test_trains_and_buses_are_searched_by_the_town_and_state(monkeypatch):
    monkeypatch.setattr(travel_data, "_cache", {})
    monkeypatch.setattr(ground.config, "SERPAPI_API_KEY", "test-key")
    asked = []
    monkeypatch.setattr(ground, "_request", lambda *a, params=None, **k: asked.append(params) or {})
    assert ground.search_ground("BLR", "ayodhya", date(2026, 12, 12)) == []
    assert asked[0]["end_addr"] == "Ayodhya, Uttar Pradesh, India" == place_label("ayodhya")
    assert PLACES["BLR"]["kind"] == "airport"


def test_recommended_balances_fare_and_time():
    rows = [
        {"mode": "Flight", "fare": 6000, "duration_minutes": 150},
        {"mode": "Train", "fare": 900, "duration_minutes": 1900},
        {"mode": "Bus", "fare": None, "duration_minutes": 2000},
    ]
    # Train: 900 + 300 x 31.7 h = 10,400; flight: 6,000 + 300 x 2.5 h = 6,750.
    assert recommended(rows)["mode"] == "Flight"
    rows[0]["fare"] = 16000
    assert recommended(rows)["mode"] == "Train"
    assert recommended([{"mode": "Bus", "fare": None, "duration_minutes": 600}])["reason"].startswith("Fastest")
    assert recommended([]) is None


def test_location_endpoints(client):
    body = client.get("/locations", params={"q": "shirdi", "mode": "bus"}).json()
    top = body["locations"][0]
    assert top["code"] == "shirdi" and top["state"] == "Maharashtra" and top["bus_station"]
    assert client.get("/locations/ayodhya").json()["airport_code"] == "AYJ"
    assert client.get("/locations/blr").json()["code"] == "BLR"
    assert client.get("/locations/nowhere-zz").status_code == 404
    assert client.get("/locations", params={"q": "x", "mode": "boat"}).status_code == 422


def test_a_trip_can_go_to_a_town(client, auth_headers, trip_payload):
    made = client.post("/trip", json={**trip_payload, "destination": "ayodhya"}, headers=auth_headers)
    assert made.status_code == 201 and made.json()["destination"] == "ayodhya"
    bad = client.post("/trip", json={**trip_payload, "destination": "atlantis-zz"}, headers=auth_headers)
    assert bad.status_code == 422
    lower = client.post("/trip", json={**trip_payload, "destination": "goi"}, headers=auth_headers)
    assert lower.json()["destination"] == "GOI"
