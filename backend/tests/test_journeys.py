"""Cheaper journeys through another city (app/journeys.py) and GET /journeys.

No network: flights and trains are canned departures in the shapes search_flights and
search_ground return, so the timetable logic and the fare comparison are checked exactly.
"""
from datetime import date, datetime, timedelta

import pytest

from app import journeys
from app.ground import scheduled
from app.journeys import Edge, find_journeys, pareto_search, transfer_minutes, via_cities

DAY = date(2026, 12, 12)


def at(hhmm: str, day: date = DAY) -> datetime:
    return datetime.combine(day, datetime.strptime(hhmm, "%H:%M").time())


def edge(frm, to, dep, arr, fare, mode="flight", stops=0, service=None):
    leg = {"mode": mode, "service": service or f"{frm}-{to} {dep}", "from": {"code": frm, "name": frm},
           "to": {"code": to, "name": to}}
    return Edge(frm, to, mode, at(dep), at(arr), fare, "INR" if fare is not None else None, stops, leg)


def test_minimum_change_times():
    assert transfer_minutes("flight", "flight") == 120
    assert transfer_minutes("train", "flight") == transfer_minutes("flight", "bus") == 150
    assert transfer_minutes("train", "bus") == 45


def test_a_connection_must_fit_the_timetable():
    edges = [
        edge("BBI", "HYD", "08:00", "10:00", 3000),
        edge("HYD", "BLR", "11:00", "12:30", 2000),  # only 60 min after landing: too tight
        edge("HYD", "BLR", "12:30", "14:00", 2500),  # 150 min: fine
        edge("HYD", "BBI", "13:00", "15:00", 100),  # back to the origin: never used
    ]
    found = pareto_search(edges, "BBI", "BLR")
    assert [[e.leg["service"] for e in j.edges] for j in found] == [["BBI-HYD 08:00", "HYD-BLR 12:30"]]
    assert found[0].fare == 5500 and found[0].transfers == 1


def test_a_leg_without_a_fare_makes_the_journey_fare_unknown():
    found = pareto_search([edge("BBI", "HYD", "08:00", "10:00", 3000), edge("HYD", "BLR", "13:00", "20:00", None, "train")], "BBI", "BLR")
    assert found[0].fare is None and found[0].currency is None


def test_via_cities_prefer_hubs_a_small_detour_away():
    assert via_cities("BBI", "BLR", 2) == ["MAA", "HYD"]
    assert via_cities("BBI", "BLR", 0) == []


def test_the_busiest_airports_are_tried_even_out_of_the_way():
    # Bengaluru -> Delhi -> Jaipur is a 27% detour, but Delhi has the most flights to Jaipur.
    assert via_cities("BLR", "JAI", 3) == ["HYD", "BOM", "DEL"]
    # Chennai doesn't bring a traveller nearer to Jaipur, so it is never a stop.
    assert "MAA" not in via_cities("BLR", "JAI", 4)


def test_train_and_bus_times_get_a_date():
    route = {"departs": "11:40 PM", "duration_minutes": 340}
    assert scheduled(route, DAY, 19) == {**route, "departure_time": "2026-12-12T23:40:00", "arrival_time": "2026-12-13T05:20:00"}
    early = scheduled({"departs": "6:10 AM", "duration_minutes": 60}, DAY, 19)  # searched from 7 PM: next morning
    assert early["departure_time"] == "2026-12-13T06:10:00"
    assert scheduled({"departs": "soon", "duration_minutes": 60}, DAY, 5)["departure_time"] is None


# ---- find_journeys with canned searches -------------------------------------------------

def flight(frm, to, dep, arr, price, number, stops=0, day=DAY):
    d, a = at(dep, day), at(arr, day)
    if a < d:
        a += timedelta(days=1)
    return {"id": f"FL-{number}", "origin": frm, "destination": to, "departure_time": d.isoformat(),
            "arrival_time": a.isoformat(), "airline": "IndiGo", "flight_number": number, "price": price,
            "currency": "INR", "stops": stops, "layovers": [], "duration_minutes": int((a - d).total_seconds() / 60),
            "price_status": "live", "link": "https://www.google.com/travel/flights", "source": "Google Flights via SerpApi"}


FLIGHTS = {
    ("BBI", "BLR"): [flight("BBI", "BLR", "16:00", "18:05", 12157, "6E6085"),
                     flight("BBI", "BLR", "17:45", "21:50", 13500, "6E631", stops=1)],
    ("BBI", "MAA"): [flight("BBI", "MAA", "09:05", "11:00", 5100, "6E141")],
    ("MAA", "BLR"): [flight("MAA", "BLR", "15:10", "16:10", 3200, "6E365")],
    ("BBI", "HYD"): [flight("BBI", "HYD", "14:40", "16:10", 8001, "S5662")],
    ("HYD", "BLR"): [flight("HYD", "BLR", "21:05", "22:50", 5151, "9I818")],
}
TRAIN = {"kind": "train", "service": "12245 Duronto Express", "operator": "Indian Railways",
         "from": {"name": "Bhubaneswar", "code": "BBS"}, "to": {"name": "SMVT Bengaluru", "code": "SMVB"},
         "duration_minutes": 1416, "changes": 0, "fare": None, "currency": None, "fare_label": "Not available",
         "source": "Google Maps transit via SerpApi", "data_label": "Live schedule",
         "departure_time": "2026-12-12T16:25:00", "arrival_time": "2026-12-13T16:01:00"}
