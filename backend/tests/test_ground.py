"""Trains, buses and ferries (app/ground.py) and GET /trips/{id}/transport.

SerpApi is never called: the body below is a trimmed copy of a real Google Maps transit answer
for New Delhi to Jaipur (12 Dec 2026), with its own field names.
"""
from datetime import date

import pytest

from app import config, ground, travel_data

RAIL = "https://maps.gstatic.com/mapfiles/transit/iw2/svg/rail2.svg"
BUS = "https://maps.gstatic.com/mapfiles/transit/iw2/svg/bus2.svg"
WALK = "https://maps.gstatic.com/mapfiles/transit/iw2/svg/walk.svg"
FERRY = "https://maps.gstatic.com/mapfiles/transit/iw2/svg/ferry2.svg"
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


def test_the_day_is_searched_from_morning_midday_and_evening_local_time(serp):
    found = ground.search_ground("DEL", "BOM", date(2026, 12, 12))
    params = serp[0]
    assert params["engine"] == "google_maps_directions" and params["travel_mode"] == 3
    assert params["start_addr"] == "New Delhi, India" and params["end_addr"] == "Mumbai, India"
    assert params["gl"] == "in"
    # 12 Dec 2026 at 05:00, 12:00 and 19:00 in India (05:00 IST = 11 Dec 23:30 UTC).
    assert [p["time"] for p in serp] == ["depart_at:1797031800", "depart_at:1797057000", "depart_at:1797082200"]
    # All three answers were the same routes: each departure is listed once.
    assert [o["id"] for o in found] == ["GT-1", "GT-2", "GT-3"]


def test_later_searches_add_new_departures(serp, monkeypatch):
    night = {"directions": [
        {"start_time": "9:30 PM", "end_time": "5:10 AM", "duration": 27600, "trips": [
            {"travel_mode": "Transit", "title": "Zingbus sleeper", "duration": 27600, "icon": BUS,
             "service_run_by": {"name": "Zingbus"},
             "start_stop": {"name": "Kashmiri Gate ISBT", "time": "9:30 PM"},
             "end_stop": {"name": "Jaipur Sindhi Camp", "time": "5:10 AM"}}]},
        BODY["directions"][0],  # the Shatabdi again: not repeated
    ]}
    monkeypatch.setattr(ground, "_request", lambda *a, params=None, **k: serp.append(params) or (
        night if params["time"].endswith("1797082200") else BODY))
    found = ground.search_ground("DEL", "JAI", date(2026, 12, 12))
    assert [o["service"] for o in found][-1] == "Zingbus sleeper" and len(found) == 4
    assert found[-1]["id"] == "GT-4" and found[-1]["kind"] == "bus"


def test_any_two_cities_in_the_world_can_be_searched(serp):
    ground.search_ground("LHR", "CDG", date(2026, 12, 12))
    params = serp[0]
    assert params["start_addr"] == "London, United Kingdom" and params["end_addr"] == "Paris, France"
    assert params["gl"] == "gb"
    assert params["time"] == "depart_at:1797051600"  # 05:00 in London (GMT in December)
    ground.search_ground("DEL", "DXB", date(2026, 12, 12))
    assert serp[-1]["end_addr"] == "Dubai, United Arab Emirates"


def test_vehicle_kind_comes_from_googles_icon():
    assert ground.kind_of({"icon": RAIL}) == "train" and ground.kind_of({"icon": BUS}) == "bus"
    assert ground.kind_of({"icon": FERRY}) == "ferry"
    assert ground.kind_of({"icon": ".../subway2.svg"}) == "train" and ground.kind_of({"icon": WALK}) is None


def test_local_time_falls_back_to_utc_without_a_time_zone():
    assert ground.local_timestamp(date(2026, 12, 12), 5, None) == 1797051600
    assert ground.local_timestamp(date(2026, 12, 12), 5, "Not/AZone") == 1797051600


def test_same_route_and_day_is_cached(serp):
    ground.search_ground("DEL", "BOM", date(2026, 12, 12))
    ground.search_ground("DEL", "BOM", date(2026, 12, 12))
    assert len(serp) == 3  # one search per time of day, then served from the cache


def test_unknown_or_same_city_is_not_searched(serp):
    with pytest.raises(ground.GroundUnavailable, match="known airport"):
        ground.search_ground("DEL", "ZZZ", date(2026, 12, 12))
    with pytest.raises(ground.GroundUnavailable, match="same city"):
        ground.search_ground("JFK", "LGA", date(2026, 12, 12))  # both New York
    assert serp == []


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
    assert [b["operator"] for b in body["buses"]] == ["FlixBus"] and body["ferries"] == []
    modes = {row["mode"]: row for row in body["comparison"]}
    assert list(modes) == ["Flight", "Train", "Bus"]
    assert modes["Train"]["service"] == "12015 Daurai Shatabdi Express"  # the fastest train, 240 min
    assert modes["Train"]["fare"] is None and modes["Train"]["fare_label"] == "Not available"


def test_transport_works_before_the_trip_is_optimized(client, auth_headers, trip_payload, serp):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    body = client.get(f"/trips/{trip_id}/transport", headers=auth_headers).json()
    assert body["flight"] is None and len(body["trains"]) == 2
    assert [row["mode"] for row in body["comparison"]] == ["Train", "Bus"]


def test_transport_lists_ferries_too(client, auth_headers, trip_payload, serp, monkeypatch):
    boat = {"directions": [{"start_time": "7:00 AM", "end_time": "8:30 AM", "duration": 5400, "cost": 600,
                            "currency": "INR", "trips": [
        {"travel_mode": "Transit", "title": "Mumbai - Mandwa ferry", "duration": 5400, "icon": FERRY,
         "start_stop": {"name": "Gateway of India", "time": "7:00 AM"},
         "end_stop": {"name": "Mandwa Jetty", "time": "8:30 AM"}}]}]}
    monkeypatch.setattr(ground, "_request", lambda *a, **k: boat)
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    body = client.get(f"/trips/{trip_id}/transport", headers=auth_headers).json()
    assert [f["service"] for f in body["ferries"]] == ["Mumbai - Mandwa ferry"]
    assert body["comparison"] == [{"mode": "Ferry", "service": "Mumbai - Mandwa ferry", "departs": "7:00 AM",
                                   "duration_minutes": 90, "fare": 600.0, "currency": "INR",
                                   "fare_label": "Google Maps fare (may differ by class)"}]


def test_transport_abroad_is_searched_and_says_when_google_has_nothing(client, auth_headers, trip_payload, serp, monkeypatch):
    monkeypatch.setattr(ground, "_request", lambda *a, **k: {})  # e.g. across the sea: no public transport
    trip_id = client.post("/trip", json={**trip_payload, "destination": "DXB"}, headers=auth_headers).json()["id"]
    body = client.get(f"/trips/{trip_id}/transport", headers=auth_headers).json()
    assert body["trains"] == body["buses"] == body["ferries"] == []
    assert body["notice"] == "Google Maps lists no trains, buses or ferries for this route and day"


def test_transport_of_another_users_trip_is_404(client, auth_headers, other_headers, trip_payload, serp):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    assert client.get(f"/trips/{trip_id}/transport", headers=other_headers).status_code == 404
    assert client.get(f"/trips/{trip_id}/transport").status_code == 401
