import pytest

from app.database import get_session
from app.main import app
from app.make_admin import make_admin
from tests.conftest import register_and_login


def db_session():
    # The client fixture points get_session at its in-memory database; use the same one.
    return next(app.dependency_overrides[get_session]())


def test_promoted_user_gets_an_admin_token_and_sees_everyones_audit_events(client):
    member = register_and_login(client, "member@example.com")
    client.post("/traveler", json={"name": "Asha", "preferences": {}}, headers=member)
    register_and_login(client, "boss@example.com")

    message = make_admin(db_session(), "boss@example.com")
    assert "now an admin" in message

    # A fresh login carries the admin role, so the boss sees the member's events too.
    admin = register_and_login(client, "boss@example.com")
    actors = {e["actor"] for e in client.get("/audit", headers=admin).json()}
    assert "member@example.com" in actors


def test_email_match_ignores_case_and_spaces(client):
    register_and_login(client, "Boss@Example.com")
    assert "now an admin" in make_admin(db_session(), "  boss@example.COM ")


def test_running_it_twice_changes_nothing(client):
    register_and_login(client, "boss@example.com")
    make_admin(db_session(), "boss@example.com")
    assert "already an admin" in make_admin(db_session(), "boss@example.com")


def test_unknown_email_is_an_error(client):
    with pytest.raises(LookupError):
        make_admin(db_session(), "nobody@example.com")
