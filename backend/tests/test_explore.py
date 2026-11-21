"""Tourist attractions and restaurants (app/places.py, GET /trips/{id}/explore).

OpenTripMap is never called: every request is answered from canned bodies shaped like its
OpenAPI spec (geoname, radius, xid).
"""
from datetime import datetime, timedelta, timezone

import pytest

from app import config, places
from app.database import get_session
from app.main import app
from app.models import CityPlaces
from app.travel_data import TravelDataError

GEONAME = {"name": "New Delhi", "country": "IN", "lat": 28.6139, "lon": 77.209, "population": 317797}
ATTRACTIONS = [
    {"xid": "W1", "name": "Red Fort", "dist": 3120.4, "kinds": "fortifications,historic,interesting_places",
     "point": {"lon": 77.2410, "lat": 28.6562}},
    {"xid": "W2", "name": "Qutub Minar", "dist": 8800, "kinds": "monuments_and_memorials,historic",
     "point": {"lon": 77.1855, "lat": 28.5245}},
    {"xid": "W3", "name": "", "dist": 100, "kinds": "historic", "point": {"lon": 77.2, "lat": 28.6}},  # unnamed
    {"xid": "W4", "name": "red fort", "dist": 3150, "kinds": "historic", "point": {"lon": 77.24, "lat": 28.65}},  # duplicate
]
DETAILS = {
    "W1": {"xid": "W1", "name": "Red Fort", "kinds": "fortifications,historic", "rate": "3h",
           "wikipedia": "https://en.wikipedia.org/wiki/Red_Fort",
           "preview": {"source": "https://upload.wikimedia.org/red-fort.jpg", "width": 400, "height": 300},
           "wikipedia_extracts": {"title": "Red Fort", "text": "The Red Fort is a historic fort in Delhi. " * 20},
           "point": {"lon": 77.2410, "lat": 28.6562}},
}
RESTAURANTS = [
    {"xid": "R1", "name": "Karim's", "dist": 3300, "kinds": "restaurants,foods", "point": {"lon": 77.233, "lat": 28.649}},
    {"xid": "R2", "name": "Haldiram's", "dist": 2100, "kinds": "fast_food,foods", "point": {"lon": 77.22, "lat": 28.63}},
]


class FakeOpenTripMap:
    def __init__(self):
        self.calls = []

    def __call__(self, provider, method, url, params=None, **kwargs):
        assert provider == "OpenTripMap" and params["apikey"] == "test-key"
        path = url.removeprefix(places.OTM_URL + "/")
        self.calls.append((path, dict(params)))
        if path == "geoname":
            return GEONAME
        if path == "radius":
            return RESTAURANTS if params["kinds"] == "foods" else ATTRACTIONS
        if path.startswith("xid/"):
            xid = path.removeprefix("xid/")
            if xid == "W2":
                raise TravelDataError("OpenTripMap search failed (HTTP 500)")
            return DETAILS.get(xid, {})
        raise AssertionError(path)


@pytest.fixture
def otm(monkeypatch):
    monkeypatch.setattr(config, "OPENTRIPMAP_API_KEY", "test-key")
    fake = FakeOpenTripMap()
    monkeypatch.setattr(places, "_request", fake)
    return fake


@pytest.fixture
def db(client):
    sessions = app.dependency_overrides[get_session]()
    yield next(sessions)
    sessions.close()


def trip_to(client, headers, trip_payload, destination="DEL", origin="BLR"):
    return client.post("/trip", json={**trip_payload, "origin": origin, "destination": destination},
                       headers=headers).json()["id"]


# ---- places.fetch_city ----------------------------------------------------------

def test_attractions_are_read_from_opentripmap_fields(otm):
    result = places.fetch_city("DEL")
    names = [a["name"] for a in result["attractions"]]
    assert names == ["Red Fort", "Qutub Minar"]  # unnamed and duplicate places dropped
    fort, minar = result["attractions"]
    assert fort["category"] == "Fort" and fort["rating"] == "3h"
    assert fort["image"] == "https://upload.wikimedia.org/red-fort.jpg"
    assert fort["wikipedia"] == "https://en.wikipedia.org/wiki/Red_Fort"
    assert fort["description"].startswith("The Red Fort is a historic fort") and fort["description"].endswith("...")
    assert len(fort["description"]) <= places.DESCRIPTION_CHARS + 3
    assert (fort["latitude"], fort["longitude"], fort["distance_m"]) == (28.6562, 77.2410, 3120)
    assert fort["data_label"] == "Map data" and fort["source"].startswith("OpenTripMap")
    # Its details call failed: kept, with nothing made up.
    assert minar["category"] == "Monument" and minar["description"] is None and minar["image"] is None


def test_restaurants_come_from_the_foods_category(otm):
    restaurants = places.fetch_city("DEL")["restaurants"]
    assert [(r["name"], r["category"]) for r in restaurants] == [("Karim's", "Restaurant"), ("Haldiram's", "Fast food")]


def test_city_is_located_by_name_and_country(otm):
    result = places.fetch_city("DEL")
    assert otm.calls[0] == ("geoname", {"name": "New Delhi", "country": "IN", "apikey": "test-key"})
    radius = [p for path, p in otm.calls if path == "radius"]
    assert radius[0]["lat"] == 28.6139 and radius[0]["radius"] == places.RADIUS_M
    assert radius[0]["rate"] == "3h"  # heritage sites are asked for first
    assert result["centre"] == {"latitude": 28.6139, "longitude": 77.209}


