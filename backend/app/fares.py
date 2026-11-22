"""Typical fare ranges for Indian trains and buses that publish no fare.

Google Maps transit (app/ground.py) gives a fare for few trains and buses, so a budget couldn't
compare them with flights. For journeys inside India this gives a range from the distance
instead, always labelled an estimate and kept apart from real fares: a journey's `fare` stays
None, nothing estimated is ever called the cheapest, and the range is only used to say whether
an option is likely to fit a budget.

The rates are per kilometre of track or road, calibrated on published fares (Indian Railways
fare table after the July 2025 revision; state transport and private operator fares):

- Train, under SHORT_TRAIN_KM: second sitting (about ₹160 for Delhi-Jaipur) up to AC chair car
  on a Shatabdi or Vande Bharat (about ₹950).
- Train, longer: sleeper (about ₹1,100 for Bengaluru-Jaipur) up to AC 2-tier.
- Bus: a state transport ordinary bus up to a private AC sleeper or Volvo.

Track and road distances are the straight-line distance times a detour factor.
"""
from app.routing import haversine_m
from app.travel_data import AIRPORTS

RAIL_DETOUR = 1.25
ROAD_DETOUR = 1.3
SHORT_TRAIN_KM = 500
# (per km, fixed part) for the low and high end of each range.
TRAIN_SHORT = ((0.45, 30), (3.0, 60))  # second sitting .. AC chair car
TRAIN_LONG = ((0.55, 40), (2.3, 100))  # sleeper .. AC 2-tier
BUS = ((1.3, 0), (3.2, 0))  # state transport ordinary .. private AC sleeper
CLASSES = {
    "train_short": "second sitting to AC chair car",
    "train_long": "sleeper to AC 2-tier",
    "bus": "state transport bus to private AC sleeper",
}


def _round(amount: float) -> float:
    return float(max(10, round(amount / 10) * 10))


def estimate(mode: str, frm: str, to: str) -> dict | None:
    """A per-person fare range for a train or bus between two airport cities in India, or None."""
    a, b = AIRPORTS.get(frm), AIRPORTS.get(to)
    if mode not in ("train", "bus") or not a or not b or a["country"] != "IN" or b["country"] != "IN":
        return None
    straight_km = haversine_m(a["latitude"], a["longitude"], b["latitude"], b["longitude"]) / 1000
    if mode == "train":
        km = straight_km * RAIL_DETOUR
        kind = "train_short" if km < SHORT_TRAIN_KM else "train_long"
        (low_rate, low_fixed), (high_rate, high_fixed) = TRAIN_SHORT if kind == "train_short" else TRAIN_LONG
    else:
        km = straight_km * ROAD_DETOUR
        kind = "bus"
        (low_rate, low_fixed), (high_rate, high_fixed) = BUS
    return {
        "low": _round(low_rate * km + low_fixed),
        "high": _round(high_rate * km + high_fixed),
        "currency": "INR",
        "distance_km": round(km),
        "label": f"Estimate from about {round(km):,} km ({CLASSES[kind]})",
    }


def journey_range(legs: list[dict], travellers: int) -> dict | None:
    """The range for a whole journey when at least one leg is estimated and every other leg has a
    real fare in rupees; None otherwise. Multiplied by the number of travellers."""
    if not any(leg.get("fare") is None for leg in legs):
        return None
    low = high = 0.0
    for leg in legs:
        if leg.get("fare") is not None and leg.get("currency") in (None, "INR"):
            low += leg["fare"]
            high += leg["fare"]
        elif leg.get("fare") is None and leg.get("fare_estimate"):
            low += leg["fare_estimate"]["low"]
            high += leg["fare_estimate"]["high"]
        else:
            return None
    return {
        "low": low * travellers,
        "high": high * travellers,
        "currency": "INR",
        "label": "Estimate: trains and buses here publish no fare, so the range comes from the distance",
    }
