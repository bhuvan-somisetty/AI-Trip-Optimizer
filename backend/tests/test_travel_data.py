"""Provider parsing and error handling, against canned HTTP responses (never the real APIs)."""
import copy
from datetime import date

import httpx
import pytest

from app import config, travel_data
# Imported before conftest's offline_search patches the module, so these are the real functions.
from app.travel_data import HotelsUnavailable, TravelDataError, search_flights, search_hotels

DAY = date(2026, 11, 1)

FLIGHTS_BODY = {
    "success": True,
    "currency": "inr",
    "data": [
        {
            "origin": "BLR", "destination": "DEL", "origin_airport": "BLR", "destination_airport": "DEL",
            "price": 5412, "airline": "6E", "flight_number": "2134",
            "departure_at": "2026-11-01T06:10:00+05:30", "transfers": 0, "duration_to": 165,
            "link": "/search/BLR0111DEL1?t=6E",
        },
        {
            "origin": "BLR", "destination": "DEL", "origin_airport": "BLR", "destination_airport": "DEL",
            "price": 4890, "airline": "AI", "flight_number": 640,
            "departure_at": "2026-11-01T21:00:00+05:30", "transfers": 1, "duration_to": 340,
        },
        # A fare 2 days later is kept as a nearby-day alternative.
        {
            "origin": "BLR", "destination": "DEL", "price": 3950, "airline": "QP", "flight_number": "1301",
            "departure_at": "2026-11-03T05:00:00+05:30", "transfers": 0, "duration_to": 175,
        },
        # Missing price, and a fare more than FLEX_DAYS away: both skipped.
        {"airline": "UK", "flight_number": "1", "departure_at": "2026-11-01T09:00:00+05:30", "transfers": 0},
        {"price": 3000, "airline": "QP", "departure_at": "2026-11-05T09:00:00+05:30", "transfers": 0},
    ],
}
AIRLINES_BODY = [{"code": "6E", "name": "IndiGo"}, {"code": "AI", "name": "Air India"}]

HOTELS_BODY = {
    "properties": [
        {
            "type": "hotel", "name": "The Lalit New Delhi", "property_token": "tok-lalit",
            "link": "https://www.thelalit.com/the-lalit-delhi",
            "rate_per_night": {"extracted_lowest": 8250}, "total_rate": {"extracted_lowest": 16500},
            "overall_rating": 4.4, "reviews": 9120, "extracted_hotel_class": 5,
            "amenities": ["Free Wi-Fi", "Pool"],
        },
        # Vacation rentals and properties without a total price are skipped.
        {"type": "vacation rental", "name": "Flat in Saket", "property_token": "tok-flat",
         "total_rate": {"extracted_lowest": 6000}},
        {"type": "hotel", "name": "No Price Hotel", "property_token": "tok-noprice"},
        {"type": "hotel", "name": "Unrated Inn", "property_token": "tok-unrated",
         "total_rate": {"extracted_lowest": 9000}},
    ],
}


class FakeResponse:
    def __init__(self, body, status_code=200):
        self.body, self.status_code, self.text = body, status_code, str(body)

    def json(self):
        return self.body


@pytest.fixture
def api(monkeypatch):
    """Answers each URL with a canned body; tests can override `api.responses`."""
    class Api:
        calls = []
        responses = {
            travel_data.TRAVELPAYOUTS_URL: FakeResponse(FLIGHTS_BODY),
            travel_data.AIRLINES_URL: FakeResponse(AIRLINES_BODY),
            travel_data.SERPAPI_URL: FakeResponse(HOTELS_BODY),
        }

    def fake_request(method, url, timeout, **kwargs):
        Api.calls.append((method, url, kwargs))
        response = Api.responses[url]
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(config, "TRAVELPAYOUTS_TOKEN", "tp-token")
    monkeypatch.setattr(config, "SERPAPI_API_KEY", "serp-key")
    # These tests cover Travelpayouts; the Google Flights tests below switch this back on.
    monkeypatch.setattr(config, "FLIGHT_SOURCE", "travelpayouts")
    monkeypatch.setattr(travel_data.httpx, "request", fake_request)
    monkeypatch.setattr(travel_data, "_cache", {})
    return Api