def test_no_key_means_places_are_unavailable(monkeypatch):
    monkeypatch.setattr(config, "OPENTRIPMAP_API_KEY", "")
    with pytest.raises(places.PlacesUnavailable, match="OPENTRIPMAP_API_KEY"):
        places.fetch_city("DEL")


def test_unknown_city_is_unavailable(otm):
    with pytest.raises(places.PlacesUnavailable, match="XYZ"):
        places.fetch_city("XYZ")


# ---- GET /trips/{id}/explore -----------------------------------------------------

def test_explore_returns_the_destinations_places(client, auth_headers, trip_payload, otm):
    trip_id = trip_to(client, auth_headers, trip_payload)
    response = client.get(f"/trips/{trip_id}/explore", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "DEL" and body["city_name"] == "New Delhi" and body["notice"] is None
    assert [a["name"] for a in body["attractions"]] == ["Red Fort", "Qutub Minar"]
    assert body["cached"] is False and body["fetched_at"]


def test_explore_is_cached_per_city(client, auth_headers, trip_payload, otm):
    first = trip_to(client, auth_headers, trip_payload)
    second = trip_to(client, auth_headers, trip_payload)
    client.get(f"/trips/{first}/explore", headers=auth_headers)
    calls = len(otm.calls)
    again = client.get(f"/trips/{second}/explore", headers=auth_headers).json()
    assert len(otm.calls) == calls  # served from city_places, no new OpenTripMap requests
    assert again["cached"] is True and [a["name"] for a in again["attractions"]] == ["Red Fort", "Qutub Minar"]


def test_stale_cache_is_fetched_again(client, db, auth_headers, trip_payload, otm):
    old = datetime.now(timezone.utc) - timedelta(days=config.PLACES_CACHE_DAYS + 1)
    db.add(CityPlaces(city="DEL", payload={"city": "DEL", "attractions": [], "restaurants": []}, fetched_at=old))
    db.commit()
    trip_id = trip_to(client, auth_headers, trip_payload)
    body = client.get(f"/trips/{trip_id}/explore", headers=auth_headers).json()
    assert body["cached"] is False and len(body["attractions"]) == 2


def test_explore_without_a_key_says_so(client, auth_headers, trip_payload, monkeypatch):
    monkeypatch.setattr(config, "OPENTRIPMAP_API_KEY", "")
    trip_id = trip_to(client, auth_headers, trip_payload)
    body = client.get(f"/trips/{trip_id}/explore", headers=auth_headers).json()
    assert body["attractions"] == [] and body["restaurants"] == []
    assert "OPENTRIPMAP_API_KEY" in body["notice"]


def test_explore_when_opentripmap_fails_says_so(client, auth_headers, trip_payload, otm, monkeypatch):
    def down(*a, **k):
        raise TravelDataError("OpenTripMap rate limit reached, please wait a minute and try again")
    monkeypatch.setattr(places, "_request", down)
    trip_id = trip_to(client, auth_headers, trip_payload)
    body = client.get(f"/trips/{trip_id}/explore", headers=auth_headers).json()
    assert body["attractions"] == [] and "rate limit" in body["notice"]


def test_explore_another_users_trip_is_404(client, auth_headers, other_headers, trip_payload, otm):
    trip_id = trip_to(client, auth_headers, trip_payload)
    assert client.get(f"/trips/{trip_id}/explore", headers=other_headers).status_code == 404
    assert client.get(f"/trips/{trip_id}/explore").status_code == 401


# ---- choosing the best-known places ------------------------------------------------

def spot(name, lat, lon, category="Historic place", rating="3h", wikipedia="https://w/x", image="https://i/x", dist=1000):
    return {"name": name, "category": category, "rating": rating, "wikipedia": wikipedia, "image": image,
            "latitude": lat, "longitude": lon, "distance_m": dist}


def test_heritage_and_wikipedia_places_rank_first():
    near_plain = spot("Corner Hall", 28.60, 77.20, rating="3", wikipedia=None, dist=200)
    far_heritage = spot("Red Fort", 28.656, 77.241, dist=4000)
    kept = places.best_attractions([near_plain, far_heritage])
    assert [k["name"] for k in kept] == ["Red Fort", "Corner Hall"]


def test_closed_and_uncategorised_places_are_dropped():
    kept = places.best_attractions([
        spot("Goa State Museum (closed)", 15.49, 73.82),
        spot("Anglo Arabic Public School", 28.64, 77.22, category=None),
        spot("Fontainhas", 15.50, 73.83),
    ])
    assert [k["name"] for k in kept] == ["Fontainhas"]


def test_one_site_listed_twice_is_kept_once_but_namesakes_far_apart_stay():
    kept = places.best_attractions([
        spot("Jantar Mantar, Delhi", 28.6271, 77.2166),
        spot("Jantar Mantar Astronomical Observatory", 28.6272, 77.2167, wikipedia=None),
        spot("Our Lady of the Immaculate Conception", 15.4986, 73.8292),
        spot("Our Lady of the Rosary", 15.5007, 73.9116),  # same first words, about 9 km away
    ])
    assert [k["name"] for k in kept] == [
        "Jantar Mantar, Delhi", "Our Lady of the Immaculate Conception", "Our Lady of the Rosary"]
