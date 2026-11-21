"""Trains and buses (app/ground.py) and GET /trips/{id}/transport.

SerpApi is never called: the body below is a trimmed copy of a real Google Maps transit answer
for New Delhi to Jaipur (12 Dec 2026), with its own field names.
"""
from datetime import date

import pytest

from app import config, ground, travel_data

RAIL = "https://maps.gstatic.com/mapfiles/transit/iw2/svg/rail2.svg"
BUS = "https://maps.gstatic.com/mapfiles/transit/iw2/svg/bus2.svg"
WALK = "https://maps.gstatic.com/mapfiles/transit/iw2/svg/walk.svg"
BODY = {"directions": [
    {"travel_mode": "Transit", "start_time": "6:40 AM", "end_time": "10:40 AM", "distance": 309800,
     "duration": 14400, "trips": [
        {"travel_mode": "Transit", "title": "12015 Daurai Shatabdi Express", "duration": 14400, "icon": RAIL,
         "service_run_by": {"name": "Indian Railways", "link": "http://www.indianrail.gov.in/"},
         "start_stop": {"name": "New Delhi", "stop_id": "NDLS", "time": "6:40 AM"},
         "end_stop": {"name": "Jaipur Junction", "stop_id": "JP", "time": "10:40 AM"}}]},
    {"travel_mode": "Transit", "start_time": "12:07 AM", "end_time": "7:41 AM", "distance": 296000,
     "duration": 27240, "cost": 272.7, "currency": "INR", "trips": [
        {"travel_mode": "Walking", "title": "Walk", "duration": 300, "icon": WALK},
        {"travel_mode": "Transit", "title": "19702 Sainik Express", "duration": 26940, "icon": RAIL,
         "service_run_by": {"name": "Indian Railways"},
         "start_stop": {"name": "Delhi Cantt", "stop_id": "DEC", "time": "12:07 AM"},
         "end_stop": {"name": "Durgapura", "stop_id": "DKBJ", "time": "7:41 AM"}}]},
    {"travel_mode": "Transit", "start_time": "8:25 AM", "end_time": "3:46 PM", "distance": 272000,
     "duration": 26460, "trips": [
        {"travel_mode": "Transit", "title": "012 NS City bus", "duration": 900, "icon": BUS,
         "start_stop": {"name": "New Delhi Railway Station Flyover", "time": "7:50 AM"},
         "end_stop": {"name": "Sarai Kale Khan", "time": "8:05 AM"}},
        {"travel_mode": "Transit", "title": "FlixBus IN0610 Jaipur - Park Street", "duration": 24300, "icon": BUS,
         "service_run_by": {"name": "FlixBus"},
         "start_stop": {"name": "New Delhi Bus Station", "time": "8:25 AM"},
         "end_stop": {"name": "Jaipur Sindhi Camp", "time": "3:10 PM"}}]},
    {"travel_mode": "Walking", "duration": 260000, "trips": [{"travel_mode": "Walking", "title": "Walk"}]},  # no transit: skipped
]}


@pytest.fixture
def serp(monkeypatch):
    calls = []
    monkeypatch.setattr(config, "SERPAPI_API_KEY", "test-key")
    monkeypatch.setattr(travel_data, "_cache", {})

    def fake_request(provider, method, url, params=None, **kwargs):
        calls.append(params)
        return BODY
    monkeypatch.setattr(ground, "_request", fake_request)
    return calls


def test_trains_and_buses_are_read_from_google_fields(serp):
    shatabdi, sainik, flixbus = ground.search_ground("DEL", "JAI", date(2026, 12, 12))
    assert (shatabdi["kind"], shatabdi["service"], shatabdi["operator"]) == ("train", "12015 Daurai Shatabdi Express", "Indian Railways")
    assert shatabdi["from"] == {"name": "New Delhi", "code": "NDLS", "time": "6:40 AM"}
    assert shatabdi["departs"] == "6:40 AM" and shatabdi["arrives"] == "10:40 AM"
    assert shatabdi["duration_minutes"] == 240 and shatabdi["distance_km"] == 310 and shatabdi["changes"] == 0
    assert shatabdi["data_label"] == "Live schedule" and shatabdi["source"].startswith("Google Maps transit")
    # The bus route's main vehicle is the longest leg (FlixBus), after a city bus.
    assert flixbus["kind"] == "bus" and flixbus["service"].startswith("FlixBus") and flixbus["changes"] == 1