# ---- flights --------------------------------------------------------------

def test_flights_are_parsed_from_real_fields(api):
    flights = search_flights("BLR", "DEL", DAY)
    assert [f["id"] for f in flights] == ["FL-6E2134-0610", "FL-AI640-2100", "FL-QP1301-0500"]
    indigo, air_india, _ = flights
    assert indigo["airline"] == "IndiGo" and indigo["flight_number"] == "6E2134"
    assert indigo["departure_time"] == "2026-11-01T06:10:00+05:30"
    assert indigo["arrival_time"] == "2026-11-01T08:55:00+05:30"
    assert indigo["price"] == 5412 and indigo["currency"] == "INR" and indigo["stops"] == 0
    assert indigo["price_status"] == "cached"
    assert indigo["link"] == "https://www.aviasales.com/search/BLR0111DEL1?t=6E"
    assert air_india["stops"] == 1 and air_india["link"] is None
    method, url, kwargs = api.calls[0]
    assert kwargs["headers"] == {"X-Access-Token": "tp-token"}
    assert kwargs["params"]["currency"] == "inr"


def test_flight_search_fetches_each_month_the_window_touches(api):
    # 1 Nov +/- 3 days runs back into October, so both months are fetched (and a fare
    # returned by both is listed once).
    flights = search_flights("BLR", "DEL", DAY)
    months = [kwargs["params"]["departure_at"] for _, url, kwargs in api.calls if url == travel_data.TRAVELPAYOUTS_URL]
    assert months == ["2026-10", "2026-11"]
    assert len({f["id"] for f in flights}) == len(flights)


def test_mid_month_flight_search_is_one_call(api):
    search_flights("BLR", "DEL", date(2026, 11, 15))
    months = [kwargs["params"]["departure_at"] for _, url, kwargs in api.calls if url == travel_data.TRAVELPAYOUTS_URL]
    assert months == ["2026-11"]


def test_flight_without_duration_has_no_arrival_time(api):
    api.responses[travel_data.TRAVELPAYOUTS_URL] = FakeResponse(
        {"success": True, "data": [{"price": 5000, "airline": "6E", "flight_number": "1",
                                     "departure_at": "2026-11-01T06:10:00+05:30", "transfers": 0}]}
    )
    (flight,) = search_flights("BLR", "DEL", DAY)
    assert flight["arrival_time"] is None and flight["duration_minutes"] is None


def test_airline_lookup_failure_falls_back_to_code(api):
    api.responses[travel_data.AIRLINES_URL] = FakeResponse({}, status_code=500)
    assert search_flights("BLR", "DEL", DAY)[0]["airline"] == "6E"


def test_empty_flight_search_returns_no_options(api):
    api.responses[travel_data.TRAVELPAYOUTS_URL] = FakeResponse({"success": True, "data": []})
    assert search_flights("BLR", "DEL", DAY) == []


def test_repeat_flight_search_is_served_from_cache(api):
    search_flights("BLR", "DEL", DAY)
    search_flights("BLR", "DEL", DAY)
    assert [url for _, url, _ in api.calls].count(travel_data.TRAVELPAYOUTS_URL) == 2  # Oct + Nov, once each


def test_missing_flight_token_is_a_clear_error(api, monkeypatch):
    monkeypatch.setattr(config, "TRAVELPAYOUTS_TOKEN", "")
    with pytest.raises(TravelDataError, match="TRAVELPAYOUTS_TOKEN"):
        search_flights("BLR", "DEL", DAY)


