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


def test_no_hotel_meeting_every_preference_books_the_cheapest_and_says_so():
    # The trip is never failed for its stay: the cheapest real hotel is booked and flagged.
    check = run_check({"min_hotel_rating": 5.0})
    assert check["hotel"] is not None
    assert check["hotel"]["price_per_night"] == min(h["price_per_night"] for h in HOTELS)
    note = next(f for f in check["flags"] if f.startswith("No hotel in New Delhi meets every preference"))
    assert "the cheapest one found is booked" in note and "adjust the stay filters" in note
    assert not any(r["option_id"] == check["hotel"]["id"] for r in check["rejected"])


def test_check_flags_when_no_flights_exist():
    check = run_check(flights=[])
    assert check["flight"] is None
    assert check["flags"] == ["No flights found from BLR to DEL on 2026-11-01"]


NEARBY = [
    {"id": "FL-ON", "price": 6000, "airline": "IndiGo", "cabin_class": "economy", "stops": 0, "departure_time": "2026-11-01T06:00:00+05:30"},
    {"id": "FL-EARLY", "price": 4500, "airline": "IndiGo", "cabin_class": "economy", "stops": 0, "departure_time": "2026-10-30T06:00:00+05:30"},
    {"id": "FL-LATE", "price": 7000, "airline": "IndiGo", "cabin_class": "economy", "stops": 0, "departure_time": "2026-11-03T06:00:00+05:30"},
]


def test_check_books_only_a_flight_on_the_start_date():
    check = run_check(flights=NEARBY)
    assert check["flight"]["id"] == "FL-ON"  # FL-EARLY is cheaper but leaves 2 days early
    details = {r["option_id"]: r["detail"] for r in check["rejected"] if r["rule"] == "travel_date"}
    assert details == {
        "FL-EARLY": "FL-EARLY departs 2026-10-30, 2 day(s) before the trip starts",
        "FL-LATE": "FL-LATE departs 2026-11-03, 2 day(s) after the trip starts",
    }


def test_check_names_nearest_fares_when_start_date_has_none():
    check = run_check(flights=NEARBY[1:])
    assert check["flight"] is None
    assert check["flags"] == [
        "No flights found from BLR to DEL on 2026-11-01; nearest real fares: "
        "FL-EARLY on 2026-10-30 for 4,500, FL-LATE on 2026-11-03 for 7,000"
    ]


def test_ledger_shows_nearby_day_fares_as_date_tradeoffs():
    same_day = {**REQUEST, "end_date": REQUEST["start_date"]}
    state = {"request": same_day, "flight_options": NEARBY, "hotel_options": []}
    state["check"] = check_node(state)["check"]
    rows = {e["alternative"].split()[0]: e for e in graph.build_ledger(state)}
    assert rows["FL-ON"]["won"] is True
    assert rows["FL-EARLY"]["reason"] == (
        "Different day: FL-EARLY departs 2026-10-30, 2 day(s) before the trip starts; 1,500 less than FL-ON"
    )
    assert rows["FL-LATE"]["reason"].endswith("1,000 more than FL-ON")
    assert rows["FL-ON"]["alternative"].endswith("departs 2026-11-01")


def test_check_same_day_trip_needs_no_hotel():
    check = run_check(end=date(2026, 11, 1), hotels=[])
    assert check["nights"] == 0 and check["hotel"] is None
    assert check["total_cost"] == 3900 and check["flags"] == []


def test_pipeline_check_runs_on_searched_options():
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


def test_compose_ledger_rows_say_whether_they_are_a_flight_or_a_stay(no_llm):
    result = run_pipeline()
    ledger = result["itinerary"]["tradeoff_ledger"]
    flights = [e for e in ledger if e["kind"] == "flight"]
    stays = [e for e in ledger if e["kind"] == "stay"]
    assert len(flights) == len(result["flight_options"])
    assert len(stays) == len(result["hotel_options"])
    assert len(flights) + len(stays) == len(ledger)
    assert all(e["alternative"].startswith("FL-") for e in flights)
    assert all(e["alternative"].startswith("HT-") for e in stays)


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


class FailingLLM:
    def invoke(self, prompt):
        raise RuntimeError("503 model overloaded")


