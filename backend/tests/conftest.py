import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

import app.models  # noqa: F401  (registers models on SQLModel.metadata)
from app.database import get_session
from app.main import app


@pytest.fixture
def client():
    # Fresh in-memory database per test; StaticPool keeps one connection so the
    # tables created here are visible to the app's sessions.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    def override_get_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def register_and_login(client, email, password="Trip@2026"):
    client.post("/auth/register", json={"email": email, "password": password})
    response = client.post("/auth/login", json={"email": email, "password": password})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def auth_headers(client):
    return register_and_login(client, "owner@example.com")


@pytest.fixture
def other_headers(client):
    return register_and_login(client, "other@example.com")


@pytest.fixture
def traveler_id(client, auth_headers):
    response = client.post("/traveler", json={"name": "Asha", "preferences": {}}, headers=auth_headers)
    return response.json()["id"]


@pytest.fixture
def trip_payload(traveler_id):
    return {
        "traveler_id": traveler_id,
        "dates": ["2026-11-01", "2026-11-05"],
        "budget": 60000,
        "preferences": {"class": "economy"},
    }
