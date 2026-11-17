"""Settings endpoints (GET/PATCH /me, GET/PUT /policy) and the optimizer following the policy."""
import pytest
from sqlmodel import select

from app.database import get_session
from app.main import app
from app.models import User, UserRole

POLICY = {
    "manager_approval_flight_over": 25000,
    "max_nightly_rate": 8000,
    "max_nightly_rate_intl": 18000,
    "business_class_min_hours": 6,
    "advance_booking_days": 0,
    "preferred_airlines": ["IndiGo"],
}


@pytest.fixture
def db(client):
    sessions = app.dependency_overrides[get_session]()
    yield next(sessions)
    sessions.close()


@pytest.fixture
def admin_headers(client, db, auth_headers):
    user = db.exec(select(User).where(User.email == "owner@example.com")).first()
    user.role = UserRole.admin
    db.add(user)
    db.commit()
    return auth_headers  # the role is read from the database on every request


def put_policy(client, headers, **changes):
    return client.put("/policy", json={**POLICY, **changes}, headers=headers)


def optimized(client, headers, trip_payload, **preferences):
    trip = client.post("/trip", json={**trip_payload, "preferences": preferences}, headers=headers).json()
    return client.post(f"/trips/{trip['id']}/optimize", headers=headers).json()


# ---- /me --------------------------------------------------------------------

def test_me_starts_without_a_name(client, auth_headers):
    body = client.get("/me", headers=auth_headers).json()
    assert body["email"] == "owner@example.com" and body["name"] is None and body["role"] == "member"


def test_register_can_set_a_name(client):
    response = client.post("/auth/register", json={"email": "named@example.com", "password": "Trip@2026", "name": "  Asha Rao "})
    assert response.status_code == 201 and response.json()["name"] == "Asha Rao"


def test_patch_me_saves_the_name(client, auth_headers):
    response = client.patch("/me", json={"name": " QA Tester "}, headers=auth_headers)
    assert response.status_code == 200 and response.json()["name"] == "QA Tester"
    assert client.get("/me", headers=auth_headers).json()["name"] == "QA Tester"


def test_patch_me_rejects_blank_or_long_names_and_ignores_email(client, auth_headers):
    for bad in ({"name": "   "}, {"name": ""}, {"name": "x" * 101}, {}):
        assert client.patch("/me", json=bad, headers=auth_headers).status_code == 422, bad
    client.patch("/me", json={"name": "Ok", "email": "new@example.com"}, headers=auth_headers)
    assert client.get("/me", headers=auth_headers).json()["email"] == "owner@example.com"


def test_me_requires_auth(client):
    assert client.get("/me").status_code == 401
    assert client.patch("/me", json={"name": "x"}).status_code == 401


# ---- /policy ----------------------------------------------------------------

def test_policy_defaults_until_an_admin_saves_one(client, auth_headers):
    body = client.get("/policy", headers=auth_headers).json()
    assert body["updated_at"] is None and body["updated_by"] is None
    assert set(POLICY) <= set(body)


def test_members_cannot_change_the_policy(client, auth_headers):
    assert put_policy(client, auth_headers).status_code == 403


def test_admin_saves_the_policy_and_everyone_reads_it(client, admin_headers, other_headers):
    response = put_policy(client, admin_headers, max_nightly_rate=5000)
    assert response.status_code == 200
    body = client.get("/policy", headers=other_headers).json()
    assert body["max_nightly_rate"] == 5000 and body["preferred_airlines"] == ["IndiGo"]
    assert body["updated_by"] == "owner@example.com" and body["updated_at"]


def test_policy_change_is_audited_once_with_before_and_after(client, admin_headers):
    put_policy(client, admin_headers)
    put_policy(client, admin_headers, max_nightly_rate=5000)
    put_policy(client, admin_headers, max_nightly_rate=5000)  # no change: no event
    events = [e for e in client.get("/audit", headers=admin_headers).json() if e["event_type"] == "POLICY_UPDATED"]
    assert len(events) == 2
    assert events[0]["payload"]["changes"] == {"max_nightly_rate": {"before": 8000.0, "after": 5000.0}}


def test_policy_validation(client, admin_headers):
    for bad in ({"max_nightly_rate": 0}, {"advance_booking_days": -1}, {"business_class_min_hours": 30}):
        assert put_policy(client, admin_headers, **bad).status_code == 422, bad


# ---- the optimizer follows the policy ----------------------------------------

def test_hotel_above_the_policy_cap_is_screened_out(client, admin_headers, trip_payload):
    put_policy(client, admin_headers, max_nightly_rate=9000)
    # Comfort would pick the best-rated hotel, HT-2003 at 9,500 a night; the cap rules it out.
    result = optimized(client, admin_headers, trip_payload, priority="comfort")
    assert result["itinerary"]["hotel"]["id"] == "HT-2001"
    row = next(r for r in result["tradeoff_ledger"] if r["alternative"].startswith("HT-2003"))
    assert "policy_hotel_cap" in row["reason"] and "domestic hotels at 9,000" in row["reason"]


def test_short_business_class_flight_is_screened_out(client, admin_headers, trip_payload):
    put_policy(client, admin_headers)
    result = optimized(client, admin_headers, trip_payload)
    row = next(r for r in result["tradeoff_ledger"] if r["alternative"].startswith("FL-1005"))
    assert "policy_business_class" in row["reason"]


def test_expensive_flight_and_late_booking_are_flagged_not_blocked(client, admin_headers, trip_payload):
    put_policy(client, admin_headers, manager_approval_flight_over=3000, advance_booking_days=14)
    result = optimized(client, admin_headers, trip_payload)
    assert result["status"] == "OPTIMIZED"
    flags = result["itinerary"]["flags"]
    assert any("needs manager approval" in f and "FL-1004" in f for f in flags)
    assert any("at least 14 days ahead" in f for f in flags)


def test_swapping_a_flight_refreshes_the_policy_flags(client, admin_headers, trip_payload):
    put_policy(client, admin_headers, manager_approval_flight_over=4000)
    trip_id = client.post("/trip", json=trip_payload, headers=admin_headers).json()["id"]
    first = client.post(f"/trips/{trip_id}/optimize", headers=admin_headers).json()
    assert not any("manager approval" in f for f in first["itinerary"]["flags"])
    edited = client.patch(
        f"/trips/{trip_id}/itinerary", json={"kind": "flight", "option_id": "FL-1001"}, headers=admin_headers
    ).json()
    assert [f for f in edited["itinerary"]["flags"] if "manager approval" in f] == [
        "Flight FL-1001 costs 5,200, over the 4,000 company limit: needs manager approval"
    ]