def test_compose_uses_template_rationale_when_llm_call_fails(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: FailingLLM())
    result = run_pipeline()
    facts = graph.rationale_facts({**result, "request": REQUEST})
    assert result["itinerary"]["rationale"] == graph.template_rationale(facts)


def test_compose_uses_template_rationale_when_llm_reply_is_empty(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: FakeLLM("   "))
    result = run_pipeline()
    assert result["itinerary"]["rationale"].startswith("Chose flight ")


def test_compose_fails_when_llm_invents_a_number(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: FakeLLM("The total comes to 123,456."))
    result = run_pipeline()
    assert "itinerary" not in result
    assert result["failure_reason"] == "Rationale used numbers not in the itinerary: 123456"


# ---- filter rules: time window, red-eye, airlines, nightly cap, amenities ----------

TIMED_FLIGHTS = [
    {"id": "FL-EARLY", "price": 3000, "cabin_class": "economy", "stops": 0, "airline": "SpiceJet",
     "airline_code": "SG", "departure_time": "2026-11-01T06:15:00"},
    {"id": "FL-NOON", "price": 4000, "cabin_class": "economy", "stops": 0, "airline": "IndiGo",
     "airline_code": "6E", "departure_time": "2026-11-01T13:00:00"},
    {"id": "FL-LATE", "price": 2500, "cabin_class": "economy", "stops": 0, "airline": "Akasa Air",
     "airline_code": "QP", "departure_time": "2026-11-01T23:40:00"},
]
AMENITY_HOTELS = [
    {"id": "HT-CHEAP", "price_per_night": 900, "rating": 4.0, "amenities": ["Free Wi-Fi"]},
    {"id": "HT-MID", "price_per_night": 2500, "rating": 4.1, "amenities": ["Free Wi-Fi", "Free breakfast", "Pool"]},
    {"id": "HT-POSH", "price_per_night": 9000, "rating": 4.8, "amenities": ["Free Wi-Fi", "Spa", "Fitness centre"]},
]


def rules_broken(check, kind):
    return {r["option_id"]: r["rule"] for r in check["rejected"] if r["kind"] == kind}


def test_check_avoids_red_eye_flights():
    check = run_check({"avoid_red_eye": True}, flights=TIMED_FLIGHTS)
    assert check["flight"]["id"] == "FL-EARLY"
    assert rules_broken(check, "flight") == {"FL-LATE": "avoid_red_eye"}


def test_check_keeps_outbound_inside_departure_window():
    check = run_check({"departure_window": "afternoon"}, flights=TIMED_FLIGHTS)
    assert check["flight"]["id"] == "FL-NOON"
    assert rules_broken(check, "flight") == {"FL-EARLY": "departure_window", "FL-LATE": "departure_window"}


def test_night_window_wraps_past_midnight():
    check = run_check({"departure_window": "night"}, flights=TIMED_FLIGHTS)
    assert check["flight"]["id"] == "FL-LATE"


def test_departure_window_does_not_apply_to_the_return_leg():
    request = {**REQUEST, "preferences": {"departure_window": "afternoon"}}
    back = [{**f, "departure_time": "2026-11-03" + f["departure_time"][10:]} for f in TIMED_FLIGHTS]
    check = check_node({"request": request, "flight_options": TIMED_FLIGHTS, "return_options": back,
                        "hotel_options": HOTELS})["check"]
    assert check["return_flight"]["id"] == "FL-LATE"


def test_check_drops_excluded_airlines_by_name_or_code():
    for excluded in (["Akasa Air"], ["qp"]):
        check = run_check({"excluded_airlines": excluded}, flights=TIMED_FLIGHTS)
        assert check["flight"]["id"] == "FL-EARLY"
        assert rules_broken(check, "flight") == {"FL-LATE": "excluded_airlines"}


def test_preferred_airline_breaks_a_price_tie_only():
    tied = [{**f, "price": 3000} for f in TIMED_FLIGHTS[:2]]
    assert run_check({"preferred_airlines": ["IndiGo"]}, flights=tied)["flight"]["id"] == "FL-NOON"
    # Never at a higher price: a preference is a tie-break, not a rule.
    assert run_check({"preferred_airlines": ["IndiGo"]}, flights=TIMED_FLIGHTS)["flight"]["id"] == "FL-LATE"