@pytest.mark.parametrize(
    "response, message",
    [
        (FakeResponse({}, status_code=429), "rate limit"),
        (FakeResponse({}, status_code=401), "rejected the server's API key"),
        (FakeResponse({}, status_code=502), "HTTP 502"),
        (FakeResponse({"success": False, "error": "bad origin"}), "bad origin"),
        (httpx.ReadTimeout("slow"), "took too long"),
        (httpx.ConnectError("down"), "couldn't be reached"),
    ],
)
def test_flight_provider_failures_become_readable_errors(api, response, message):
    api.responses[travel_data.TRAVELPAYOUTS_URL] = response
    with pytest.raises(TravelDataError, match=message):
        search_flights("BLR", "DEL", DAY)


# ---- hotels ---------------------------------------------------------------

def test_hotels_are_parsed_from_google_hotels(api):
    hotels = search_hotels("DEL", DAY, date(2026, 11, 3))
    assert [h["name"] for h in hotels] == ["The Lalit New Delhi", "Unrated Inn"]
    lalit, unrated = hotels
    assert lalit["id"].startswith("HT-") and len(lalit["id"]) == 11
    assert lalit["id"] != unrated["id"]
    assert lalit["stay_total"] == 16500 and lalit["price_per_night"] == 8250.0
    assert lalit["rating"] == 4.4 and lalit["stars"] == 5 and lalit["amenities"] == ["Free Wi-Fi", "Pool"]
    assert lalit["price_status"] == "live" and lalit["link"] == "https://www.thelalit.com/the-lalit-delhi"
    assert unrated["rating"] is None and unrated["price_per_night"] == 4500.0
    method, url, kwargs = api.calls[0]
    assert method == "GET" and kwargs["params"]["api_key"] == "serp-key"
    assert kwargs["params"]["engine"] == "google_hotels" and kwargs["params"]["q"] == "hotels in New Delhi"
    assert kwargs["params"]["check_in_date"] == "2026-11-01" and kwargs["params"]["currency"] == "INR"


def test_hotel_id_is_stable_across_searches(api):
    first = search_hotels("DEL", DAY, date(2026, 11, 3))
    api.calls.clear()
    travel_data._cache.clear()
    assert [h["id"] for h in search_hotels("DEL", DAY, date(2026, 11, 3))] == [h["id"] for h in first]


def test_repeat_hotel_search_is_served_from_cache(api):
    search_hotels("DEL", DAY, date(2026, 11, 3))
    search_hotels("DEL", DAY, date(2026, 11, 3))
    assert [url for _, url, _ in api.calls].count(travel_data.SERPAPI_URL) == 1


def test_hotels_unavailable_without_a_key(api, monkeypatch):
    monkeypatch.setattr(config, "SERPAPI_API_KEY", "")
    with pytest.raises(HotelsUnavailable, match="covers the flights only"):
        search_hotels("DEL", DAY, date(2026, 11, 3))
    assert api.calls == []


def test_no_hotels_found_is_an_empty_list(api):
    api.responses[travel_data.SERPAPI_URL] = FakeResponse(
        {"error": "Google Hotels hasn't returned any results for this query."}
    )
    assert search_hotels("DEL", DAY, date(2026, 11, 3)) == []


@pytest.mark.parametrize(
    "response, message",
    [
        (FakeResponse({"error": "Your account has run out of searches."}), "run out of searches"),
        (FakeResponse({}, status_code=401), "rejected the server's API key"),
        (FakeResponse({}, status_code=429), "rate limit"),
        (httpx.ReadTimeout("slow"), "took too long"),
    ],
)
def test_hotel_provider_failures_become_readable_errors(api, response, message):
    api.responses[travel_data.SERPAPI_URL] = response
    with pytest.raises(TravelDataError, match=message):
        search_hotels("DEL", DAY, date(2026, 11, 3))


def test_hotel_search_for_unknown_city_is_an_error(api):
    with pytest.raises(TravelDataError, match="XYZ"):
        search_hotels("XYZ", DAY, date(2026, 11, 3))


# ---- through the pipeline -------------------------------------------------