NEXT_DAY_TRAIN = {**TRAIN, "service": "22504 Vivek Express", "departure_time": "2026-12-13T08:54:00",
                  "arrival_time": "2026-12-14T08:20:00"}


@pytest.fixture
def canned(monkeypatch):
    asked = []

    def fake_flights(frm, to, day, cabin_class=None):
        asked.append(("flight", frm, to, None))
        return FLIGHTS.get((frm, to), [])

    def fake_ground(frm, to, day, hours):
        asked.append(("ground", frm, to, hours))
        return [TRAIN, NEXT_DAY_TRAIN] if (frm, to) == ("BBI", "BLR") else []

    monkeypatch.setattr(journeys, "search_flights", fake_flights)
    monkeypatch.setattr(journeys, "search_ground", fake_ground)
    return asked


def test_a_cheaper_route_through_another_city_is_found_and_explained(canned):
    result = find_journeys("BBI", "BLR", DAY, vias=2)
    by_id = {j["id"]: j for j in result["journeys"]}
    picks = result["recommendations"]

    cheapest = by_id[picks["cheapest_connecting"]["journey"]]
    assert [v["code"] for v in cheapest["via"]] == ["MAA"] and cheapest["fare"] == 8300
    assert cheapest["separate_tickets"] and cheapest["transfer_waits"] == [{"city": {"code": "MAA", "name": "Chennai"}, "minutes": 250}]
    reason = picks["cheapest_connecting"]["reason"]
    assert "₹3,857 cheaper than the cheapest direct option" in reason and "Chennai" in reason

    assert by_id[picks["cheapest_direct"]["journey"]]["fare"] == 12157
    assert by_id[picks["fastest"]["journey"]]["legs"][0]["service"] == "IndiGo 6E6085"
    # Through Hyderabad costs more than going direct, and says so.
    hyd = next(v for v in result["via_summary"] if v["city"]["code"] == "HYD")
    assert hyd["difference_from_direct"] == 995 and "more than the cheapest direct option" in hyd["note"]


def test_trains_are_shown_but_never_called_cheapest(canned):
    result = find_journeys("BBI", "BLR", DAY, vias=0)
    trains = [j for j in result["journeys"] if j["modes"] == ["train"]]
    assert [t["legs"][0]["service"] for t in trains] == ["12245 Duronto Express"]  # the next-day one is left out
    assert trains[0]["fare"] is None and trains[0]["fare_label"].startswith("Not available")
    # A typical range from the distance, for comparing with a budget: never a price.
    estimate = trains[0]["fare_estimate"]
    assert estimate["currency"] == "INR" and 0 < estimate["low"] < estimate["high"]
    assert trains[0]["legs"][0]["fare_estimate"]["label"].startswith("Estimate from about")
    flights = [j for j in result["journeys"] if j["modes"] == ["flight"]]
    assert flights and all(j["fare_estimate"] is None for j in flights)
    assert all(p is None or "Duronto" not in p["reason"] for k, p in result["recommendations"].items() if k != "fastest")


def test_each_leg_is_searched_once_from_the_right_time(canned):
    find_journeys("BBI", "BLR", DAY, vias=2)
    grounds = {(frm, to): hours for kind, frm, to, hours in canned if kind == "ground"}
    assert grounds[("BBI", "BLR")] == (5, 12, 19)  # the direct route: the whole day
    assert grounds[("BBI", "MAA")] == (5,) and grounds[("MAA", "BLR")] == (12,)
    assert len([a for a in canned if a[0] == "flight"]) == 5


def test_flights_only_through_two_cities(canned, monkeypatch):
    # Bengaluru -> Goa -> Delhi -> Jaipur on separate tickets beats a festival-time direct fare.
    fares = {
        ("BLR", "JAI"): [flight("BLR", "JAI", "06:00", "08:40", 30000, "6E101")],
        ("BLR", "GOI"): [flight("BLR", "GOI", "05:30", "06:45", 3000, "6E201")],
        ("GOI", "DEL"): [flight("GOI", "DEL", "10:00", "12:40", 5000, "6E301")],
        ("DEL", "JAI"): [flight("DEL", "JAI", "15:00", "16:00", 10000, "6E401")],
    }
    monkeypatch.setattr(journeys, "search_flights", lambda frm, to, day, cabin_class=None: fares.get((frm, to), []))
    monkeypatch.setattr(journeys, "via_cities", lambda o, d, n: ["GOI", "DEL"])
    result = find_journeys("BLR", "JAI", DAY, modes={"flight"}, vias=2, via_depth=2)
    by_id = {j["id"]: j for j in result["journeys"]}
    pick = result["recommendations"]["cheapest_connecting"]
    best = by_id[pick["journey"]]
    assert [v["code"] for v in best["via"]] == ["GOI", "DEL"] and best["fare"] == 18000
    assert best["modes"] == ["flight", "flight", "flight"] and best["transfers"] == 2
    assert "₹12,000 cheaper than the cheapest direct option" in pick["reason"]