def test_check_caps_the_nightly_rate():
    check = run_check({"max_nightly_rate": 3000}, hotels=AMENITY_HOTELS)
    assert check["hotel"]["id"] == "HT-CHEAP"
    assert rules_broken(check, "stay") == {"HT-POSH": "max_nightly_rate"}


def test_check_requires_listed_amenities():
    check = run_check({"required_amenities": ["breakfast", "pool"]}, hotels=AMENITY_HOTELS)
    assert check["hotel"]["id"] == "HT-MID"
    assert rules_broken(check, "stay") == {"HT-CHEAP": "required_amenities", "HT-POSH": "required_amenities"}
    gym = run_check({"required_amenities": ["gym"]}, hotels=AMENITY_HOTELS)
    assert gym["hotel"]["id"] == "HT-POSH"


def test_amenity_ids_with_underscores_match():
    hotels = [{"id": "HT-X", "price_per_night": 1000, "rating": 4.0, "amenities": ["airport_shuttle"]}]
    assert run_check({"required_amenities": ["airport_shuttle"]}, hotels=hotels)["hotel"]["id"] == "HT-X"


def test_rules_are_read_from_the_web_apps_filters_object():
    preferences = {"filters": {"avoidRedEye": True, "maxNightlyRate": 3000, "excludedAirlines": ["SpiceJet"]}}
    check = run_check(preferences, flights=TIMED_FLIGHTS, hotels=AMENITY_HOTELS)
    assert check["flight"]["id"] == "FL-NOON"
    assert check["hotel"]["id"] == "HT-CHEAP"
    assert rules_broken(check, "stay") == {"HT-POSH": "max_nightly_rate"}


def test_top_level_preference_wins_over_filters_object():
    preferences = {"avoid_red_eye": False, "filters": {"avoidRedEye": True}}
    assert run_check(preferences, flights=TIMED_FLIGHTS)["flight"]["id"] == "FL-LATE"


def test_ledger_says_same_price_instead_of_zero_more(no_llm):
    tied = [{**f, "price": 3000} for f in TIMED_FLIGHTS[:2]]
    request = {**REQUEST, "end_date": REQUEST["start_date"]}
    state = check_node({"request": request, "flight_options": tied, "hotel_options": []})
    ledger = graph.build_ledger({"request": request, "flight_options": tied, "hotel_options": [], **state})
    losing = [row["reason"] for row in ledger if not row["won"]]
    assert losing and all("same as" in reason and "0 more" not in reason for reason in losing)


# ---- trip priority: cheapest / balanced / comfort / fastest -------------------

PRIORITY_FLIGHTS = [
    # cheap but slow with a stop, mid-price direct, priciest and fastest direct
    {"id": "FL-SLOW", "price": 4000, "cabin_class": "economy", "stops": 1, "airline": "SpiceJet",
     "departure_time": "2026-11-01T06:00:00", "arrival_time": "2026-11-01T11:00:00"},
    {"id": "FL-MID", "price": 4600, "cabin_class": "economy", "stops": 0, "airline": "IndiGo",
     "departure_time": "2026-11-01T09:00:00", "arrival_time": "2026-11-01T11:45:00"},
    {"id": "FL-FAST", "price": 6500, "cabin_class": "economy", "stops": 0, "airline": "Air India",
     "departure_time": "2026-11-01T10:00:00", "arrival_time": "2026-11-01T12:15:00"},
]
PRIORITY_HOTELS = [
    {"id": "HT-BASIC", "name": "Basic", "price_per_night": 1500, "rating": 3.6},
    {"id": "HT-GOOD", "name": "Good", "price_per_night": 2000, "rating": 4.4},
    {"id": "HT-LUXE", "name": "Luxe", "price_per_night": 7000, "rating": 4.9},
]


def run_priority(priority, budget=50000.0, **prefs):
    return run_check({"priority": priority, **prefs}, budget=budget, flights=PRIORITY_FLIGHTS, hotels=PRIORITY_HOTELS)


def test_no_or_unknown_priority_means_cheapest():
    for prefs in ({}, {"priority": "cheapest"}, {"priority": "luxury"}):
        check = run_check(prefs, flights=PRIORITY_FLIGHTS, hotels=PRIORITY_HOTELS)
        assert (check["flight"]["id"], check["hotel"]["id"]) == ("FL-SLOW", "HT-BASIC")


