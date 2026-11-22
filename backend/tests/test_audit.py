"""Audit trail: every traveler change, trip, pipeline run, review and decision is recorded."""
import pytest

from app.database import get_session
from app.main import app
from app.models import User, UserRole
from sqlmodel import select


@pytest.fixture
def db(client):
    sessions = app.dependency_overrides[get_session]()
    yield next(sessions)
    sessions.close()


def make_admin(db, email):
    user = db.exec(select(User).where(User.email == email)).one()
    user.role = UserRole.admin
    db.add(user)
    db.commit()


@pytest.fixture
def admin(db, auth_headers):
    """The trail is admin-only: the owner of the test trips is made an admin to read it."""
    make_admin(db, "owner@example.com")
    return auth_headers


def audit(client, headers, **params):
    response = client.get("/audit", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def types(events):
    # /audit is newest first; reversed reads in the order things happened.
    return [e["event_type"] for e in reversed(events)]


def create_trip(client, headers, payload):
    return client.post("/trip", json=payload, headers=headers).json()["id"]


# ---- what gets recorded ----------------------------------------------------

def test_full_trip_lifecycle_is_recorded_in_order(client, auth_headers, trip_payload, admin):
    trip_id = create_trip(client, auth_headers, trip_payload)
    client.post(f"/trips/{trip_id}/optimize", headers=auth_headers)
    client.post(f"/trips/{trip_id}/review", headers=auth_headers)
    client.post(f"/trips/{trip_id}/decision", json={"outcome": "APPROVED"}, headers=auth_headers)

    events = audit(client, admin)
    assert types(events) == ["TRAVELER_CREATED", "TRIP_CREATED", "PIPELINE_RUN", "REVIEW_STARTED", "DECISION"]
    assert all(e["actor"] == "owner@example.com" for e in events)
    assert types(audit(client, admin, trip_id=trip_id)) == [
        "TRIP_CREATED", "PIPELINE_RUN", "REVIEW_STARTED", "DECISION"
    ]


def test_pipeline_run_keeps_what_was_chosen_and_why(client, auth_headers, trip_payload, admin):
    trip_id = create_trip(client, auth_headers, trip_payload)
    result = client.post(f"/trips/{trip_id}/optimize", headers=auth_headers).json()

    (run,) = audit(client, admin, event_type="PIPELINE_RUN")
    payload, itinerary = run["payload"], result["itinerary"]
    assert run["trip_id"] == trip_id
    assert payload["total_cost"] == itinerary["total_cost"]
    assert payload["within_budget"] == itinerary["within_budget"]
    assert payload["flight"]["id"] == itinerary["flight"]["id"]
    assert payload["hotel"]["id"] == itinerary["hotel"]["id"]
    assert payload["rationale"] == itinerary["rationale"]
    assert payload["options_compared"] == len(result["tradeoff_ledger"])
    assert payload["request"]["origin"] == "BLR" and payload["request"]["start_date"] == "2026-11-01"
    assert "BLR→DEL" in run["summary"] and "within budget" in run["summary"]


def test_reoptimizing_keeps_every_earlier_run(client, auth_headers, trip_payload, admin):
    trip_id = create_trip(client, auth_headers, trip_payload)
    client.post(f"/trips/{trip_id}/optimize", headers=auth_headers)
    client.post(f"/trips/{trip_id}/optimize", headers=auth_headers)
    assert len(audit(client, admin, event_type="PIPELINE_RUN")) == 2


def test_failed_run_is_recorded_with_its_reason(client, auth_headers, trip_payload, admin):
    # The test fixtures have no flights on this day, so the pipeline fails.
    trip_id = create_trip(client, auth_headers, {**trip_payload, "dates": ["2026-12-25", "2026-12-27"]})
    result = client.post(f"/trips/{trip_id}/optimize", headers=auth_headers).json()
    assert result["status"] == "OPTIMIZATION_FAILED"

    (failed,) = audit(client, admin, event_type="PIPELINE_FAILED")
    assert failed["payload"]["failure_reason"] == result["reason"]
    assert result["reason"] in failed["summary"]


def test_rejection_keeps_the_reason_and_the_itinerary_it_rejected(client, auth_headers, trip_payload, admin):
    trip_id = create_trip(client, auth_headers, trip_payload)
    itinerary = client.post(f"/trips/{trip_id}/optimize", headers=auth_headers).json()["itinerary"]
    client.post(f"/trips/{trip_id}/decision", json={"outcome": "REJECTED", "reason": "Too early a flight"},
                headers=auth_headers)

    (decision,) = audit(client, admin, event_type="DECISION")
    assert decision["payload"]["outcome"] == "REJECTED"
    assert decision["payload"]["reason"] == "Too early a flight"
    assert decision["payload"]["total_cost"] == itinerary["total_cost"]
    assert decision["summary"] == "Rejected BLR→DEL: Too early a flight"


def test_traveler_update_and_delete_are_recorded(client, auth_headers, admin):
    traveler_id = client.post("/traveler", json={"name": "Ravi", "preferences": {}}, headers=auth_headers).json()["id"]
    client.put(f"/traveler/{traveler_id}", json={"name": "Ravi K", "preferences": {"seat": "aisle"}},
               headers=auth_headers)
    client.delete(f"/traveler/{traveler_id}", headers=auth_headers)

    events = audit(client, admin)
    assert types(events)[-3:] == ["TRAVELER_CREATED", "TRAVELER_UPDATED", "TRAVELER_DELETED"]
    updated = next(e for e in events if e["event_type"] == "TRAVELER_UPDATED")
    assert updated["payload"]["before"] == {"name": "Ravi", "preferences": {}}
    assert updated["payload"]["after"] == {"name": "Ravi K", "preferences": {"seat": "aisle"}}
    assert all(e["trip_id"] is None for e in events)


def test_rejected_actions_record_nothing(client, auth_headers, trip_payload, admin):
    trip_id = create_trip(client, auth_headers, trip_payload)
    before = len(audit(client, admin))
    assert client.post(f"/trips/{trip_id}/review", headers=auth_headers).status_code == 409  # still DRAFT
    assert client.post(f"/trips/{trip_id}/decision", json={"outcome": "APPROVED"},
                       headers=auth_headers).status_code == 409
    assert len(audit(client, admin)) == before


# ---- who sees what ---------------------------------------------------------

def test_members_cannot_read_the_trail(client, auth_headers, other_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload)
    for headers in (auth_headers, other_headers):  # not even their own events
        response = client.get("/audit", headers=headers)
        assert response.status_code == 403 and response.json()["detail"] == "The audit trail is for admins only"
    assert client.get("/audit", params={"trip_id": trip_id}, headers=other_headers).status_code == 403


def test_admins_see_everyones_events(client, db, auth_headers, other_headers, trip_payload):
    create_trip(client, auth_headers, trip_payload)
    client.post("/traveler", json={"name": "Neha", "preferences": {}}, headers=other_headers)
    make_admin(db, "other@example.com")

    actors = {e["actor"] for e in audit(client, other_headers)}
    assert actors == {"owner@example.com", "other@example.com"}


def test_audit_needs_a_login(client):
    assert client.get("/audit").status_code == 401


def test_limit_is_bounded(client, auth_headers):
    assert client.get("/audit", params={"limit": 0}, headers=auth_headers).status_code == 422
    assert client.get("/audit", params={"limit": 501}, headers=auth_headers).status_code == 422


def test_limit_returns_the_newest_events(client, auth_headers, trip_payload, admin):
    create_trip(client, auth_headers, trip_payload)
    (newest,) = audit(client, admin, limit=1)
    assert newest["event_type"] == "TRIP_CREATED"


# ---- who did it: email and display name ---------------------------------------

def test_events_name_the_actor_once_they_set_a_name(client, auth_headers, trip_payload, admin):
    create_trip(client, auth_headers, trip_payload)
    before = audit(client, admin)[0]
    assert before["actor"] == "owner@example.com" and before["actor_name"] is None

    client.patch("/me", json={"name": "Asha Rao"}, headers=auth_headers)
    # The name is looked up when the trail is read, so earlier events show it too.
    events = audit(client, admin)
    assert {e["actor_name"] for e in events} == {"Asha Rao"}
    assert {e["actor"] for e in events} == {"owner@example.com"}


def test_admins_see_each_actors_own_name(client, db, auth_headers, other_headers, trip_payload):
    client.patch("/me", json={"name": "Owner One"}, headers=auth_headers)
    create_trip(client, auth_headers, trip_payload)
    client.post("/traveler", json={"name": "Someone"}, headers=other_headers)
    make_admin(db, "other@example.com")
    names = {e["actor"]: e["actor_name"] for e in audit(client, other_headers)}
    assert names == {"owner@example.com": "Owner One", "other@example.com": None}
