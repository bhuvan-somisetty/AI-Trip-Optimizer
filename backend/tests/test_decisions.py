import uuid

import pytest

import app.pipeline.graph as graph
from app.database import get_session
from app.main import app
from app.models import Trip, TripStatus


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)


@pytest.fixture
def db(client):
    sessions = app.dependency_overrides[get_session]()
    yield next(sessions)
    sessions.close()


@pytest.fixture
def optimized_trip(client, auth_headers, trip_payload):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    assert client.post(f"/trips/{trip_id}/optimize", headers=auth_headers).json()["status"] == "OPTIMIZED"
    return trip_id


def set_status(db, trip_id, new_status):
    trip = db.get(Trip, uuid.UUID(trip_id))
    trip.status = new_status
    db.add(trip)
    db.commit()


def decide(client, headers, trip_id, outcome, reason=None):
    return client.post(f"/trips/{trip_id}/decision", json={"outcome": outcome, "reason": reason}, headers=headers)


def trip_status(client, headers, trip_id):
    return client.get(f"/trips/{trip_id}", headers=headers).json()["status"]


# ---- POST /trips/{id}/review ----------------------------------------------

def test_review_moves_optimized_trip_to_under_review(client, auth_headers, optimized_trip):
    response = client.post(f"/trips/{optimized_trip}/review", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "UNDER_REVIEW"
    assert trip_status(client, auth_headers, optimized_trip) == "UNDER_REVIEW"


def test_review_draft_trip_is_409(client, auth_headers, trip_payload):
    trip_id = client.post("/trip", json=trip_payload, headers=auth_headers).json()["id"]
    response = client.post(f"/trips/{trip_id}/review", headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["detail"] == "Trip is DRAFT; only OPTIMIZED trips can be moved to review"


def test_review_other_users_trip_is_404(client, other_headers, optimized_trip):
    assert client.post(f"/trips/{optimized_trip}/review", headers=other_headers).status_code == 404


# ---- POST /trips/{id}/decision --------------------------------------------

def test_approve_sets_decided_and_records_decision(client, auth_headers, optimized_trip):
    response = decide(client, auth_headers, optimized_trip, "APPROVED")
    assert response.status_code == 200
    body = response.json()
    assert body["outcome"] == "APPROVED" and body["reason"] is None
    assert body["trip_id"] == optimized_trip
    assert uuid.UUID(body["id"]) and uuid.UUID(body["decided_by"]) and body["decided_at"]
    assert trip_status(client, auth_headers, optimized_trip) == "DECIDED"


def test_reject_from_review_stores_reason(client, auth_headers, optimized_trip):
    client.post(f"/trips/{optimized_trip}/review", headers=auth_headers)
    body = decide(client, auth_headers, optimized_trip, "REJECTED", "  Layover too long  ").json()
    assert body["outcome"] == "REJECTED"
    assert body["reason"] == "Layover too long"
    assert trip_status(client, auth_headers, optimized_trip) == "DECIDED"


@pytest.mark.parametrize("reason", [None, "", "   "])
def test_reject_without_reason_is_400(client, auth_headers, optimized_trip, reason):
    response = decide(client, auth_headers, optimized_trip, "REJECTED", reason)
    assert response.status_code == 400
    assert response.json()["detail"] == "reason is required when outcome is REJECTED"
    assert trip_status(client, auth_headers, optimized_trip) == "OPTIMIZED"


def test_approve_can_carry_a_note(client, auth_headers, optimized_trip):
    body = decide(client, auth_headers, optimized_trip, "APPROVED", "Cheapest fit").json()
    assert body["reason"] == "Cheapest fit"


@pytest.mark.parametrize(
    "locked", [TripStatus.DRAFT, TripStatus.OPTIMIZING, TripStatus.OPTIMIZATION_FAILED, TripStatus.DECIDED]
)
def test_decide_wrong_status_is_409(client, auth_headers, optimized_trip, db, locked):
    set_status(db, optimized_trip, locked)
    response = decide(client, auth_headers, optimized_trip, "APPROVED")
    assert response.status_code == 409
    assert response.json()["detail"] == (
        f"Trip is {locked.value}; only OPTIMIZED or UNDER_REVIEW trips can be decided"
    )


def test_decided_trip_cannot_be_reoptimized(client, auth_headers, optimized_trip):
    decide(client, auth_headers, optimized_trip, "APPROVED")
    assert client.post(f"/trips/{optimized_trip}/optimize", headers=auth_headers).status_code == 409


def test_decide_unknown_outcome_is_422(client, auth_headers, optimized_trip):
    assert decide(client, auth_headers, optimized_trip, "MAYBE").status_code == 422


def test_decide_other_users_trip_is_404(client, other_headers, optimized_trip):
    response = decide(client, other_headers, optimized_trip, "APPROVED")
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_decide_requires_auth(client, optimized_trip):
    assert decide(client, {}, optimized_trip, "APPROVED").status_code == 401


# ---- GET /trips/{id}/decision ---------------------------------------------

def test_get_decision_returns_saved_decision(client, auth_headers, optimized_trip):
    decided = decide(client, auth_headers, optimized_trip, "REJECTED", "Too pricey").json()
    response = client.get(f"/trips/{optimized_trip}/decision", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == decided


def test_get_decision_before_deciding_is_404(client, auth_headers, optimized_trip):
    response = client.get(f"/trips/{optimized_trip}/decision", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip has not been decided yet"