REQUEST = {
    "origin": "BLR",
    "destination": "DEL",
    "start_date": DAY,
    "end_date": date(2026, 11, 3),
    "budget": 20000.0,
    "preferences": {},
}


def test_flight_search_error_becomes_the_failure_reason(monkeypatch):
    from app.pipeline.graph import pipeline

    def broken(*args):
        raise TravelDataError("Travelpayouts rate limit reached, please wait a minute and try again")

    monkeypatch.setattr(travel_data, "search_flights", broken)
    result = pipeline.invoke({"request": REQUEST})
    assert result["failure_reason"] == "Travelpayouts rate limit reached, please wait a minute and try again"


def test_unavailable_hotels_still_give_a_flight_only_itinerary(monkeypatch):
    import app.pipeline.graph as graph

    def unavailable(*args):
        raise HotelsUnavailable("Live hotel prices are unavailable (no SERPAPI_API_KEY is set), so this total covers the flights only")

    monkeypatch.setattr(travel_data, "search_hotels", unavailable)
    monkeypatch.setattr(graph, "get_llm", lambda: None)
    result = graph.pipeline.invoke({"request": REQUEST})
    itinerary, check = result["itinerary"], result["check"]
    assert itinerary["hotel"] is None
    assert itinerary["total_cost"] == check["flight"]["price"]  # REQUEST's end date has no return fare
    assert "Live hotel prices are unavailable (no SERPAPI_API_KEY is set), so this total covers the flights only" in check["flags"]
    assert all(e["alternative"].startswith("FL-") for e in itinerary["tradeoff_ledger"])


def test_hotels_keep_location_and_up_to_five_photos(api):
    body = copy.deepcopy(HOTELS_BODY)
    lalit_row = body["properties"][0]
    lalit_row["gps_coordinates"] = {"latitude": 28.6328, "longitude": 77.2197}
    lalit_row["images"] = [{"thumbnail": f"https://img.example/{i}-s.jpg", "original_image": f"https://img.example/{i}.jpg"}
                           for i in range(7)] + [{}]
    api.responses[travel_data.SERPAPI_URL] = FakeResponse(body)
    lalit, unrated = search_hotels("DEL", DAY, date(2026, 11, 3))
    assert (lalit["latitude"], lalit["longitude"]) == (28.6328, 77.2197)
    assert len(lalit["images"]) == 5
    assert lalit["images"][0] == {"thumbnail": "https://img.example/0-s.jpg", "original": "https://img.example/0.jpg"}
    # Google sent neither for this one: left empty, never guessed.
    assert unrated["latitude"] is None and unrated["longitude"] is None and unrated["images"] == []


# ---- Google Flights (via SerpApi) -------------------------------------------

GOOGLE_FLIGHTS_BODY = {
    "search_metadata": {"google_flights_url": "https://www.google.com/travel/flights?x"},
    "best_flights": [
        {
            "flights": [
                {
                    "departure_airport": {"id": "BLR", "time": "2026-12-04 06:10"},
                    "arrival_airport": {"id": "BOM", "time": "2026-12-04 07:55"},
                    "airline": "IndiGo",
                    "flight_number": "6E 5321",
                    "travel_class": "Economy",
                }
            ],
            "total_duration": 105,
            "price": 5120,
        }
    ],
    "other_flights": [
        {
            "flights": [
                {
                    "departure_airport": {"id": "BLR", "time": "2026-12-04 21:00"},
                    "arrival_airport": {"id": "HYD", "time": "2026-12-04 22:10"},
                    "airline": "Air India",
                    "flight_number": "AI 512",
                    "travel_class": "Economy",
                },
                {
                    "departure_airport": {"id": "HYD", "time": "2026-12-04 23:30"},
                    "arrival_airport": {"id": "BOM", "time": "2026-12-05 00:55"},
                    "airline": "Air India",
                    "flight_number": "AI 619",
                    "travel_class": "Economy",
                },
            ],
            "total_duration": 235,
            "price": 4300,
        },
        {"flights": [], "price": 1000},  # no legs: skipped
        {  # no price: skipped
            "flights": [
                {
                    "departure_airport": {"id": "BLR", "time": "2026-12-04 10:00"},
                    "arrival_airport": {"id": "BOM", "time": "2026-12-04 11:45"},
                    "flight_number": "QP 1101",
                }
            ],
        },
    ],
}


