from datetime import date

import pytest

import app.pipeline.graph as graph
from app import travel_data
from app.pipeline.graph import check_node, edit_itinerary, EditRefused

REQUEST = {
    "origin": "BLR",
    "destination": "DEL",
    "start_date": date(2026, 11, 1),
    "end_date": date(2026, 11, 3),
    "budget": 50000.0,
    "preferences": {},
}
OUT = [
    {"id": "FL-A", "airline": "IndiGo", "price": 5200, "cabin_class": "economy", "stops": 0,
     "departure_time": "2026-11-01T06:00:00", "arrival_time": "2026-11-01T08:40:00"},
    {"id": "FL-B", "airline": "IndiGo", "price": 3900, "cabin_class": "economy", "stops": 1,
     "departure_time": "2026-11-01T14:00:00", "arrival_time": "2026-11-01T19:00:00"},
]
BACK = [
    {"id": "FL-R1", "airline": "IndiGo", "price": 4800, "cabin_class": "economy", "stops": 0, "departure_time": "2026-11-03T18:00:00"},
    {"id": "FL-R2", "airline": "IndiGo", "price": 3100, "cabin_class": "economy", "stops": 1, "departure_time": "2026-11-03T07:00:00"},
    {"id": "FL-R3", "airline": "IndiGo", "price": 2500, "cabin_class": "economy", "stops": 0, "departure_time": "2026-11-04T07:00:00"},
]
HOTELS = [
    {"id": "HT-A", "name": "Hotel A", "price_per_night": 3800, "rating": 4.2},
    {"id": "HT-B", "name": "Hotel B", "price_per_night": 1600, "rating": 3.5},
]


def state(back=BACK, **changes):
    s = {"request": {**REQUEST, **changes}, "flight_options": OUT, "hotel_options": HOTELS}
    if back is not None:
        s["return_options"] = back
    return s


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(graph, "get_llm", lambda: None)


# ---- the return leg ---------------------------------------------------------

def test_return_is_the_cheapest_valid_flight_on_the_end_date():
    check = check_node(state())["check"]
    assert check["return_flight"]["id"] == "FL-R2"  # FL-R3 is cheaper but a day late
    assert check["total_cost"] == 3900 + 3100 + 1600 * 2
    late = next(r for r in check["rejected"] if r["option_id"] == "FL-R3")
    assert late == {
        "kind": "return", "option_id": "FL-R3", "rule": "travel_date",
        "detail": "FL-R3 departs 2026-11-04, 1 day(s) after the trip ends",
    }


def test_return_follows_the_trip_preferences():
    check = check_node(state(preferences={"max_stops": 0}))["check"]
    assert check["flight"]["id"] == "FL-A"
    assert check["return_flight"]["id"] == "FL-R1"


def test_no_return_fare_still_builds_the_trip_with_a_flag():
    check = check_node(state(back=[]))["check"]
    assert check["return_flight"] is None
    assert check["total_cost"] == 3900 + 1600 * 2
    assert check["flags"] == ["No return fare found from DEL to BLR on 2026-11-03, so the total has no return flight in it"]


def test_failed_return_search_is_flagged_not_fatal(monkeypatch):
    def search(origin, destination, day, cabin_class=None):
        if origin == "DEL":
            raise travel_data.TravelDataError("Travelpayouts took too long to answer, please try again")
        return OUT

    monkeypatch.setattr(travel_data, "search_flights", search)
    monkeypatch.setattr(travel_data, "search_hotels", lambda *a: HOTELS)
    result = graph.pipeline.invoke({"request": {**REQUEST, "start_date": date(2026, 11, 1)}})
    assert result["itinerary"]["return_flight"] is None
    assert result["check"]["flags"] == [
        "Return flight search failed: Travelpayouts took too long to answer, please try again, "
        "so the total has no return flight in it"
    ]


