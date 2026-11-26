"""Real photos on every destination card: Google Maps restaurants, and a photo looked up for places
that came without one (Wikimedia Commons when the file is named after the place, else Google Maps),
saved with the city's cached places so a second view makes no searches."""
from datetime import datetime, timezone

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import config, photos, travel_data
from app.models import CityPlaces

CENTRE = {"latitude": 15.4989, "longitude": 73.8278}


def maps_row(title, lat=15.4939, lon=73.8196, thumb=True, **extra):
    return {"title": title, "gps_coordinates": {"latitude": lat, "longitude": lon}, "place_id": f"pid-{title}",
            "thumbnail": f"https://lh3.example/{title}.jpg" if thumb else None, **extra}


@pytest.fixture
def online(monkeypatch):
    """Answers SerpApi (Google Maps) and Commons from tables; records every call."""
    monkeypatch.setattr(config, "SERPAPI_API_KEY", "test-key")
    monkeypatch.setattr(travel_data, "_cache", {})
    calls = {"maps": [], "commons": []}
    answers = {"maps": {}, "commons": {}}

    def request(provider, method, url, params=None, **kwargs):
        if provider == "SerpApi":
            calls["maps"].append(params["q"])
            return answers["maps"].get(params["q"], {})
        calls["commons"].append(params["ggscoord"])
        return answers["commons"].get(params["ggscoord"], {})

    monkeypatch.setattr(photos, "_request", request)
    return calls, answers


@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def commons_page(title, index=1):
    return {"title": f"File:{title}.jpg", "index": index, "imageinfo": [{
        "url": f"https://upload.wikimedia.org/{title}.jpg", "thumburl": f"https://upload.wikimedia.org/640px-{title}.jpg",
        "descriptionurl": f"https://commons.wikimedia.org/wiki/File:{title}.jpg",
        "extmetadata": {"Artist": {"value": "<a href='x'>Jane Doe</a>"}}}]}


def test_restaurants_come_from_google_maps_with_photo_rating_and_hours(online):
    calls, answers = online
    answers["maps"]["restaurants in Goa, India"] = {"local_results": [
        maps_row("The Fisherman's Wharf", rating=4.7, reviews=29914, type="Seafood restaurant",
                 address="Campal, Panaji", operating_hours={"tuesday": "12-11 PM", "monday": "12-11 PM"}),
        maps_row("No Photo Diner", thumb=False),
    ]}
    found = photos.maps_restaurants("Goa, India", CENTRE)
    assert [r["name"] for r in found] == ["The Fisherman's Wharf"]  # never a card without a photo
    r = found[0]
    assert r["image"].endswith(".jpg") and r["image_label"] == "Photo: Google Maps" and r["data_label"] == "Google Maps"
    assert r["google"]["rating"] == 4.7 and r["google"]["rating_count"] == 29914
    assert r["google"]["opening_hours"] == ["Monday: 12-11 PM", "Tuesday: 12-11 PM"]
    assert r["distance_m"] > 0 and "query_place_id=pid-" in r["google"]["maps_url"]


def test_a_place_gets_a_commons_photo_only_when_the_file_is_named_after_it(online):
    calls, answers = online
    point = {"name": "Miramar beach", "latitude": 15.48306, "longitude": 73.80722}
    answers["commons"]["15.48306|73.80722"] = {"query": {"pages": {
        "1": commons_page("Buns, a breakfast delicacy", 1),  # nearest, but another subject
        "2": commons_page("Sunset @miramar Goa", 2),
    }}}
    [item] = photos.with_photos([point], known := {}, [8])
    assert item["image"] == "https://upload.wikimedia.org/640px-Sunset @miramar Goa.jpg"
    assert item["image_label"] == "Photo: Wikimedia Commons" and item["photo_attribution"]["author"] == "Jane Doe"
    assert calls["maps"] == []  # Commons had it, so no Google Maps search
    assert known  # the answer is remembered


def test_google_maps_fills_in_and_a_place_with_no_photo_anywhere_is_left_out(online):
    calls, answers = online
    plaza = {"name": "Patto Plaza", "latitude": 15.49634, "longitude": 73.83382}
    haunted = {"name": "Haunted House", "latitude": 15.52573, "longitude": 73.82737}
    far = {"name": "Old Fort", "latitude": 15.40, "longitude": 73.90}
    answers["maps"]["Patto Plaza"] = {"place_results": maps_row("Patto Plaza", 15.4965, 73.8340)}
    answers["maps"]["Old Fort"] = {"local_results": [maps_row("Old Fort Cafe", 15.60, 73.95)]}  # too far away
    out = photos.with_photos([plaza, haunted, far, {"name": "Has one", "image": "x.jpg", "latitude": 1, "longitude": 1}], {}, [8])
    assert [p["name"] for p in out] == ["Patto Plaza", "Has one"]
    assert out[0]["image_label"] == "Photo: Google Maps"


def test_places_are_kept_when_google_maps_cannot_be_asked(online, monkeypatch):
    calls, answers = online
    item = {"name": "Haunted House", "latitude": 15.52573, "longitude": 73.82737}
    assert photos.with_photos([item], {}, [0]) == [item]  # no searches left in this view
    monkeypatch.setattr(config, "SERPAPI_API_KEY", "")
    assert photos.with_photos([item], {}, [8]) == [item]


def test_answers_are_saved_with_the_city_so_a_second_view_searches_nothing(online, session):
    calls, answers = online
    session.add(CityPlaces(city="GOI", payload={"version": 2}, fetched_at=datetime.now(timezone.utc)))
    session.commit()
    answers["maps"]["restaurants in Goa, India"] = {"local_results": [maps_row("Chai Pani")]}
    answers["maps"]["Patto Plaza"] = {"place_results": maps_row("Patto Plaza", 15.4965, 73.8340)}
    view = {"centre": CENTRE, "restaurants": [{"name": "OSM place", "image": None}],
            "attractions": [{"name": "Patto Plaza", "latitude": 15.49634, "longitude": 73.83382}],
            "day_trips": [], "famous_stays": []}
    first = photos.apply(session, "GOI", "Goa, India", view)
    assert [r["name"] for r in first["restaurants"]] == ["Chai Pani"]
    assert first["attractions"][0]["image_label"] == "Photo: Google Maps"
    searched = len(calls["maps"])
    travel_data._cache.clear()
    second = photos.apply(session, "GOI", "Goa, India", view)
    assert second["restaurants"] == first["restaurants"] and second["attractions"] == first["attractions"]
    assert len(calls["maps"]) == searched  # nothing searched again
    assert session.get(CityPlaces, "GOI").payload["extras"]["photos"]


def test_same_name_ignores_common_words():
    assert photos.same_name("Miramar beach", "Sunset @miramar Goa")
    assert not photos.same_name("Panjim city view point", "Maruti Temple, Altinho")
    assert not photos.same_name("Hotel Plaza", "Grand Hotel")  # only common words in common
