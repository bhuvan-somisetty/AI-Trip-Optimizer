"""Typical train and bus fare ranges from distance (app/fares.py)."""
from app.fares import estimate, journey_range


def test_trains_and_buses_in_india_get_a_range():
    train = estimate("train", "DEL", "JAI")
    assert train["currency"] == "INR" and train["label"].startswith("Estimate from about")
    assert 100 <= train["low"] <= 250 and 700 <= train["high"] <= 1200  # second sitting ~150, chair car ~950
    long = estimate("train", "BLR", "JAI")
    assert 900 <= long["low"] <= 1400 and "sleeper to AC 2-tier" in long["label"]
    bus = estimate("bus", "DEL", "JAI")
    assert bus["low"] < bus["high"] and bus["low"] % 10 == 0


def test_no_range_for_flights_or_outside_india():
    assert estimate("flight", "DEL", "JAI") is None
    assert estimate("train", "LHR", "CDG") is None
    assert estimate("train", "DEL", "ZZZ") is None


def test_a_journey_range_adds_real_fares_and_estimates():
    flight = {"fare": 3000, "currency": "INR"}
    train = {"fare": None, "fare_estimate": {"low": 500, "high": 1500}}
    both = journey_range([flight, train], 2)
    assert (both["low"], both["high"], both["currency"]) == (7000, 9000, "INR")
    assert journey_range([flight], 1) is None  # every fare is real: no estimate needed
    assert journey_range([{"fare": None, "fare_estimate": None}], 1) is None  # nothing to go on
    assert journey_range([{"fare": 50, "currency": "EUR"}, train], 1) is None  # euros don't add to rupees