def test_through_the_cities_the_traveller_names(canned, monkeypatch):
    # Bengaluru -> Goa -> Bhubaneswar -> Jaipur: a zigzag no automatic pick would try.
    fares = {
        ("BLR", "JAI"): [flight("BLR", "JAI", "06:00", "08:40", 30000, "6E101")],
        ("BLR", "GOI"): [flight("BLR", "GOI", "05:30", "06:45", 3000, "6E201")],
        ("GOI", "BBI"): [flight("GOI", "BBI", "09:00", "11:20", 5000, "6E501")],
        ("BBI", "JAI"): [flight("BBI", "JAI", "14:00", "16:10", 10000, "6E601")],
    }
    asked = []

    def search_flights(frm, to, day, cabin_class=None):
        asked.append((frm, to))
        return fares.get((frm, to), [])

    monkeypatch.setattr(journeys, "search_flights", search_flights)
    result = find_journeys("BLR", "JAI", DAY, modes={"flight"}, via=["goi", "BBI"])
    assert result["via_chosen"] and [v["code"] for v in result["via_cities"]] == ["GOI", "BBI"]
    assert ("GOI", "BBI") in asked and ("BBI", "GOI") not in asked  # only in the order named
    pick = result["recommendations"]["cheapest_connecting"]
    best = next(j for j in result["journeys"] if j["id"] == pick["journey"])
    assert [v["code"] for v in best["via"]] == ["GOI", "BBI"] and best["fare"] == 18000
    assert "₹12,000 cheaper than the cheapest direct option, 8h 00m longer." in pick["reason"]


def test_named_cities_must_be_real_and_different(canned):
    with pytest.raises(journeys.TravelDataError, match="Unknown airport code: ZZZ"):
        find_journeys("BLR", "JAI", DAY, via=["GOI", "ZZZ"])
    with pytest.raises(journeys.TravelDataError, match="once"):
        find_journeys("BLR", "JAI", DAY, via=["GOI", "JAI"])
    with pytest.raises(journeys.TravelDataError, match="at most 3"):
        find_journeys("BLR", "JAI", DAY, via=["GOI", "BBI", "HYD", "BOM"])


def test_only_the_chosen_modes_are_searched(canned):
    result = find_journeys("BBI", "BLR", DAY, modes={"train"}, vias=0)
    assert all(a[0] == "ground" for a in canned)
    assert result["modes"] == ["train"] and result["recommendations"]["cheapest_direct"] is None


def test_nothing_found_says_so(canned, monkeypatch):
    monkeypatch.setattr(journeys, "search_flights", lambda *a, **k: [])
    monkeypatch.setattr(journeys, "search_ground", lambda *a, **k: [])
    result = find_journeys("BBI", "BLR", DAY, vias=1)
    assert result["journeys"] == [] and "No flights, trains or buses" in result["notice"]


# ---- GET /journeys -----------------------------------------------------------------------

def test_journeys_endpoint(client, auth_headers, canned):
    params = {"origin": "bbi", "destination": "BLR", "date": "2026-12-12", "vias": 1}
    assert client.get("/journeys", params=params).status_code == 401  # each search costs money
    body = client.get("/journeys", params=params, headers=auth_headers).json()
    assert body["origin"] == {"code": "BBI", "name": "Bhubaneswar"} and body["via_cities"] == [{"code": "MAA", "name": "Chennai"}]
    assert "Dijkstra" in body["method"]
    bad = client.get("/journeys", params={**params, "modes": "rocket"}, headers=auth_headers)
    assert bad.status_code == 422 and "modes" in bad.json()["detail"]
    assert client.get("/journeys", params={**params, "date": "2020-01-01"}, headers=auth_headers).status_code == 422
    assert client.get("/journeys", params={**params, "destination": "ZZZ"}, headers=auth_headers).status_code == 422


def test_trip_journeys_use_the_trips_route_and_day(client, auth_headers, other_headers, trip_payload, canned):
    trip = client.post("/trip", json={**trip_payload, "origin": "BBI", "destination": "BLR",
                                      "dates": ["2026-12-12", "2026-12-15"]}, headers=auth_headers).json()
    body = client.get(f"/trips/{trip['id']}/journeys", params={"vias": 0}, headers=auth_headers).json()
    assert body["date"] == "2026-12-12" and body["destination"]["code"] == "BLR"
    assert client.get(f"/trips/{trip['id']}/journeys", headers=other_headers).status_code == 404
