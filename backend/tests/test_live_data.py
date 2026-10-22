from datetime import date

import pytest

from app import config, live_data
from app.pipeline import graph
from app.pipeline.graph import pipeline

# Trimmed from real google_flights / google_hotels responses returned by SerpApi's MCP server.
NONSTOP = {
    "flights": [
        {
            "departure_airport": {"id": "BLR", "time": "2026-11-12 05:30"},
            "arrival_airport": {"id": "DEL", "time": "2026-11-12 08:30"},
            "airline": "Air India Express",
            "travel_class": "Economy",
            "flight_number": "IX 1040",
        }
    ],
    "price": 9826,
}
ONE_STOP = {
    "flights": [
        {
            "departure_airport": {"id": "BLR", "time": "2026-11-12 06:00"},
            "arrival_airport": {"id": "HYD", "time": "2026-11-12 07:20"},
            "airline": "IndiGo",
            "travel_class": "Economy",
            "flight_number": "6E 512",
        },
        {
            "departure_airport": {"id": "HYD", "time": "2026-11-12 09:00"},
            "arrival_airport": {"id": "DEL", "time": "2026-11-12 11:15"},
            "airline": "IndiGo",
            "travel_class": "Economy",
            "flight_number": "6E 2031",
        },
    ],
    "price": 8450,
}
HOTEL = {
    "name": "Hotel Pink City",
    "property_token": "ChoIz",
    "gps_coordinates": {"latitude": 28.6448, "longitude": 77.2167},
    "rate_per_night": {"lowest": "₹522", "extracted_lowest": 522},
    "overall_rating": 4.3,
    "amenities": ["Free Wi-Fi", "Breakfast ($)", "Pool", "Airport shuttle"],
}


@pytest.fixture(autouse=True)
def fresh_cache():
    live_data._cache.clear()
    yield
    live_data._cache.clear()


# ---- converting SerpApi results ---------------------------------------------------


def test_flights_match_the_mock_flight_shape():
    nonstop, one_stop = live_data.to_flights([NONSTOP, ONE_STOP], "BLR", "DEL")
    assert nonstop == {
        "id": "FL-IX1040",
        "origin": "BLR",
        "destination": "DEL",
        "departure_time": "2026-11-12T05:30:00",
        "arrival_time": "2026-11-12T08:30:00",
        "airline": "Air India Express",
        "price": 9826,
        "cabin_class": "economy",
        "stops": 0,
    }
    assert one_stop["id"] == "FL-6E512+6E2031"
    assert one_stop["stops"] == 1
    assert one_stop["arrival_time"] == "2026-11-12T11:15:00"


def test_flights_keep_the_cheapest_fare_and_skip_unpriced_ones():
    pricier = {**NONSTOP, "price": 12000}
    unpriced = {**ONE_STOP, "price": None}
    flights = live_data.to_flights([pricier, NONSTOP, unpriced], "BLR", "DEL")
    assert [(f["id"], f["price"]) for f in flights] == [("FL-IX1040", 9826)]


def test_hotels_match_the_mock_hotel_shape():
    (hotel,) = live_data.to_hotels([HOTEL], "DEL")
    assert hotel["id"].startswith("HT-") and len(hotel["id"]) == 11
    assert hotel["city"] == "DEL"
    assert hotel["name"] == "Hotel Pink City"
    assert hotel["price_per_night"] == 522
    assert hotel["rating"] == 4.3
    # "Breakfast ($)" is paid, so it isn't breakfast_included.
    assert hotel["amenities"] == ["wifi", "pool", "airport_shuttle"]
    assert 1 < hotel["distance_to_center_km"] < 2


def test_hotels_without_a_price_or_rating_are_skipped():
    no_price = {**HOTEL, "rate_per_night": {}}
    no_rating = {k: v for k, v in HOTEL.items() if k != "overall_rating"}
    assert live_data.to_hotels([no_price, no_rating], "DEL") == []


def test_hotel_distance_is_none_for_an_unknown_city():
    (hotel,) = live_data.to_hotels([HOTEL], "XYZ")
    assert hotel["distance_to_center_km"] is None


