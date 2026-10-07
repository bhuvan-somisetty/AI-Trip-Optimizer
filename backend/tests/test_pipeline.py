from datetime import date

import pytest

import app.pipeline.graph as graph
from app.pipeline.graph import check_node, pipeline

REQUEST = {
    "origin": "BLR",
    "destination": "DEL",
    "start_date": date(2026, 11, 1),
    "end_date": date(2026, 11, 3),
    "budget": 20000.0,
    "preferences": {},
}


def test_pipeline_runs_nodes_in_order():
    edges = {(e.source, e.target) for e in pipeline.get_graph().edges}
    assert edges == {
        ("__start__", "search"),
        ("search", "check"),
        ("check", "compose"),
        ("compose", "__end__"),
    }


def test_pipeline_runs_end_to_end_and_keeps_request():
    result = pipeline.invoke({"request": REQUEST})
    assert result["request"] == REQUEST


# ---- check_node -----------------------------------------------------------

FLIGHTS = [
    {"id": "FL-A", "price": 5200, "cabin_class": "economy", "stops": 0},
    {"id": "FL-B", "price": 3900, "cabin_class": "economy", "stops": 1},
    {"id": "FL-C", "price": 14500, "cabin_class": "business", "stops": 0},
]
HOTELS = [
    {"id": "HT-A", "price_per_night": 3800, "rating": 4.2},
    {"id": "HT-B", "price_per_night": 1600, "rating": 3.5},
]


def run_check(preferences=None, budget=20000.0, flights=FLIGHTS, hotels=HOTELS, end=date(2026, 11, 3)):
    request = {**REQUEST, "budget": budget, "end_date": end, "preferences": preferences or {}}
    return check_node({"request": request, "flight_options": flights, "hotel_options": hotels})["check"]


def test_check_picks_cheapest_options_and_totals_them():
    check = run_check()
    assert check["flight"]["id"] == "FL-B"
    assert check["hotel"]["id"] == "HT-B"
    assert check["nights"] == 2
    assert check["total_cost"] == 3900 + 1600 * 2
    assert check["within_budget"] is True
    assert check["flags"] == [] and check["rejected"] == []


def test_check_applies_preferences_and_records_rejections():
    check = run_check({"cabin_class": "economy", "max_stops": 0, "min_hotel_rating": 4.0})
    assert check["flight"]["id"] == "FL-A"
    assert check["hotel"]["id"] == "HT-A"
    rules = {r["option_id"]: r["rule"] for r in check["rejected"]}
    assert rules == {"FL-B": "max_stops", "FL-C": "cabin_class", "HT-B": "min_hotel_rating"}
    assert "FL-B has 1 stop(s), trip allows 0" in [r["detail"] for r in check["rejected"]]


def test_check_flags_over_budget_with_line_items():
    check = run_check(budget=5000.0)
    assert check["within_budget"] is False
    assert check["flags"] == [
        "Total 7,100 is 2,100 over the 5,000 budget (flight FL-B 3,900 + hotel HT-B 2 night(s) 3,200)"
    ]


def test_check_flags_when_no_option_meets_preferences():
    check = run_check({"min_hotel_rating": 5.0})
    assert check["hotel"] is None
    assert "No hotel in DEL meets the trip's preferences" in check["flags"]


def test_check_flags_when_no_flights_exist():
    check = run_check(flights=[])
    assert check["flight"] is None
    assert check["flags"] == ["No flights found from BLR to DEL on 2026-11-01"]


def test_check_same_day_trip_needs_no_hotel():
    check = run_check(end=date(2026, 11, 1), hotels=[])
    assert check["nights"] == 0 and check["hotel"] is None
    assert check["total_cost"] == 3900 and check["flags"] == []


def test_pipeline_check_runs_on_real_mock_data():
    check = pipeline.invoke({"request": REQUEST})["check"]
    assert check["flight"]["origin"] == "BLR" and check["flight"]["destination"] == "DEL"
    assert check["hotel"]["city"] == "DEL"
    assert check["total_cost"] == check["flight"]["price"] + check["hotel"]["price_per_night"] * 2


# ---- compose_node ---------------------------------------------------------

class FakeLLM:
    def __init__(self, text):
        self.text = text

    def invoke(self, prompt):
        self.prompt = prompt
        return type("Reply", (), {"content": self.text})()


@pytest.fixture
def no_llm(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)


def run_pipeline(**changes):
    return pipeline.invoke({"request": {**REQUEST, **changes}})


def test_compose_builds_itinerary_from_check_numbers(no_llm):
    result = run_pipeline()
    itinerary, check = result["itinerary"], result["check"]
    assert itinerary["flight"] == check["flight"]
    assert itinerary["hotel"] == check["hotel"]
    assert itinerary["total_cost"] == check["total_cost"]
    assert f"{check['total_cost']:,.0f}" in itinerary["rationale"]
    assert "failure_reason" not in result


def test_compose_ledger_lists_every_option_with_one_winner_each(no_llm):
    result = run_pipeline(preferences={"max_stops": 0})
    ledger = result["itinerary"]["tradeoff_ledger"]
    assert len(ledger) == len(result["flight_options"]) + len(result["hotel_options"])
    assert sum(e["won"] for e in ledger) == 2
    for entry in ledger:
        if not entry["won"]:
            assert entry["reason"].startswith(("Price:", "Preference "))
    nights = result["check"]["nights"]
    hotel_row = next(e for e in ledger if e["won"] and e["alternative"].startswith("HT-"))
    assert hotel_row["price"] == result["check"]["hotel"]["price_per_night"] * nights


def test_compose_same_day_trip_has_no_hotel(no_llm):
    result = run_pipeline(end_date=REQUEST["start_date"])
    assert result["itinerary"]["hotel"] is None
    assert all(e["alternative"].startswith("FL-") for e in result["itinerary"]["tradeoff_ledger"])


def test_compose_fails_when_no_flight_found(no_llm):
    result = run_pipeline(start_date=date(2030, 1, 1), end_date=date(2030, 1, 2))
    assert "itinerary" not in result
    assert "No flights found" in result["failure_reason"]


def test_compose_uses_llm_rationale_when_numbers_match(monkeypatch):
    fake = FakeLLM("Picked the cheapest flight that meets every preference.")
    monkeypatch.setattr(graph, "get_llm", lambda: fake)
    result = run_pipeline()
    assert result["itinerary"]["rationale"] == fake.text
    assert '"total_cost"' in fake.prompt


def test_compose_fails_when_llm_invents_a_number(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: FakeLLM("The total comes to 123,456."))
    result = run_pipeline()
    assert "itinerary" not in result
    assert result["failure_reason"] == "Rationale used numbers not in the itinerary: 123456"