def test_fastest_picks_the_shortest_flight_and_cheapest_hotel():
    check = run_priority("fastest")
    assert check["flight"]["id"] == "FL-FAST"
    assert check["hotel"]["id"] == "HT-BASIC"  # no travel-time data for hotels


def test_comfort_picks_fewest_stops_and_best_rated_hotel():
    check = run_priority("comfort")
    assert check["flight"]["id"] == "FL-MID"  # direct, and cheaper than the other direct one
    assert check["hotel"]["id"] == "HT-LUXE"


def test_balanced_weighs_price_against_time_and_rating():
    check = run_priority("balanced")
    assert check["flight"]["id"] == "FL-MID"
    assert check["hotel"]["id"] == "HT-GOOD"


def test_priority_only_spends_what_the_budget_has_room_for():
    # Cheapest picks: 4000 + 1500*2 = 7000. A 9000 budget leaves 2000 of room.
    check = run_priority("comfort", budget=9000.0)
    assert check["flight"]["id"] == "FL-MID"     # +600, room left 1400
    assert check["hotel"]["id"] == "HT-GOOD"     # +1000, LUXE would be +11000
    assert check["within_budget"] is True
    assert check["too_dear"]["stay"] == ["HT-LUXE"]


def test_priority_never_overspends_when_cheapest_is_already_over():
    check = run_priority("fastest", budget=5000.0)
    assert check["flight"]["id"] == "FL-SLOW"
    assert set(check["too_dear"]["flight"]) == {"FL-MID", "FL-FAST"}


def test_priority_is_read_from_the_web_apps_filters_object():
    check = run_check({"filters": {"priority": "fastest"}}, flights=PRIORITY_FLIGHTS, hotels=PRIORITY_HOTELS)
    assert check["flight"]["id"] == "FL-FAST"


def priority_ledger(priority, budget=50000.0):
    request = {**REQUEST, "budget": budget, "preferences": {"priority": priority}}
    state = {"request": request, "flight_options": PRIORITY_FLIGHTS, "hotel_options": PRIORITY_HOTELS}
    state.update(check_node(state))
    return {row["alternative"].split()[0]: row["reason"] for row in graph.build_ledger(state)}


def test_ledger_explains_priority_choices():
    fastest = priority_ledger("fastest")
    assert fastest["FL-FAST"].startswith("Shortest flight")
    assert fastest["FL-SLOW"] == "Slower: 5h 00m vs 2h 15m for FL-FAST; 2,500 less than FL-FAST"
    comfort = priority_ledger("comfort")
    assert comfort["FL-SLOW"].startswith("More stops: 1 vs 0 for FL-MID")
    assert comfort["HT-BASIC"].startswith("Lower rated: 3.6 vs 4.9 for HT-LUXE")


def test_ledger_says_when_the_budget_blocked_a_better_option():
    ledger = priority_ledger("comfort", budget=9000.0)
    assert ledger["HT-LUXE"].startswith("Budget: ranks higher but costs")


def test_template_rationale_names_the_priority(no_llm):
    request = {**REQUEST, "preferences": {"priority": "comfort"}}
    result = pipeline.invoke({"request": request})
    assert "fewest stops" in result["itinerary"]["rationale"]


# ---- whole rupees in flags and rationale facts ---------------------------------

def test_over_budget_flag_shows_whole_rupees():
    # 950.333... a night x 3 nights: the flag must not say "2,851.0".
    hotels = [{"id": "HT-F", "name": "Fractional", "price_per_night": 2851 / 3, "rating": 4.0}]
    request_end = REQUEST["start_date"].replace(day=REQUEST["start_date"].day + 3)
    check = run_check(budget=1000.0, hotels=hotels, end=request_end)
    flag = check["flags"][-1]
    assert "hotel HT-F 3 night(s) 2,851)" in flag
    assert ".0" not in flag


def test_rationale_facts_are_whole_rupees():
    hotels = [{"id": "HT-F", "name": "Fractional", "price_per_night": 2851 / 3, "rating": 4.0}]
    request = {**REQUEST, "end_date": REQUEST["start_date"].replace(day=REQUEST["start_date"].day + 3)}
    state = {"request": request, "flight_options": PRIORITY_FLIGHTS, "hotel_options": hotels}
    state.update(check_node(state))
    facts = graph.rationale_facts(state)
    money = [facts["budget"], facts["total_cost"], facts["savings_vs_median_valid_options"],
             facts["difference_from_budget"], facts["flight"]["price"],
             facts["hotel"]["price_per_night"], facts["hotel"]["stay_cost"]]
    assert all(isinstance(value, int) for value in money)
    assert facts["hotel"]["price_per_night"] == 950 and facts["hotel"]["stay_cost"] == 2851