def test_same_day_return_cannot_leave_before_the_outbound_lands():
    same_day = [
        {"id": "FL-EARLY", "airline": "IndiGo", "price": 1000, "cabin_class": "economy", "stops": 0, "departure_time": "2026-11-01T12:00:00"},
        {"id": "FL-EVE", "airline": "IndiGo", "price": 2000, "cabin_class": "economy", "stops": 0, "departure_time": "2026-11-01T21:00:00"},
    ]
    check = check_node(state(back=same_day, end_date=date(2026, 11, 1)))["check"]
    assert check["flight"]["id"] == "FL-B"  # lands 19:00
    assert check["return_flight"]["id"] == "FL-EVE"
    assert {"kind": "return", "option_id": "FL-EARLY", "rule": "connection",
            "detail": "FL-EARLY leaves before FL-B lands"} in check["rejected"]


def test_ledger_has_a_row_for_every_return_option():
    s = state()
    s["check"] = check_node(s)["check"]
    rows = [e for e in graph.build_ledger(s) if e["kind"] == "return"]
    assert [e["alternative"].split()[0] for e in rows] == ["FL-R3", "FL-R2", "FL-R1"]
    assert [e["won"] for e in rows] == [False, True, False]
    assert rows[0]["reason"].startswith("Different day: FL-R3 departs 2026-11-04, 1 day(s) after the trip ends")
    assert rows[2]["reason"] == "Price: 1,700 more than FL-R2"


def test_rationale_names_the_return_flight():
    s = {**state(), **check_node(state())}
    text = graph.compose(s)["itinerary"]["rationale"]
    assert "return flight FL-R2" in text and "3,100" in text


def test_return_with_same_id_as_an_outbound_is_judged_on_its_own():
    back = [{**OUT[1], "departure_time": "2026-11-03T14:00:00"}]  # FL-B again, the day the trip ends
    check = check_node(state(back=back))["check"]
    assert check["flight"]["id"] == "FL-B" and check["return_flight"]["id"] == "FL-B"


# ---- savings (PRD US-010) ---------------------------------------------------

def test_savings_is_median_valid_option_minus_chosen_per_line_item():
    check = check_node(state())["check"]
    # flight median(5,200, 3,900) - 3,900, return median(4,800, 3,100) - 3,100 (FL-R3 is on the
    # wrong day), stay (median(3,800, 1,600) - 1,600) x 2
    assert check["savings"] == 650 + 850 + 2200


def test_one_luxury_option_does_not_inflate_savings():
    hotels = HOTELS + [{"id": f"HT-{i}", "name": "Mid", "price_per_night": 2000, "rating": 4.0} for i in range(3)]
    hotels.append({"id": "HT-LUX", "name": "Palace", "price_per_night": 60000, "rating": 4.9})
    s = {**state(), "hotel_options": hotels}
    check = check_node(s)["check"]
    assert check["typical"]["stay"] == 2000 * 2  # the median of 1,600, 2,000 x3, 3,800, 60,000


def test_savings_ignore_options_a_rule_ruled_out():
    check = check_node(state(preferences={"max_stops": 0, "min_hotel_rating": 4.0}))["check"]
    assert check["savings"] == 0  # one valid option per line item: nothing to beat


def test_edit_recomputes_savings():
    s = state()
    check = check_node(s)["check"]
    current = {"flight": check["flight"], "return_flight": check["return_flight"], "hotel": check["hotel"]}
    edited = edit_itinerary(s, current, "return", "FL-R1", [])
    assert edited["return_flight"]["id"] == "FL-R1"
    assert edited["total_cost"] == 3900 + 4800 + 1600 * 2
    assert edited["savings"] == 650 + (3950 - 4800) + 2200  # the pricier return costs more than typical
    assert edited["picked"] == ["return"]


def test_edit_refuses_a_return_on_another_day():
    s = state()
    check = check_node(s)["check"]
    current = {"flight": check["flight"], "return_flight": check["return_flight"], "hotel": check["hotel"]}
    with pytest.raises(EditRefused, match="FL-R3 can't be picked: FL-R3 departs 2026-11-04"):
        edit_itinerary(s, current, "return", "FL-R3", [])
