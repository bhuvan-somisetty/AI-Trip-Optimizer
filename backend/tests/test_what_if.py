"""POST /trips/{id}/preview and /preview/apply: the What-If Simulator (PRD US-011)."""
import pytest

import app.pipeline.graph as graph
from app import travel_data


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)


def optimized_trip(client, headers, payload, **changes):
    # Fixture picks for BLR -> DEL, 4 nights: FL-1004 (3,600, 1 stop), return FL-1009 (3,300,
    # 1 stop) and HT-2002 (1,600 x 4): 13,300 in all.
    trip_id = client.post("/trip", json={**payload, **changes}, headers=headers).json()["id"]
    assert client.post(f"/trips/{trip_id}/optimize", headers=headers).json()["status"] == "OPTIMIZED"
    return trip_id


def preview(client, headers, trip_id, **body):
    return client.post(f"/trips/{trip_id}/preview", json=body, headers=headers)


def apply(client, headers, trip_id, **body):
    return client.post(f"/trips/{trip_id}/preview/apply", json=body, headers=headers)


def saved(client, headers, trip_id):
    return client.get(f"/trips/{trip_id}/itinerary", headers=headers).json()


def test_preview_shows_what_changes_without_saving(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    response = preview(client, auth_headers, trip_id, max_stops=0)
    assert response.status_code == 200
    body = response.json()
    assert body["inputs"] == [{"field": "max_stops", "before": None, "after": 0}]
    after = body["preview"]["itinerary"]
    assert body["preview"]["status"] == "OPTIMIZED"
    assert after["flight"]["stops"] == 0 and after["return_flight"]["stops"] == 0
    diff = {d["field"]: d for d in body["diff"]}
    assert diff["flight"] == {"field": "flight", "before": "FL-1004", "after": after["flight"]["id"]}
    assert diff["total_cost"]["before"] == 13300 and diff["total_cost"]["after"] == after["total_cost"]
    assert after["total_cost"] > 13300

    # Nothing was saved: the trip and its itinerary are as they were.
    assert saved(client, auth_headers, trip_id)["itinerary"]["total_cost"] == 13300
    assert client.get(f"/trips/{trip_id}", headers=auth_headers).json()["status"] == "OPTIMIZED"
    assert client.get(f"/audit?trip_id={trip_id}&event_type=ITINERARY_EDITED", headers=auth_headers).json() == []


def test_preview_does_not_search_again(client, auth_headers, trip_payload, monkeypatch):
    trip_id = optimized_trip(client, auth_headers, trip_payload)

    def no_search(*args, **kwargs):
        raise AssertionError("a preview must reuse the saved search results")

    monkeypatch.setattr(travel_data, "search_flights", no_search)
    monkeypatch.setattr(travel_data, "search_hotels", no_search)
    assert preview(client, auth_headers, trip_id, budget=5000).status_code == 200


def test_preview_of_a_lower_budget_flags_the_overrun(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    body = preview(client, auth_headers, trip_id, budget=10000).json()
    assert body["inputs"] == [{"field": "budget", "before": 60000.0, "after": 10000.0}]
    assert body["preview"]["itinerary"]["within_budget"] is False
    assert body["preview"]["itinerary"]["flags"][-1].startswith("Total 13,300 is 3,300 over the 10,000 budget")
    fields = {d["field"] for d in body["diff"]}
    assert fields == {"within_budget", "flags"}  # same picks, only the verdict changes


def test_preview_that_cannot_build_an_itinerary_says_why(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    body = preview(client, auth_headers, trip_id, min_hotel_rating=5).json()
    assert body["preview"]["status"] == "OPTIMIZATION_FAILED"
    assert body["preview"]["itinerary"] is None
    assert "No hotel in DEL meets the trip's preferences" in body["preview"]["reason"]


def test_preview_needs_a_change(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert preview(client, auth_headers, trip_id).status_code == 422
    same = preview(client, auth_headers, trip_id, budget=60000)
    assert same.status_code == 400
    assert same.json()["detail"] == "Nothing to preview: every input already has that value"


def test_preview_validates_inputs(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert preview(client, auth_headers, trip_id, max_stops=5).status_code == 422
    assert preview(client, auth_headers, trip_id, cabin_class="first").status_code == 422
    assert preview(client, auth_headers, trip_id, budget=-1).status_code == 422
    assert preview(client, auth_headers, trip_id, budget=None).status_code == 422


def test_preview_null_removes_a_preference(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload, preferences={"max_stops": 0})
    body = preview(client, auth_headers, trip_id, max_stops=None).json()
    assert body["inputs"] == [{"field": "max_stops", "before": 0, "after": None}]
    assert body["preview"]["itinerary"]["flight"]["id"] == "FL-1004"  # the 1-stop fare is allowed again


def test_apply_saves_inputs_and_itinerary_and_logs_it(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    expected = preview(client, auth_headers, trip_id, max_stops=0, budget=70000).json()["preview"]["itinerary"]

    response = apply(client, auth_headers, trip_id, max_stops=0, budget=70000)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "UNDER_REVIEW"
    assert body["itinerary"]["total_cost"] == expected["total_cost"]
    assert body["itinerary"]["flight"]["id"] == expected["flight"]["id"]
    assert body["itinerary"]["picked"] == []

    trip = client.get(f"/trips/{trip_id}", headers=auth_headers).json()
    assert trip["budget"] == 70000 and trip["preferences"]["max_stops"] == 0
    assert trip["status"] == "UNDER_REVIEW"
    assert saved(client, auth_headers, trip_id)["itinerary"]["total_cost"] == expected["total_cost"]

    events = client.get(f"/audit?trip_id={trip_id}&event_type=ITINERARY_EDITED", headers=auth_headers).json()
    assert len(events) == 1
    assert events[0]["summary"].startswith("Applied what-if (budget 60000.0 -> 70000.0, max_stops None -> 0); total 13,300 -> ")
    assert events[0]["payload"]["what_if"] is True


def test_apply_drops_hand_picked_edits(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    client.patch(f"/trips/{trip_id}/itinerary", json={"kind": "stay", "option_id": "HT-2003"}, headers=auth_headers)
    body = apply(client, auth_headers, trip_id, budget=80000).json()
    assert body["itinerary"]["picked"] == []
    assert body["itinerary"]["hotel"]["id"] == "HT-2002"  # the optimizer's own pick again


def test_apply_refuses_a_change_with_no_itinerary(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    response = apply(client, auth_headers, trip_id, min_hotel_rating=5)
    assert response.status_code == 400
    assert response.json()["detail"].startswith("This change can't build an itinerary, so nothing was saved")
    assert client.get(f"/trips/{trip_id}", headers=auth_headers).json()["preferences"].get("min_hotel_rating") is None


def test_decided_trip_cannot_be_previewed(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    client.post(f"/trips/{trip_id}/decision", json={"outcome": "APPROVED"}, headers=auth_headers)
    assert preview(client, auth_headers, trip_id, budget=1000).status_code == 409
    assert apply(client, auth_headers, trip_id, budget=1000).status_code == 409


def test_cannot_preview_someone_elses_trip(client, auth_headers, other_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert preview(client, other_headers, trip_id, budget=1000).status_code == 404
    assert apply(client, other_headers, trip_id, budget=1000).status_code == 404