def test_llm_amounts_with_thousands_separators_pass_the_guardrail(monkeypatch):
    request = {**REQUEST, "end_date": REQUEST["start_date"].replace(day=REQUEST["start_date"].day + 3)}
    state = {"request": request, "flight_options": PRIORITY_FLIGHTS,
             "hotel_options": [{"id": "HT-F", "name": "Fractional", "price_per_night": 2851 / 3, "rating": 4.0}]}
    state.update(check_node(state))
    total = graph.rationale_facts(state)["total_cost"]
    fake = FakeLLM(f"The total comes to {total:,}, within the {int(REQUEST['budget']):,} budget.")
    monkeypatch.setattr(graph, "get_llm", lambda: fake)
    result = graph.compose(state)
    assert result["itinerary"]["rationale"] == fake.text
    assert "whole numbers with thousands separators" in fake.prompt


# ---- flexible dates and fare flags ----------------------------------------------

def dated(fid, day, price, airline="IndiGo"):
    return {"id": fid, "price": price, "cabin_class": "economy", "stops": 0, "airline": airline,
            "departure_time": f"{day}T09:00:00", "arrival_time": f"{day}T11:00:00"}


def test_flexible_dates_search_nearby_days_both_ways(monkeypatch):
    asked = []

    def fake_search(origin, destination, day, cabin_class=None):
        asked.append((origin, day.isoformat()))
        return [dated(f"FL-{origin}-{day.isoformat()}", day.isoformat(), 5000)]

    monkeypatch.setattr(graph.travel_data, "search_flights", fake_search)
    monkeypatch.setattr(graph.travel_data, "search_hotels", lambda *a: [])
    request = {**REQUEST, "preferences": {"flexible_days": 1}}
    found = graph.search_node({"request": request})
    assert sorted(asked) == sorted([
        ("BLR", "2026-11-01"), ("BLR", "2026-10-31"), ("BLR", "2026-11-02"),
        ("DEL", "2026-11-03"), ("DEL", "2026-11-02"), ("DEL", "2026-11-04"),
    ])
    assert len(found["flight_options"]) == 3 and len(found["return_options"]) == 3


def test_without_flexible_dates_only_the_trip_days_are_searched(monkeypatch):
    asked = []
    monkeypatch.setattr(graph.travel_data, "search_flights",
                        lambda o, d, day, c=None: asked.append(day) or [dated("FL-X", day.isoformat(), 5000)])
    monkeypatch.setattr(graph.travel_data, "search_hotels", lambda *a: [])
    graph.search_node({"request": REQUEST})
    assert asked == [REQUEST["start_date"], REQUEST["end_date"]]


def test_flexible_dates_flag_a_cheaper_nearby_fare():
    flights = [dated("FL-ON", "2026-11-01", 6000), dated("FL-EARLY", "2026-10-31", 4500)]
    check = run_check({"flexible_days": 1}, flights=flights)
    assert check["flight"]["id"] == "FL-ON"  # the trip's dates stay fixed
    assert "Flight: FL-EARLY on 2026-10-31 costs 4,500, 1,500 less than FL-ON on the trip's date" in check["flags"]


def test_cheaper_nearby_fare_is_not_flagged_without_flexible_dates():
    flights = [dated("FL-ON", "2026-11-01", 6000), dated("FL-EARLY", "2026-10-31", 4500)]
    assert not any("less than FL-ON" in f for f in run_check(flights=flights)["flags"])


def test_high_price_level_is_flagged_with_the_typical_range():
    high = {**dated("FL-HI", "2026-11-01", 9000), "price_level": "high", "typical_price_range": [5000, 7000]}
    check = run_check(flights=[high])
    assert "Flight: Google Flights rates fares on this date as high for the route (typical 5,000 to 7,000)" in check["flags"]
    typical = {**high, "price_level": "typical"}
    assert not any("rates fares" in f for f in run_check(flights=[typical])["flags"])