def test_a_fare_is_shown_only_when_google_gives_one(serp):
    shatabdi, sainik, flixbus = ground.search_ground("DEL", "BOM", date(2026, 12, 12))
    assert (sainik["fare"], sainik["currency"]) == (272.7, "INR") and sainik["fare_label"].startswith("Google Maps fare")
    assert shatabdi["fare"] is None and shatabdi["currency"] is None and shatabdi["fare_label"] == "Not available"


def test_search_asks_google_maps_for_transit_from_early_morning(serp):
    ground.search_ground("DEL", "BOM", date(2026, 12, 12))
    params = serp[0]
    assert params["engine"] == "google_maps_directions" and params["travel_mode"] == 3
    assert params["start_addr"] == "New Delhi, India" and params["end_addr"] == "Mumbai, India"
    # 12 Dec 2026, 05:00 in India = 11 Dec 23:30 UTC.
    assert params["time"] == "depart_at:1797031800"


def test_same_route_and_day_is_cached(serp):
    ground.search_ground("DEL", "BOM", date(2026, 12, 12))
    ground.search_ground("DEL", "BOM", date(2026, 12, 12))
    assert len(serp) == 1


def test_only_within_india(serp):
    with pytest.raises(ground.GroundUnavailable, match="within India"):
        ground.search_ground("DEL", "DXB", date(2026, 12, 12))


def test_no_key_means_unavailable(monkeypatch):
    monkeypatch.setattr(config, "SERPAPI_API_KEY", "")
    with pytest.raises(ground.GroundUnavailable, match="SERPAPI_API_KEY"):
        ground.search_ground("DEL", "BOM", date(2026, 12, 12))


# ---- GET /trips/{id}/transport ----------------------------------------------------------

def test_transport_compares_the_flight_with_the_fastest_train_and_bus(client, auth_headers, trip_payload, serp):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    client.post(f"/trips/{trip_id}/optimize", headers=auth_headers)
    body = client.get(f"/trips/{trip_id}/transport", headers=auth_headers).json()
    assert body["notice"] is None and body["date"] == trip_payload["dates"][0]
    assert body["flight"]["kind"] == "flight" and body["flight"]["fare"] > 0
    assert [t["service"] for t in body["trains"]] == ["12015 Daurai Shatabdi Express", "19702 Sainik Express"]
    assert [b["operator"] for b in body["buses"]] == ["FlixBus"]
    modes = {row["mode"]: row for row in body["comparison"]}
    assert list(modes) == ["Flight", "Train", "Bus"]
    assert modes["Train"]["service"] == "12015 Daurai Shatabdi Express"  # the fastest train, 240 min
    assert modes["Train"]["fare"] is None and modes["Train"]["fare_label"] == "Not available"


def test_transport_works_before_the_trip_is_optimized(client, auth_headers, trip_payload, serp):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    body = client.get(f"/trips/{trip_id}/transport", headers=auth_headers).json()
    assert body["flight"] is None and len(body["trains"]) == 2
    assert [row["mode"] for row in body["comparison"]] == ["Train", "Bus"]


def test_transport_abroad_says_so(client, auth_headers, trip_payload, serp):
    trip_id = client.post("/trip", json={**trip_payload, "destination": "DXB"}, headers=auth_headers).json()["id"]
    body = client.get(f"/trips/{trip_id}/transport", headers=auth_headers).json()
    assert body["trains"] == [] and "within India" in body["notice"]


def test_transport_of_another_users_trip_is_404(client, auth_headers, other_headers, trip_payload, serp):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    assert client.get(f"/trips/{trip_id}/transport", headers=other_headers).status_code == 404
    assert client.get(f"/trips/{trip_id}/transport").status_code == 401