@pytest.fixture
def google(api, monkeypatch):
    monkeypatch.setattr(config, "FLIGHT_SOURCE", "google")
    api.responses[travel_data.SERPAPI_URL] = FakeResponse(GOOGLE_FLIGHTS_BODY)
    return api


def test_google_flights_are_parsed_from_real_fields(google):
    flights = search_flights("BLR", "BOM", date(2026, 12, 4))
    assert [f["id"] for f in flights] == ["FL-6E5321-0610", "FL-AI512-2100"]
    direct, one_stop = flights
    assert direct["airline"] == "IndiGo" and direct["airline_code"] == "6E"
    assert direct["price"] == 5120 and direct["stops"] == 0 and direct["cabin_class"] == "economy"
    assert direct["departure_time"] == "2026-12-04T06:10:00"
    assert direct["arrival_time"] == "2026-12-04T07:55:00"
    assert direct["price_status"] == "live" and direct["source"] == "Google Flights via SerpApi"
    assert one_stop["stops"] == 1 and one_stop["destination"] == "BOM"
    assert one_stop["arrival_time"] == "2026-12-05T00:55:00"
    # Google was enough, so Travelpayouts was never asked.
    assert all(url == travel_data.SERPAPI_URL for _, url, _ in google.calls)


def test_google_flights_request_asks_for_one_way_inr_in_the_trip_cabin(google):
    search_flights("BLR", "BOM", date(2026, 12, 4), "business")
    params = google.calls[0][2]["params"]
    assert params["engine"] == "google_flights" and params["type"] == 2
    assert params["outbound_date"] == "2026-12-04" and params["currency"] == "INR"
    assert params["travel_class"] == 3


def test_repeat_google_flight_search_is_served_from_cache(google):
    search_flights("BLR", "BOM", date(2026, 12, 4))
    search_flights("BLR", "BOM", date(2026, 12, 4))
    assert [url for _, url, _ in google.calls].count(travel_data.SERPAPI_URL) == 1


def test_no_google_flights_falls_back_to_travelpayouts(google):
    google.responses[travel_data.SERPAPI_URL] = FakeResponse(
        {"error": "Google Flights hasn't returned any results for this query."}
    )
    flights = search_flights("BLR", "DEL", date(2026, 10, 30))
    assert flights and all(f["source"].startswith("Travelpayouts") for f in flights)


def test_google_failure_falls_back_to_travelpayouts(google):
    google.responses[travel_data.SERPAPI_URL] = FakeResponse({}, status_code=500)
    flights = search_flights("BLR", "DEL", date(2026, 10, 30))
    assert flights and all(f["source"].startswith("Travelpayouts") for f in flights)


def test_google_failure_without_fallback_is_a_readable_error(google, monkeypatch):
    monkeypatch.setattr(config, "TRAVELPAYOUTS_TOKEN", "")
    google.responses[travel_data.SERPAPI_URL] = FakeResponse({}, status_code=500)
    with pytest.raises(TravelDataError, match="SerpApi search failed"):
        search_flights("BLR", "BOM", date(2026, 12, 4))


def test_no_google_flights_and_no_fallback_is_an_empty_list(google, monkeypatch):
    monkeypatch.setattr(config, "TRAVELPAYOUTS_TOKEN", "")
    google.responses[travel_data.SERPAPI_URL] = FakeResponse(
        {"error": "Google Flights hasn't returned any results for this query."}
    )
    assert search_flights("BLR", "BOM", date(2026, 12, 4)) == []
