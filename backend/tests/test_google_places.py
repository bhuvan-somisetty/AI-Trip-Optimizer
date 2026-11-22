"""Optional Google Places details for restaurants (app/google_places.py).

Google is never called: answers are canned in the shapes of Places API (New) Text Search and
the photo media endpoint with skipHttpRedirect.
"""
import pytest

from app import config, google_places, travel_data
from app.travel_data import TravelDataError

KARIMS = {"name": "Karim's", "latitude": 28.6490, "longitude": 77.2330, "image": None, "image_label": None}
FOUND = {"places": [{
    "id": "ChIJkarims",
    "displayName": {"text": "Karim's Jama Masjid"},
    "formattedAddress": "16, Gali Kababian, Jama Masjid, Delhi 110006",
    "location": {"latitude": 28.6491, "longitude": 77.2331},
    "rating": 4.1,
    "userRatingCount": 52310,
    "regularOpeningHours": {"weekdayDescriptions": ["Monday: 9:00 AM - 12:00 AM"]},
    "photos": [{"name": "places/ChIJkarims/photos/P1", "authorAttributions": [{"displayName": "A. Diner", "uri": "https://maps.google.com/contrib/1"}]}],
    "googleMapsUri": "https://maps.google.com/?cid=1",
    "primaryTypeDisplayName": {"text": "Mughlai restaurant"},
}]}


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(config, "GOOGLE_PLACES_API_KEY", "g-key")
    monkeypatch.setattr(config, "GOOGLE_PLACES_MAX", 6)
    monkeypatch.setattr(travel_data, "_cache", {})
    calls = []

    def fake(provider, method, url, **kwargs):
        calls.append((method, url, kwargs))
        if url == google_places.SEARCH_URL:
            return FOUND
        return {"name": "places/ChIJkarims/photos/P1/media", "photoUri": "https://lh3.googleusercontent.com/p/abc=w480"}
    monkeypatch.setattr(google_places, "_request", fake)
    return calls


def test_a_matching_restaurant_gets_googles_photo_rating_and_hours(google):
    (out,), notice = google_places.enrich([KARIMS], "New Delhi")
    assert notice is None
    assert out["image"] == "https://lh3.googleusercontent.com/p/abc=w480" and out["image_label"] == "Photo: Google"
    assert out["photo_attribution"] == {"author": "A. Diner", "author_url": "https://maps.google.com/contrib/1"}
    assert out["google"]["rating"] == 4.1 and out["google"]["rating_count"] == 52310
    assert out["google"]["opening_hours"] == ["Monday: 9:00 AM - 12:00 AM"] and out["google"]["data_label"] == "Live"
    search, media = google
    assert search[2]["headers"]["X-Goog-FieldMask"] == google_places.FIELDS
    assert search[2]["json"]["textQuery"] == "Karim's, New Delhi"
    assert media[2]["params"]["skipHttpRedirect"] == "true"
    assert "g-key" not in str(out)  # the key never reaches the browser


def test_a_different_place_is_not_used(google):
    far = {**KARIMS, "name": "Karim's", "latitude": 28.70}  # Google's answer is ~5 km away
    other = {**KARIMS, "name": "Haldiram's"}  # near, but no shared name word
    out, _ = google_places.enrich([far, other], "New Delhi")
    assert out == [far, other]


def test_without_a_key_nothing_is_asked(monkeypatch):
    monkeypatch.setattr(config, "GOOGLE_PLACES_API_KEY", "")
    monkeypatch.setattr(google_places, "_request", lambda *a, **k: pytest.fail("Google was called"))
    assert google_places.enrich([KARIMS], "New Delhi") == ([KARIMS], None)


def test_only_the_first_few_restaurants_are_looked_up(google, monkeypatch):
    monkeypatch.setattr(config, "GOOGLE_PLACES_MAX", 1)
    second = {**KARIMS, "latitude": 28.6491}
    out, _ = google_places.enrich([KARIMS, second], "New Delhi")
    assert "google" in out[0] and out[1] == second
    assert len(google) == 2  # one search and one photo


def test_a_google_error_keeps_the_map_data_and_says_so(google, monkeypatch):
    def down(*a, **k):
        raise TravelDataError("Google Places rejected the server's API key")
    monkeypatch.setattr(google_places, "_request", down)
    out, notice = google_places.enrich([KARIMS, KARIMS], "New Delhi")
    assert out == [KARIMS, KARIMS] and "rejected" in notice
