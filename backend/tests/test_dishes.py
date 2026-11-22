"""Famous local dishes (app/dishes.py) and their place in GET /trips/{id}/explore.

No network and no real LLM: the model's answer and Wikipedia's pages are canned.
"""
import json

import pytest

from app import config, dishes, places
from app.database import get_session
from app.main import app
from app.models import CityPlaces
from app.pipeline import graph


class FakeLLM:
    def __init__(self, text):
        self.text, self.prompts = text, []

    def invoke(self, prompt):
        self.prompts.append(prompt)
        return type("Reply", (), {"content": self.text})()


ANSWER = json.dumps([
    {"name": "Butter chicken", "description": "Chicken in a mild tomato and butter gravy."},
    {"name": "Pork Vindaloo", "description": "A hot and sour pork curry."},
    {"name": "Goan fish curry", "description": "Fish in a coconut and tamarind curry."},
    {"name": "Thali", "description": "A platter of 8 small dishes."},  # a number: dropped
    {"name": "butter chicken", "description": "Repeated."},  # duplicate: dropped
    {"name": "", "description": "No name."},  # dropped
])

PAGES = {
    "Butter_chicken": {"type": "standard", "title": "Butter chicken", "extract": "Butter chicken is a curry. " * 20,
                       "thumbnail": {"source": "https://upload.wikimedia.org/butter.jpg"},
                       "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Butter_chicken"}}},
    "Vindaloo": {"type": "standard", "title": "Vindaloo", "extract": "Vindaloo is a curry from Goa.",
                 "thumbnail": {"source": "https://upload.wikimedia.org/vindaloo.jpg"},
                 "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Vindaloo"}}},
    "Fish_curry": {"type": "standard", "title": "Fish curry", "extract": "Any curry with fish.",
                   "thumbnail": {"source": "https://upload.wikimedia.org/fish.jpg"}},
}
SEARCH = {"Pork Vindaloo": ["Vindaloo", "Pork"], "Goan fish curry": ["Fish curry", "Goan cuisine"]}


@pytest.fixture
def wiki(monkeypatch):
    asked = []

    def fake_get(url, **params):
        asked.append((url, params))
        if url.startswith(dishes.WIKIPEDIA_SUMMARY):
            return PAGES.get(url.removeprefix(dishes.WIKIPEDIA_SUMMARY))
        if url == dishes.WIKIPEDIA_SEARCH:
            return {"pages": [{"title": t} for t in SEARCH.get(params["q"], [])]}
        raise AssertionError(url)

    monkeypatch.setattr(dishes, "_get", fake_get)
    return asked


@pytest.fixture
def llm(monkeypatch):
    fake = FakeLLM(ANSWER)
    monkeypatch.setattr(graph, "get_llm", lambda: fake)
    return fake


def test_dishes_are_cleaned_and_labelled_as_ai_suggestions(llm, wiki):
    found = dishes.local_dishes("Goa", "India")
    assert [d["name"] for d in found] == ["Butter chicken", "Pork Vindaloo", "Goan fish curry"]
    assert all(d["data_label"] == "AI suggestion" for d in found)
    assert "Do not mention prices" in llm.prompts[0] and "Goa, India" in llm.prompts[0]


def test_wikipedia_gives_photos_by_title_or_by_a_specific_search_match(llm, wiki):
    butter, vindaloo, fish = dishes.local_dishes("Goa", "India")
    assert butter["image"] == "https://upload.wikimedia.org/butter.jpg" and butter["image_label"] == "Photo: Wikipedia"
    assert butter["wikipedia_text"].endswith("...") and len(butter["wikipedia_text"]) <= dishes.WIKI_TEXT_CHARS + 3
    assert vindaloo["wikipedia"] == "https://en.wikipedia.org/wiki/Vindaloo"  # found through search
    # "Fish curry" and "Goan cuisine" share only generic words: no photo rather than a wrong one.
    assert fish["image"] is None and fish["image_label"] is None and fish["ai_description"]


def test_a_fenced_answer_is_read_and_a_non_json_answer_gives_nothing(monkeypatch, wiki):
    monkeypatch.setattr(graph, "get_llm", lambda: FakeLLM(f"```json\n{ANSWER}\n```"))
    assert len(dishes.local_dishes("Goa", "India")) == 3
    monkeypatch.setattr(graph, "get_llm", lambda: FakeLLM("Sorry, I can't help with that."))
    assert dishes.local_dishes("Goa", "India") == []


def test_no_llm_means_dishes_are_unavailable():
    with pytest.raises(dishes.DishesUnavailable, match="OPENAI_API_KEY"):
        dishes.local_dishes("Goa", "India")  # conftest switches the real LLM off


# ---- in GET /trips/{id}/explore ------------------------------------------------------

@pytest.fixture
def db(client):
    sessions = app.dependency_overrides[get_session]()
    yield next(sessions)
    sessions.close()


@pytest.fixture
def no_places(monkeypatch):
    monkeypatch.setattr(config, "OPENTRIPMAP_API_KEY", "")


def trip_to_delhi(client, headers, payload):
    return client.post("/trip", json={**payload, "destination": "DEL"}, headers=headers).json()["id"]


def test_explore_includes_dishes_even_without_places(client, auth_headers, trip_payload, llm, wiki, no_places):
    trip_id = trip_to_delhi(client, auth_headers, trip_payload)
    body = client.get(f"/trips/{trip_id}/explore", headers=auth_headers).json()
    assert "OPENTRIPMAP_API_KEY" in body["notice"]
    assert [d["name"] for d in body["dishes"]] == ["Butter chicken", "Pork Vindaloo", "Goan fish curry"]
    assert body["dishes_notice"] is None
    assert "New Delhi, India" in llm.prompts[0]


def test_dishes_are_saved_with_the_citys_places(client, db, auth_headers, trip_payload, llm, wiki, monkeypatch):
    monkeypatch.setattr(places, "fetch_city", lambda city: {"version": places.PAYLOAD_VERSION, "city": city, "attractions": [], "restaurants": []})
    monkeypatch.setattr(config, "OPENTRIPMAP_API_KEY", "key")
    trip_id = trip_to_delhi(client, auth_headers, trip_payload)
    client.get(f"/trips/{trip_id}/explore", headers=auth_headers)
    again = client.get(f"/trips/{trip_id}/explore", headers=auth_headers).json()
    assert len(llm.prompts) == 1  # the second view used the saved dishes
    assert len(again["dishes"]) == 3
    assert "dishes" in db.get(CityPlaces, "DEL").payload


def test_explore_says_why_there_are_no_dishes(client, auth_headers, trip_payload, no_places):
    trip_id = trip_to_delhi(client, auth_headers, trip_payload)
    body = client.get(f"/trips/{trip_id}/explore", headers=auth_headers).json()
    assert body["dishes"] == [] and "OPENAI_API_KEY" in body["dishes_notice"]


def test_a_failing_llm_is_reported_and_not_saved(client, auth_headers, trip_payload, wiki, no_places, monkeypatch):
    class Broken:
        def invoke(self, prompt):
            raise RuntimeError("503 model overloaded")
    monkeypatch.setattr(graph, "get_llm", lambda: Broken())
    trip_id = trip_to_delhi(client, auth_headers, trip_payload)
    body = client.get(f"/trips/{trip_id}/explore", headers=auth_headers).json()
    assert body["dishes"] == [] and "couldn't be loaded" in body["dishes_notice"]
