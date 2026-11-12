import pytest
from sqlmodel import select

import app.pipeline.graph as graph
from app.database import get_session
from app.main import app
from app.models import Itinerary


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)


def optimized_trip(client, headers, payload, **changes):
    # The fixtures' cheapest picks for BLR -> DEL, 4 nights: FL-1004 (3,600) + HT-2002 (1,600 x 4).
    trip_id = client.post("/trip", json={**payload, **changes}, headers=headers).json()["id"]
    assert client.post(f"/trips/{trip_id}/optimize", headers=headers).json()["status"] == "OPTIMIZED"
    return trip_id


def edit(client, headers, trip_id, kind, option_id):
    return client.patch(f"/trips/{trip_id}/itinerary", json={"kind": kind, "option_id": option_id}, headers=headers)


def winner(ledger, kind):
    return next(row for row in ledger if row["kind"] == kind and row["won"])


# ---- PATCH /trips/{id}/itinerary (PRD US-007) -----------------------------------

def test_swapping_flight_recalculates_total_and_moves_to_review(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert client.get(f"/trips/{trip_id}/itinerary", headers=auth_headers).json()["itinerary"]["total_cost"] == 10000

    response = edit(client, auth_headers, trip_id, "flight", "FL-1001")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "UNDER_REVIEW"
    assert body["itinerary"]["flight"]["id"] == "FL-1001"
    assert body["itinerary"]["total_cost"] == 5200 + 1600 * 4
    assert body["itinerary"]["picked"] == ["flight"]

    chosen = winner(body["tradeoff_ledger"], "flight")
    assert chosen["alternative"].startswith("FL-1001")
    assert chosen["reason"].startswith("Picked by the reviewer")
    cheaper = next(row for row in body["tradeoff_ledger"] if row["alternative"].startswith("FL-1004"))
    assert cheaper["reason"] == "Price: 1,600 less than FL-1001"
    # The stay keeps the optimizer's own pick and reason.
    assert winner(body["tradeoff_ledger"], "stay")["reason"] == "Cheapest option that meets every trip preference"
    assert "reviewer picked" in body["itinerary"]["rationale"]


def test_edit_is_saved(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    edit(client, auth_headers, trip_id, "stay", "HT-2003")
    saved = client.get(f"/trips/{trip_id}/itinerary", headers=auth_headers).json()
    assert saved["itinerary"]["hotel"]["id"] == "HT-2003"
    assert saved["itinerary"]["total_cost"] == 3600 + 9500 * 4


def test_edit_over_budget_is_flagged_with_line_items(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload, budget=12000)
    body = edit(client, auth_headers, trip_id, "stay", "HT-2003").json()
    assert body["itinerary"]["within_budget"] is False
    flag = body["itinerary"]["flags"][-1]
    assert flag.startswith("Total 41,600 is 29,600 over the 12,000 budget")
    assert "hotel HT-2003" in flag

    # Swapping back to a cheap hotel clears the budget flag.
    back = edit(client, auth_headers, trip_id, "stay", "HT-2002").json()
    assert back["itinerary"]["within_budget"] is True
    assert not any(f.startswith("Total") for f in back["itinerary"]["flags"])


def test_edit_refuses_option_that_breaks_a_preference(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload, preferences={"max_stops": 0})
    response = edit(client, auth_headers, trip_id, "flight", "FL-1004")
    assert response.status_code == 400
    assert response.json()["detail"] == "FL-1004 can't be picked: FL-1004 has 1 stop(s), trip allows 0"


def test_edit_refuses_unknown_option(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert edit(client, auth_headers, trip_id, "stay", "FL-1001").status_code == 400
    assert edit(client, auth_headers, trip_id, "flight", "FL-9999").status_code == 400


def test_edit_rejects_bad_kind(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert edit(client, auth_headers, trip_id, "train", "FL-1001").status_code == 422


def test_decided_trip_cannot_be_edited(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    client.post(f"/trips/{trip_id}/decision", json={"outcome": "APPROVED"}, headers=auth_headers)
    assert edit(client, auth_headers, trip_id, "flight", "FL-1001").status_code == 409


def test_draft_trip_cannot_be_edited(client, auth_headers, trip_payload):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    assert edit(client, auth_headers, trip_id, "flight", "FL-1001").status_code == 409


def test_itinerary_saved_before_edits_existed_needs_a_rerun(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    with next(app.dependency_overrides[get_session]()) as db:
        itinerary = db.exec(select(Itinerary)).one()
        itinerary.search_results = None
        db.add(itinerary)
        db.commit()

    assert client.get(f"/trips/{trip_id}/itinerary", headers=auth_headers).json()["itinerary"]["editable"] is False
    response = edit(client, auth_headers, trip_id, "flight", "FL-1001")
    assert response.status_code == 409
    assert "optimize the trip again" in response.json()["detail"]


def test_cannot_edit_someone_elses_trip(client, auth_headers, other_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    assert edit(client, other_headers, trip_id, "flight", "FL-1001").status_code == 404


def test_edit_is_in_the_audit_trail(client, auth_headers, trip_payload):
    trip_id = optimized_trip(client, auth_headers, trip_payload)
    edit(client, auth_headers, trip_id, "flight", "FL-1001")
    events = client.get(f"/audit?event_type=ITINERARY_EDITED&trip_id={trip_id}", headers=auth_headers).json()
    assert len(events) == 1
    assert events[0]["summary"] == "Swapped flight to FL-1001; total 10,000 -> 11,600"
    assert events[0]["payload"] == {"kind": "flight", "option_id": "FL-1001", "before": 10000, "after": 11600}
