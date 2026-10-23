import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine

import app.models  # noqa: F401  (registers models on SQLModel.metadata)
from app import travel_data
from app.database import get_session
from app.main import app
from app.pipeline import graph


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch):
    # A real key in .env must never make tests call the LLM: that costs quota and
    # makes results depend on the network. Tests that need an LLM patch in a fake.
    monkeypatch.setattr(graph, "get_llm", lambda: None)


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def offline_search(monkeypatch):
    # Tests never call the real providers: search returns a fixed set of flights and hotels
    # instead, so results are repeatable and no API quota is spent.
    flights = json.loads((FIXTURES / "flights.json").read_text(encoding="utf-8"))
    hotels = json.loads((FIXTURES / "hotels.json").read_text(encoding="utf-8"))

    def search_flights(origin, destination, day, cabin_class=None):
        return [
            f
            for f in flights
            if f["origin"] == origin and f["destination"] == destination
            and f["departure_time"].startswith(day.isoformat())
        ]

    monkeypatch.setattr(travel_data, "search_flights", search_flights)
    monkeypatch.setattr(travel_data, "search_hotels", lambda city, check_in, check_out: [h for h in hotels if h["city"] == city])


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
        "origin": "BLR",
        "destination": "DEL",
        "dates": ["2026-11-01", "2026-11-05"],
        "budget": 60000,
        "preferences": {"class": "economy"},
    }
