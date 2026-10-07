import uuid

import pytest
from sqlmodel import select

import app.pipeline.graph as graph
import app.routers.trips as trips_router
from app.database import get_session
from app.main import app
from app.models import Itinerary, Trip, TripStatus


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    # Template rationale: no network calls and the same text every run.
    monkeypatch.setattr(graph, "get_llm", lambda: None)


@pytest.fixture
def db(client):
    # A session on the same in-memory database the app is using in this test.
    sessions = app.dependency_overrides[get_session]()
    yield next(sessions)
    sessions.close()


def make_trip(client, headers, payload, **changes):
    return client.post("/trip", json={**payload, **changes}, headers=headers).json()["id"]


def optimize(client, headers, trip_id):
    return client.post(f"/trips/{trip_id}/optimize", headers=headers)


# ---- POST /trips/{id}/optimize ---------------------------------------------

def test_optimize_returns_itinerary_and_ledger(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload)
    response = optimize(client, auth_headers, trip_id)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "OPTIMIZED"
    assert body["reason"] is None
    itinerary = body["itinerary"]
    assert itinerary["total_cost"] == itinerary["flight"]["price"] + itinerary["hotel"]["price_per_night"] * 4
    assert itinerary["within_budget"] is True and itinerary["flags"] == []
    assert f"{itinerary['total_cost']:,.0f}" in itinerary["rationale"]
    assert sum(entry["won"] for entry in body["tradeoff_ledger"]) == 2


def test_optimize_moves_trip_to_optimized(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload)
    optimize(client, auth_headers, trip_id)
    trip = client.get(f"/trips/{trip_id}", headers=auth_headers).json()
    assert trip["status"] == "OPTIMIZED"
    assert trip["failure_reason"] is None


def test_optimize_over_budget_still_composes_with_flags(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload, budget=5000)
    body = optimize(client, auth_headers, trip_id).json()
    assert body["status"] == "OPTIMIZED"
    assert body["itinerary"]["within_budget"] is False
    assert "over the 5,000 budget" in body["itinerary"]["flags"][0]


def test_optimize_with_no_flights_fails_with_reason(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload, dates=["2030-01-01", "2030-01-03"])
    body = optimize(client, auth_headers, trip_id).json()
    assert body["status"] == "OPTIMIZATION_FAILED"
    assert body["itinerary"] is None and body["tradeoff_ledger"] == []
    assert body["reason"].startswith("No flights found from BLR to DEL")
    trip = client.get(f"/trips/{trip_id}", headers=auth_headers).json()
    assert trip["status"] == "OPTIMIZATION_FAILED"
    assert trip["failure_reason"] == body["reason"]


def test_optimize_pipeline_crash_fails_cleanly(client, auth_headers, trip_payload, monkeypatch):
    class Broken:
        def invoke(self, state):
            raise RuntimeError("boom")

    monkeypatch.setattr(trips_router, "pipeline", Broken())
    trip_id = make_trip(client, auth_headers, trip_payload)
    body = optimize(client, auth_headers, trip_id).json()
    assert body["status"] == "OPTIMIZATION_FAILED"
    assert body["reason"] == "The optimizer hit an unexpected error, please try again"


def test_reoptimize_replaces_itinerary_and_clears_failure(client, auth_headers, trip_payload, db):
    trip_id = make_trip(client, auth_headers, trip_payload)
    optimize(client, auth_headers, trip_id)
    trip = db.get(Trip, uuid.UUID(trip_id))
    trip.failure_reason = "old failure"
    trip.status = TripStatus.OPTIMIZATION_FAILED
    db.add(trip)
    db.commit()

    assert optimize(client, auth_headers, trip_id).json()["reason"] is None
    rows = db.exec(select(Itinerary).where(Itinerary.trip_id == trip.id)).all()
    assert len(rows) == 1


@pytest.mark.parametrize("locked", [TripStatus.OPTIMIZING, TripStatus.UNDER_REVIEW, TripStatus.DECIDED])
def test_optimize_locked_status_is_409(client, auth_headers, trip_payload, db, locked):
    trip_id = make_trip(client, auth_headers, trip_payload)
    trip = db.get(Trip, uuid.UUID(trip_id))
    trip.status = locked
    db.add(trip)
    db.commit()

    response = optimize(client, auth_headers, trip_id)
    assert response.status_code == 409
    assert response.json()["detail"] == (
        f"Trip is {locked.value}; only DRAFT, OPTIMIZED or OPTIMIZATION_FAILED trips can be optimized"
    )


def test_optimize_other_users_trip_is_404(client, auth_headers, other_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload)
    response = optimize(client, other_headers, trip_id)
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_optimize_requires_auth(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload)
    assert optimize(client, {}, trip_id).status_code == 401


# ---- GET /trips/{id}/itinerary --------------------------------------------

def test_get_itinerary_matches_optimize_result(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload)
    optimized = optimize(client, auth_headers, trip_id).json()
    response = client.get(f"/trips/{trip_id}/itinerary", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == optimized


def test_get_itinerary_after_failure_returns_reason(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload, dates=["2030-01-01", "2030-01-03"])
    optimize(client, auth_headers, trip_id)
    body = client.get(f"/trips/{trip_id}/itinerary", headers=auth_headers).json()
    assert body["status"] == "OPTIMIZATION_FAILED"
    assert body["itinerary"] is None and body["reason"]


def test_get_itinerary_before_optimize_is_404(client, auth_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload)
    response = client.get(f"/trips/{trip_id}/itinerary", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip has not been optimized yet"


def test_get_itinerary_other_users_trip_is_404(client, auth_headers, other_headers, trip_payload):
    trip_id = make_trip(client, auth_headers, trip_payload)
    optimize(client, auth_headers, trip_id)
    response = client.get(f"/trips/{trip_id}/itinerary", headers=other_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"
