"""Trips by train or bus (app/pipeline/graph.py ground_check): the trip form's Trains or Buses.

No network: trains come from canned search_ground results, hotels from the fixture file. Flights
must never be searched for such a trip.
"""
import pytest

import app.pipeline.graph as graph
from app import ground, travel_data


def train(service, day, departs, arrives, minutes, fare=None, kind="train"):
    return {"kind": kind, "service": service, "operator": "Indian Railways",
            "from": {"name": "KSR Bengaluru", "code": "SBC"}, "to": {"name": "New Delhi", "code": "NDLS"},
            "departure_time": f"{day}T{departs}:00", "arrival_time": arrives, "duration_minutes": minutes,
            "changes": 0, "fare": fare, "currency": "INR" if fare else None,
            "fare_label": "Google Maps fare" if fare else "Not available", "link": "https://www.irctc.co.in",
            "link_label": "Book on IRCTC", "source": "Google Maps transit via SerpApi", "data_label": "Live schedule"}


OUT = [
    train("12627 Karnataka Express", "2026-11-01", "19:20", "2026-11-03T09:00:00", 2260),
    train("22691 Rajdhani Express", "2026-11-01", "20:00", "2026-11-03T05:30:00", 2010),
    train("KSRTC Airavat", "2026-11-01", "18:00", "2026-11-03T06:00:00", 2160, kind="bus"),
]
BACK = [train("22692 Rajdhani Express", "2026-11-05", "19:50", "2026-11-07T06:40:00", 2090)]


@pytest.fixture(autouse=True)
def canned(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)

    def no_flights(*args, **kwargs):
        raise AssertionError("a trip by train must not search flights")

    monkeypatch.setattr(travel_data, "search_flights", no_flights)
    monkeypatch.setattr(ground, "search_ground", lambda frm, to, day, hours=ground.DEPART_HOURS: OUT if frm == "BLR" else BACK)


def by_train(client, headers, payload, modes=("train",), **changes):
    body = {**payload, "preferences": {"filters": {"modes": list(modes)}}, **changes}
    trip_id = client.post("/trip", json=body, headers=headers).json()["id"]
    return client.post(f"/trips/{trip_id}/optimize", headers=headers).json(), trip_id


def test_modes_without_flight_make_a_ground_trip():
    assert graph.ground_modes({"filters": {"modes": ["train"]}}) == ["train"]
    assert graph.ground_modes({"filters": {"modes": ["bus", "train"]}}) == ["train", "bus"]
    assert graph.ground_modes({"filters": {"modes": ["flight", "train"]}}) is None
    assert graph.ground_modes({"filters": {}}) is None and graph.ground_modes({}) is None


def test_no_fare_published_picks_the_fastest_and_says_so(client, auth_headers, trip_payload):
    body, _ = by_train(client, auth_headers, trip_payload)
    assert body["status"] == "OPTIMIZED", body["reason"]
    it = body["itinerary"]
    out, back = it["flight"], it["return_flight"]
    assert out["mode"] == "train" and out["service"] == "22691 Rajdhani Express"  # fastest; the bus is left out
    assert out["price"] is None and out["fare_label"] == "Fare not published"
    assert "fare_estimate" not in out and back["service"] == "22692 Rajdhani Express"
    # The total holds the hotel only; the missing train fare is flagged, never guessed.
    assert it["total_cost"] == it["hotel"]["price_per_night"] * 4
    assert "The train fare isn't published, so it isn't in the total; check it on the operator's site before booking" in it["flags"]
    assert not any("typically" in f or "estimate" in f for f in it["flags"])
    assert "Chose train" in it["rationale"] and "fare not published" in it["rationale"]
    trains = [e for e in body["tradeoff_ledger"] if e["kind"] == "flight"]
    assert [e["won"] for e in trains] == [True, False] and trains[0]["price"] is None
    assert trains[1]["reason"].startswith("Slower: 37h 40m vs 33h 30m")


def test_a_published_fare_wins_and_counts_in_the_total(client, auth_headers, trip_payload, monkeypatch):
    priced = [OUT[0] | {"fare": 1200, "currency": "INR"}, OUT[1]]
    monkeypatch.setattr(ground, "search_ground", lambda frm, to, day, hours=ground.DEPART_HOURS: priced if frm == "BLR" else BACK)
    body, _ = by_train(client, auth_headers, trip_payload)
    it = body["itinerary"]
    assert it["flight"]["service"] == "12627 Karnataka Express" and it["flight"]["price"] == 1200
    assert it["total_cost"] == 1200 + it["hotel"]["price_per_night"] * 4


def test_buses_only(client, auth_headers, trip_payload):
    body, _ = by_train(client, auth_headers, trip_payload, modes=("bus",))
    assert body["itinerary"]["flight"]["mode"] == "bus" and body["itinerary"]["flight"]["service"] == "KSRTC Airavat"
    assert body["itinerary"]["return_flight"] is None  # no bus back that day
    assert any("No buses found from DEL to BLR" in f for f in body["itinerary"]["flags"])


def test_nothing_running_fails_with_the_reason(client, auth_headers, trip_payload, monkeypatch):
    monkeypatch.setattr(ground, "search_ground", lambda *a, **k: [])
    body, _ = by_train(client, auth_headers, trip_payload)
    assert body["status"] == "OPTIMIZATION_FAILED" and "No trains found from BLR to DEL" in body["reason"]


def test_a_what_if_on_a_train_trip_reuses_its_searches(client, auth_headers, trip_payload, monkeypatch):
    _, trip_id = by_train(client, auth_headers, trip_payload)
    monkeypatch.setattr(ground, "search_ground", lambda *a, **k: pytest.fail("a preview must not search again"))
    preview = client.post(f"/trips/{trip_id}/preview", json={"budget": 1000}, headers=auth_headers)
    assert preview.status_code == 200, preview.text
    assert preview.json()["preview"]["itinerary"]["flight"]["mode"] == "train"