# ---- calling the MCP tool ---------------------------------------------------------


def test_search_needs_an_api_key(monkeypatch):
    monkeypatch.setattr(config, "SERPAPI_API_KEY", "")
    with pytest.raises(live_data.LiveSearchError, match="SERPAPI_API_KEY"):
        live_data.search({"engine": "google_flights"})


def test_search_caches_repeated_queries(monkeypatch):
    calls = []

    async def fake_tool(params):
        calls.append(params)
        return {"best_flights": [NONSTOP]}

    monkeypatch.setattr(config, "SERPAPI_API_KEY", "test-key")
    monkeypatch.setattr(live_data, "_call_search_tool", fake_tool)
    first = live_data.search({"engine": "google_flights", "departure_id": "BLR"})
    second = live_data.search({"departure_id": "BLR", "engine": "google_flights"})
    assert first == second
    assert len(calls) == 1


def test_search_reports_the_underlying_error(monkeypatch):
    async def failing_tool(params):
        raise ExceptionGroup("unhandled errors in a TaskGroup", [ConnectionError("connection refused")])

    monkeypatch.setattr(config, "SERPAPI_API_KEY", "test-key")
    monkeypatch.setattr(live_data, "_call_search_tool", failing_tool)
    with pytest.raises(live_data.LiveSearchError, match="connection refused"):
        live_data.search({"engine": "google_flights"})


# ---- search_node in live mode -----------------------------------------------------

REQUEST = {
    "origin": "BLR",
    "destination": "DEL",
    "start_date": date(2026, 11, 12),
    "end_date": date(2026, 11, 14),
    "budget": 20000.0,
    "preferences": {"max_stops": 0},
}


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setattr(config, "DATA_SOURCE", "live")
    searched = {"hotels": 0}

    def flights(origin, destination, day, cabin_class):
        return live_data.to_flights([NONSTOP, ONE_STOP], origin, destination)

    def hotels(destination, check_in, check_out):
        searched["hotels"] += 1
        return live_data.to_hotels([HOTEL], destination)

    monkeypatch.setattr(live_data, "flights_for_trip", flights)
    monkeypatch.setattr(live_data, "hotels_for_trip", hotels)
    return searched


def test_live_mode_builds_an_itinerary_from_live_options(live):
    result = pipeline.invoke({"request": REQUEST})
    itinerary = result["itinerary"]
    # The one-stop flight is cheaper but breaks max_stops=0, so the nonstop one wins.
    assert itinerary["flight"]["id"] == "FL-IX1040"
    assert itinerary["hotel"]["name"] == "Hotel Pink City"
    assert itinerary["total_cost"] == 9826 + 522 * 2
    assert any(e["alternative"].startswith("FL-6E512") and not e["won"] for e in itinerary["tradeoff_ledger"])


def test_live_mode_skips_the_hotel_search_for_a_same_day_trip(live):
    result = pipeline.invoke({"request": {**REQUEST, "end_date": REQUEST["start_date"]}})
    assert result["itinerary"]["hotel"] is None
    assert live["hotels"] == 0


def test_live_search_failure_fails_the_run_with_the_reason(monkeypatch):
    monkeypatch.setattr(config, "DATA_SOURCE", "live")

    def quota_exceeded(*args):
        raise live_data.LiveSearchError("Your account has run out of searches")

    monkeypatch.setattr(live_data, "flights_for_trip", quota_exceeded)
    result = pipeline.invoke({"request": REQUEST})
    assert "itinerary" not in result
    assert result["failure_reason"].startswith("Live search failed: Your account has run out of searches")


def test_mock_mode_never_calls_the_live_search(monkeypatch):
    def must_not_run(*args):
        raise AssertionError("live search called in mock mode")

    monkeypatch.setattr(live_data, "flights_for_trip", must_not_run)
    monkeypatch.setattr(graph.live_data, "hotels_for_trip", must_not_run)
    result = pipeline.invoke({"request": {**REQUEST, "start_date": date(2026, 11, 1), "end_date": date(2026, 11, 3)}})
    assert "itinerary" in result
