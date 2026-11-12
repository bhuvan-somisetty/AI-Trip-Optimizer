"""GET /dashboard: total spend, average savings and average turnaround (PRD US-010)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import select

import app.pipeline.graph as graph
from app.database import get_session
from app.main import app
from app.models import Decision, Trip, User, UserRole
from tests.conftest import register_and_login


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)


def decided_trip(client, headers, payload, outcome="APPROVED", **changes):
    trip_id = client.post("/trip", json={**payload, **changes}, headers=headers).json()["id"]
    result = client.post(f"/trips/{trip_id}/optimize", headers=headers).json()
    body = {"outcome": outcome} if outcome == "APPROVED" else {"outcome": outcome, "reason": "Too pricey"}
    client.post(f"/trips/{trip_id}/decision", json=body, headers=headers)
    return trip_id, result["itinerary"]


def test_dashboard_totals_approved_trips(client, auth_headers, trip_payload):
    _, first = decided_trip(client, auth_headers, trip_payload)
    _, second = decided_trip(client, auth_headers, trip_payload, preferences={"max_stops": 0})
    decided_trip(client, auth_headers, trip_payload, outcome="REJECTED")
    client.post("/trip", json=trip_payload, headers=auth_headers)  # created, never decided

    body = client.get("/dashboard", headers=auth_headers).json()
    assert body["period"] == "all"
    assert body["trips_created"] == 4
    assert body["trips_decided"] == 3
    assert body["approved"] == 2 and body["rejected"] == 1
    assert body["total_spend"] == first["total_cost"] + second["total_cost"]
    assert body["avg_savings"] == (first["savings"] + second["savings"]) / 2
    assert body["avg_turnaround_hours"] is not None and body["avg_turnaround_hours"] >= 0


def test_dashboard_turnaround_is_creation_to_decision(client, auth_headers, trip_payload):
    trip_id, _ = decided_trip(client, auth_headers, trip_payload)
    with next(app.dependency_overrides[get_session]()) as db:
        trip = db.get(Trip, uuid.UUID(trip_id))
        decision = db.exec(select(Decision)).one()
        trip.created_at = datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc)
        decision.decided_at = trip.created_at + timedelta(hours=6, minutes=30)
        db.add(trip)
        db.add(decision)
        db.commit()
    assert client.get("/dashboard", headers=auth_headers).json()["avg_turnaround_hours"] == 6.5


def test_dashboard_period_counts_trips_by_decision_date(client, auth_headers, trip_payload):
    decided_trip(client, auth_headers, trip_payload)
    with next(app.dependency_overrides[get_session]()) as db:
        decision = db.exec(select(Decision)).one()
        decision.decided_at = datetime(2026, 8, 15, tzinfo=timezone.utc)
        db.add(decision)
        db.commit()
    assert client.get("/dashboard?period=2026-Q3", headers=auth_headers).json()["approved"] == 1
    assert client.get("/dashboard?period=2026-08", headers=auth_headers).json()["approved"] == 1
    assert client.get("/dashboard?period=2026", headers=auth_headers).json()["approved"] == 1
    empty = client.get("/dashboard?period=2026-Q4", headers=auth_headers).json()
    assert empty["approved"] == 0 and empty["total_spend"] == 0
    assert empty["avg_savings"] is None and empty["avg_turnaround_hours"] is None


@pytest.mark.parametrize("period", ["Q4", "2026-Q5", "2026-13", "26"])
def test_dashboard_rejects_bad_periods(client, auth_headers, period):
    assert client.get(f"/dashboard?period={period}", headers=auth_headers).status_code == 422


def test_members_see_only_their_trips_and_admins_see_all(client, auth_headers, other_headers, trip_payload):
    decided_trip(client, auth_headers, trip_payload)
    assert client.get("/dashboard", headers=other_headers).json()["trips_created"] == 0

    admin_headers = register_and_login(client, "admin@example.com")
    with next(app.dependency_overrides[get_session]()) as db:
        admin = db.exec(select(User).where(User.email == "admin@example.com")).one()
        admin.role = UserRole.admin
        db.add(admin)
        db.commit()
    # The role is read from the database on each request, so the old token works.
    assert client.get("/dashboard", headers=admin_headers).json()["approved"] == 1


def test_dashboard_needs_a_login(client):
    assert client.get("/dashboard").status_code == 401
