"""Compare all (flights, trains and buses): the optimizer searches every way, checks each, and books
the one that suits the budget and the trip's priority, instead of failing when no flight is found.
Flights come from the fixture file (BLR -> DEL on 2026-11-01), trains and buses from canned searches."""
import pytest

import app.pipeline.graph as graph
from app import ground, travel_data


def option(service, day, departs, arrives, minutes, fare=None, kind="train"):
    return {"kind": kind, "service": service, "operator": "Indian Railways",
            "from": {"name": "KSR Bengaluru", "code": "SBC"}, "to": {"name": "New Delhi", "code": "NDLS"},
            "departure_time": f"{day}T{departs}:00", "arrival_time": arrives, "duration_minutes": minutes,
            "changes": 0, "fare": fare, "currency": "INR" if fare else None,
            "fare_label": "Official fare" if fare else "Not available", "link": "https://www.irctc.co.in",
            "link_label": "Book on IRCTC", "source": "Google Maps transit via SerpApi", "data_label": "Live schedule"}


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)


def road(monkeypatch, out, back):
    monkeypatch.setattr(ground, "search_ground", lambda frm, to, day, hours=ground.DEPART_HOURS: out if frm == "BLR" else back)


def compare_all(client, headers, payload, priority=None, budget=None):
    prefs = {"filters": {"modes": ["flight", "train", "bus"]}}
    if priority:
        prefs["filters"]["priority"] = priority
    body = {**payload, "preferences": prefs, **({"budget": budget} if budget else {})}
    trip_id = client.post("/trip", json=body, headers=headers).json()["id"]
    return client.post(f"/trips/{trip_id}/optimize", headers=headers).json()


def test_modes_with_flight_and_ground_are_compared():
    assert graph.compared_ground_modes({"filters": {"modes": ["flight", "train", "bus"]}}) == ["train", "bus"]
    assert graph.compared_ground_modes({"filters": {"modes": ["flight"]}}) is None
    assert graph.compared_ground_modes({"filters": {"modes": ["train"]}}) is None  # a train trip, not a comparison
    assert graph.compared_ground_modes({}) is None


def test_no_flight_found_books_the_train_instead_of_failing(client, auth_headers, trip_payload, monkeypatch):
    monkeypatch.setattr(travel_data, "search_flights", lambda *a, **k: [])
    road(monkeypatch, [option("22691 Rajdhani Express", "2026-11-01", "20:00", "2026-11-03T05:30:00", 2010, fare=3200)],
         [option("22692 Rajdhani Express", "2026-11-05", "19:50", "2026-11-07T06:40:00", 2090, fare=3300)])
    body = compare_all(client, auth_headers, trip_payload)
    assert body["status"] == "OPTIMIZED", body.get("reason")
    it = body["itinerary"]
    assert it["flight"]["mode"] == "train" and it["return_flight"]["mode"] == "train"
    assert "Compared every way: no flight was found, so the train is booked" in it["flags"]


def test_a_cheaper_train_beats_the_flight_on_cost(client, auth_headers, trip_payload, monkeypatch):
    road(monkeypatch, [option("12627 Karnataka Express", "2026-11-01", "19:20", "2026-11-03T09:00:00", 2260, fare=900)],
         [option("12628 Karnataka Express", "2026-11-05", "19:20", "2026-11-07T09:00:00", 2260, fare=900)])
    body = compare_all(client, auth_headers, trip_payload, priority="cheapest")
    it = body["itinerary"]
    assert it["flight"]["mode"] == "train"
    note = next(f for f in it["flags"] if f.startswith("Compared every way"))
    assert "by flight" in note and "by train" in note and "the train is booked (cheaper)" in note


def test_comfort_keeps_the_flight(client, auth_headers, trip_payload, monkeypatch):
    road(monkeypatch, [option("12627 Karnataka Express", "2026-11-01", "19:20", "2026-11-03T09:00:00", 2260, fare=900)],
         [option("12628 Karnataka Express", "2026-11-05", "19:20", "2026-11-07T09:00:00", 2260, fare=900)])
    it = compare_all(client, auth_headers, trip_payload, priority="comfort")["itinerary"]
    assert it["flight"].get("mode") not in ("train", "bus")
    assert any("the flight is booked (comfort priority)" in f for f in it["flags"])


def unpriced_bus(monkeypatch):
    road(monkeypatch, [option("KSRTC Airavat", "2026-11-01", "18:00", "2026-11-03T06:00:00", 2160, kind="bus")],
         [option("KSRTC Airavat", "2026-11-05", "18:00", "2026-11-07T06:00:00", 2160, kind="bus")])


def test_a_priced_flight_within_budget_beats_a_bus_without_a_fare(client, auth_headers, trip_payload, monkeypatch):
    unpriced_bus(monkeypatch)
    it = compare_all(client, auth_headers, trip_payload, priority="balanced")["itinerary"]
    assert it["flight"].get("mode") not in ("train", "bus")
    assert any("doesn't publish its fare, so the priced flight that fits the budget is booked" in f for f in it["flags"])


def test_lowest_cost_books_the_bus_even_without_a_published_fare(client, auth_headers, trip_payload, monkeypatch):
    unpriced_bus(monkeypatch)
    body = compare_all(client, auth_headers, trip_payload, priority="cheapest")
    assert body["status"] == "OPTIMIZED", body.get("reason")
    it = body["itinerary"]
    assert it["flight"]["mode"] == "bus"
    assert any("the trip asks for the lowest cost, so the bus is booked; its fare isn't published" in f for f in it["flags"])


def test_a_flight_over_budget_never_beats_a_real_bus(client, auth_headers, trip_payload, monkeypatch):
    # Varkala: the flight was 14,958 against a 7,000 budget, and the trip failed instead of booking the train.
    unpriced_bus(monkeypatch)
    body = compare_all(client, auth_headers, trip_payload, priority="balanced", budget=7000)
    assert body["status"] == "OPTIMIZED", body.get("reason")
    it = body["itinerary"]
    assert it["flight"]["mode"] == "bus" and it["hotel"] is not None  # the whole budget is left for the stay
    assert any("is over the budget, so the bus is booked" in f for f in it["flags"])


def test_nothing_found_anywhere_still_fails_and_says_why(client, auth_headers, trip_payload, monkeypatch):
    monkeypatch.setattr(travel_data, "search_flights", lambda *a, **k: [])
    road(monkeypatch, [], [])
    body = compare_all(client, auth_headers, trip_payload)
    assert body["status"] == "OPTIMIZATION_FAILED"
    assert "No flights found" in body["reason"] and "No trains or buses found" in body["reason"]
