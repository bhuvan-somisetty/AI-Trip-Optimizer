"""Provider parsing and error handling, against canned HTTP responses (never the real APIs)."""
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
        # Missing price, and a fare for a different day: both skipped.
        {"airline": "UK", "flight_number": "1", "departure_at": "2026-11-01T09:00:00+05:30", "transfers": 0},
        {"price": 3000, "airline": "QP", "departure_at": "2026-11-02T09:00:00+05:30", "transfers": 0},
    ],
}
AIRLINES_BODY = [{"code": "6E", "name": "IndiGo"}, {"code": "AI", "name": "Air India"}]

HOTELS_BODY = {
    "data": [
        {"hotelId": "lp1", "roomTypes": [{"offerRetailRate": {"amount": 16500.0, "currency": "INR"}},
                                         {"offerRetailRate": {"amount": 18000.0, "currency": "INR"}}]},
        {"hotelId": "lp2", "roomTypes": [{"offerRetailRate": {"amount": 120.0, "currency": "USD"}}]},
        {"hotelId": "lp3", "roomTypes": [{"offerRetailRate": {"amount": 9000.0, "currency": "INR"}}]},
    ],
    "hotels": [
        {"id": "lp1", "name": "The Lalit New Delhi", "rating": 8.7, "stars": 5, "address": "Barakhamba Ave"},
        {"id": "lp2", "name": "Priced in USD"},
        {"id": "lp3", "name": "Unrated Inn"},
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
            travel_data.LITEAPI_RATES_URL: FakeResponse(HOTELS_BODY),
        }

    def fake_request(method, url, timeout, **kwargs):
        Api.calls.append((method, url, kwargs))
        response = Api.responses[url]
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr(config, "TRAVELPAYOUTS_TOKEN", "tp-token")
    monkeypatch.setattr(config, "LITEAPI_API_KEY", "prod_key")
    monkeypatch.setattr(travel_data.httpx, "request", fake_request)
    monkeypatch.setattr(travel_data, "_cache", {})
    return Api


# ---- flights --------------------------------------------------------------

def test_flights_are_parsed_from_real_fields(api):
    flights = search_flights("BLR", "DEL", DAY)
    assert [f["id"] for f in flights] == ["FL-6E2134-0610", "FL-AI640-2100"]
    indigo, air_india = flights
    assert indigo["airline"] == "IndiGo" and indigo["flight_number"] == "6E2134"
    assert indigo["departure_time"] == "2026-11-01T06:10:00+05:30"
    assert indigo["arrival_time"] == "2026-11-01T08:55:00+05:30"
    assert indigo["price"] == 5412 and indigo["currency"] == "INR" and indigo["stops"] == 0
    assert indigo["price_status"] == "cached"
    assert indigo["link"] == "https://www.aviasales.com/search/BLR0111DEL1?t=6E"
    assert air_india["stops"] == 1 and air_india["link"] is None
    method, url, kwargs = api.calls[0]
    assert kwargs["headers"] == {"X-Access-Token": "tp-token"}
    assert kwargs["params"]["departure_at"] == "2026-11-01" and kwargs["params"]["currency"] == "inr"


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
    assert [url for _, url, _ in api.calls].count(travel_data.TRAVELPAYOUTS_URL) == 1


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

def test_hotels_are_parsed_from_live_rates(api):
    hotels = search_hotels("DEL", DAY, date(2026, 11, 3))
    assert [h["name"] for h in hotels] == ["The Lalit New Delhi", "Unrated Inn"]
    lalit, unrated = hotels
    assert lalit["id"] == "HT-lp1" and lalit["stay_total"] == 16500.0
    assert lalit["price_per_night"] == 8250.0 and lalit["rating"] == 4.3 and lalit["review_score"] == 8.7
    assert unrated["rating"] is None
    method, url, kwargs = api.calls[0]
    assert method == "POST" and kwargs["headers"] == {"X-API-Key": "prod_key"}
    assert kwargs["json"]["cityName"] == "New Delhi" and kwargs["json"]["currency"] == "INR"


@pytest.mark.parametrize("key", ["", "sand_abc123"])
def test_hotels_unavailable_without_a_production_key(api, monkeypatch, key):
    monkeypatch.setattr(config, "LITEAPI_API_KEY", key)
    with pytest.raises(HotelsUnavailable, match="covers the flight only"):
        search_hotels("DEL", DAY, date(2026, 11, 3))
    assert api.calls == []


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
        raise HotelsUnavailable("Live hotel prices are unavailable (no LITEAPI_API_KEY is set), so this total covers the flight only")

    monkeypatch.setattr(travel_data, "search_hotels", unavailable)
    monkeypatch.setattr(graph, "get_llm", lambda: None)
    result = graph.pipeline.invoke({"request": REQUEST})
    itinerary, check = result["itinerary"], result["check"]
    assert itinerary["hotel"] is None
    assert itinerary["total_cost"] == check["flight"]["price"]
    assert check["flags"] == ["Live hotel prices are unavailable (no LITEAPI_API_KEY is set), so this total covers the flight only"]
    assert all(e["alternative"].startswith("FL-") for e in itinerary["tradeoff_ledger"])
