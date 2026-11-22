"""Destination pages and nearby places without a trip (app/routers/discover.py).

No network: places, Wikipedia and OpenTripMap are canned.
"""
import pytest

from app import config, dishes, places, travel_data
import app.routers.explore as explore

CITY = {"version": places.PAYLOAD_VERSION, "city": "VNS", "city_name": "Varanasi",
        "attractions": [{"name": "Sarnath", "section": "history_culture"}, {"name": "Assi Ghat", "section": "explore"}],
        "restaurants": [{"name": "Kashi Chat Bhandar", "latitude": None}], "food_spots": [], "source": places.SOURCE}
SUMMARY = {"type": "standard", "title": "Varanasi", "extract": "Varanasi is a city on the Ganges. " * 30,
           "thumbnail": {"source": "https://upload.wikimedia.org/varanasi.jpg"},
           "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Varanasi"}}}


@pytest.fixture
def city(monkeypatch):
    monkeypatch.setattr(travel_data, "_cache", {})
    monkeypatch.setattr(explore, "explore_city", lambda session, code: CITY)
    monkeypatch.setattr(explore, "dishes_for", lambda session, code: ([], "no AI model in tests"))
    monkeypatch.setattr(dishes, "_summary", lambda title: SUMMARY if title == "Varanasi" else None)


def test_a_destination_page_for_any_airport_city(client, auth_headers, city):
    body = client.get("/destinations/vns", headers=auth_headers).json()
    assert body["city_name"] == "Varanasi" and body["country_name"] == "India"
    assert [a["name"] for a in body["attractions"] if a["section"] == "history_culture"] == ["Sarnath"]
    assert body["overview"]["wikipedia"] == "https://en.wikipedia.org/wiki/Varanasi"
    assert body["overview"]["text"].endswith("...") and len(body["overview"]["text"]) <= 603
    assert body["overview"]["image_label"] == "Photo: Wikipedia"
    assert body["location"] == {"latitude": 25.4522, "longitude": 82.8625}


def test_destination_needs_a_login_and_a_known_code(client, auth_headers, city):
    assert client.get("/destinations/VNS").status_code == 401
    assert client.get("/destinations/ZZZ", headers=auth_headers).status_code == 404


def test_destination_without_a_wikipedia_page_has_no_overview(client, auth_headers, city, monkeypatch):
    monkeypatch.setattr(dishes, "_summary", lambda title: None)
    monkeypatch.setattr(dishes, "_get", lambda url, **params: {"pages": []})
    assert client.get("/destinations/VNS", headers=auth_headers).json()["overview"] is None


# ---- GET /places/nearby ------------------------------------------------------------

@pytest.fixture
def otm(monkeypatch):
    monkeypatch.setattr(config, "OPENTRIPMAP_API_KEY", "test-key")
    monkeypatch.setattr(travel_data, "_cache", {})
    asked = []

    def fake(path, **params):
        asked.append((path, params))
        if path == "radius" and params["kinds"] == "foods":
            return [{"xid": "R1", "name": "Blue Lassi", "dist": 420, "kinds": "cafes,foods", "point": {"lat": 25.31, "lon": 83.01}}]
        if path == "radius":
            return [{"xid": "A1", "name": "Kashi Vishwanath Temple", "dist": 650, "kinds": "religion,interesting_places",
                     "point": {"lat": 25.3109, "lon": 83.0107}}, {"xid": "A2", "name": "", "dist": 10}]
        return {"name": "Kashi Vishwanath Temple", "kinds": "religion", "rate": "3h",
                "preview": {"source": "https://upload.wikimedia.org/kv.jpg"}, "point": {"lat": 25.3109, "lon": 83.0107}}
    monkeypatch.setattr(places, "_otm", fake)
    return asked


def test_places_near_a_point(client, auth_headers, otm):
    params = {"lat": 25.3176, "lon": 82.9739, "radius_m": 2000}
    body = client.get("/places/nearby", params=params, headers=auth_headers).json()
    assert [a["name"] for a in body["attractions"]] == ["Kashi Vishwanath Temple"]  # the unnamed one is dropped
    assert body["attractions"][0]["image"] == "https://upload.wikimedia.org/kv.jpg" and body["attractions"][0]["distance_m"] == 650
    assert [r["name"] for r in body["restaurants"]] == ["Blue Lassi"] and body["notice"] is None
    assert otm[0][1]["radius"] == 2000 and otm[0][1]["lat"] == 25.3176
    client.get("/places/nearby", params=params, headers=auth_headers)
    assert len(otm) == 3  # the second look at the same spot is cached


def test_nearby_needs_a_login_valid_coordinates_and_a_key(client, auth_headers, otm, monkeypatch):
    assert client.get("/places/nearby", params={"lat": 25.3, "lon": 83.0}).status_code == 401
    assert client.get("/places/nearby", params={"lat": 95, "lon": 83.0}, headers=auth_headers).status_code == 422
    monkeypatch.setattr(config, "OPENTRIPMAP_API_KEY", "")
    body = client.get("/places/nearby", params={"lat": 25.3, "lon": 83.0}, headers=auth_headers).json()
    assert body["attractions"] == [] and "OPENTRIPMAP_API_KEY" in body["notice"]
