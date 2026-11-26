"""Door-to-door routes: fly to the nearest airport then bus or cab, train to a nearby station then bus
or cab, or a bus to the town's own bus stand (Bengaluru to Mydukuru: Kadapa airport, Kamalapuram
station, Mydukuru's APSRTC stand)."""
from datetime import date

from app import ground
from app.access import plan, stations, town
from app.routers import explore
from app.travel_data import INDIA_PLACES


def by_mode(p):
    return {r["mode"]: r for r in p["routes"]}


def test_a_town_without_airport_or_station_gets_every_way_there():
    routes = by_mode(plan("BLR", "mydukuru"))
    assert set(routes) == {"flight", "train", "bus"}
    fly = routes["flight"]
    assert [l["mode"] for l in fly["legs"]] == ["flight", "road"]
    assert "(CDP)" in fly["legs"][0]["to"] and fly["legs"][1]["to"] == "Mydukuru"
    assert fly["title"].startswith("Fly to Kadapa (CDP), then bus or cab") and fly["own"] is False
    train = routes["train"]
    assert [l["mode"] for l in train["legs"]] == ["train", "road"]
    names = [s["name"] for s in train["stations"]]
    assert names[0] == "Kamalapuram" and any("Kadapa" in n for n in names)  # nearest, and the big junction
    assert routes["bus"]["title"].startswith("Direct bus to Mydukuru") and routes["bus"]["own"] is True


def test_the_way_back_starts_with_the_road_to_the_airport_or_station():
    routes = by_mode(plan("mydukuru", "BLR"))
    assert [l["mode"] for l in routes["flight"]["legs"]] == ["road", "flight"]
    assert [l["mode"] for l in routes["train"]["legs"]] == ["road", "train"]


def test_a_town_with_its_own_station_needs_no_last_stretch_by_train():
    train = by_mode(plan("BLR", "ayodhya"))["train"]
    assert [l["mode"] for l in train["legs"]] == ["train"] and train["own"] is True
    assert stations(INDIA_PLACES["ayodhya"])[0]["code"] == "AY"


def test_an_airport_code_stands_for_the_town_it_serves():
    assert town("BLR")["city"] == "Bengaluru"
    assert town("DXB") is None  # abroad: flights only


def test_access_endpoint(client):
    body = client.get("/access", params={"origin": "BLR", "destination": "mydukuru"}).json()
    assert [r["mode"] for r in body["routes"]] == ["flight", "train", "bus"]
    assert body["destination"]["name"] == "Mydukuru" and "straight-line" in body["note"]
    assert client.get("/access", params={"origin": "blr", "destination": "mydukuru"}).status_code == 200
    assert client.get("/access", params={"origin": "BLR", "destination": "atlantis-zz"}).status_code == 404
    assert client.get("/access", params={"origin": "BLR", "destination": "BLR"}).status_code == 422


def test_last_leg_lists_real_buses_from_the_airport_city(monkeypatch):
    asked = []

    def fake(origin, destination, day):
        asked.append((origin, destination))
        return [
            {"kind": "bus", "duration_minutes": 50, "service": "APSRTC"},
            {"kind": "train", "duration_minutes": None, "service": "x"},
            {"kind": "ferry", "duration_minutes": 10, "service": "y"},
        ]

    monkeypatch.setattr(explore, "search_ground", fake)
    leg = explore.last_leg("mydukuru", date(2026, 12, 17))
    assert asked == [("CDP", "mydukuru")]
    assert leg["from_name"] == "Kadapa" and leg["to_name"] == "Mydukuru" and leg["km"] > 3
    assert [o["service"] for o in leg["options"]] == ["APSRTC"]
    assert explore.last_leg("BLR", date(2026, 12, 17)) is None  # an airport needs no last stretch
    assert explore.last_leg("ayodhya", date(2026, 12, 17))["from"] == "AYJ"

    monkeypatch.setattr(explore, "search_ground", lambda *a: (_ for _ in ()).throw(ground.GroundUnavailable("no key")))
    assert explore.last_leg("mydukuru", date(2026, 12, 17))["notice"] == "no key"


# ---- which way of travel suits the budget -------------------------------------------------

class _Trip:
    def __init__(self, budget, start=date(2026, 12, 17), end=date(2026, 12, 20)):
        self.budget, self.start_date, self.end_date = budget, start, end


class _Itinerary:
    flight = {"price": 6000}
    return_flight = {"price": 5500}
    hotel = {"price_per_night": 3000}


ROWS = [
    {"mode": "Flight", "fare": 6000, "duration_minutes": 70},
    {"mode": "Train", "fare": 900, "duration_minutes": 600},
    {"mode": "Bus", "fare": None, "duration_minutes": 480},
]


def test_budget_pick_names_the_way_that_fits_after_the_hotel():
    pick = explore.budget_pick(_Trip(25000), _Itinerary(), ROWS)
    # 25,000 - 3 nights x 3,000 = 16,000 left; flight 11,500 there and back fits, train 1,800 fits.
    assert pick["left_for_travel"] == 16000 and pick["hotel"] == 9000
    assert {o["mode"]: o["cost"] for o in pick["options"]} == {"Flight": 11500, "Train": 1800}
    assert pick["fits"] and pick["mode"] in ("Flight", "Train")
    assert pick["message"].startswith("Your budget is ₹25,000. The hotel takes ₹9,000, leaving ₹16,000 for travel.")
    assert "fits your budget" in pick["message"]


def test_budget_pick_says_what_goes_over():
    pick = explore.budget_pick(_Trip(15000), _Itinerary(), ROWS)  # 6,000 left for travel
    assert pick["mode"] == "Train" and pick["fits"]
    assert "the flight at ₹11,500 would go over" in pick["message"]


def test_budget_pick_when_nothing_fits_names_the_cheapest():
    pick = explore.budget_pick(_Trip(10000), _Itinerary(), ROWS)  # 1,000 left
    assert pick["mode"] == "Train" and not pick["fits"]
    assert "No way of travel fits" in pick["message"] and "₹800 over" in pick["message"]


def test_budget_pick_without_any_fare_says_so():
    pick = explore.budget_pick(_Trip(10000), None, [{"mode": "Bus", "fare": None, "duration_minutes": 400}])
    assert pick["mode"] is None and not pick["fits"] and pick["options"] == []
    assert pick["message"] == "Your budget is ₹10,000. None of these routes publishes a fare yet, so none can be checked against it."


def test_flight_messages_name_the_airport_a_town_flies_from():
    from app.pipeline import graph
    assert graph.flown("BLR") == "BLR"
    assert graph.flown("mydukuru") == "CDP (Kadapa airport, for Mydukuru)"
    assert graph.flown("ayodhya") == "AYJ"


def test_budget_pick_without_travel_times_takes_the_cheapest_that_fits():
    rows = [{"mode": "Flight", "fare": 6000, "duration_minutes": None}, {"mode": "Train", "fare": 900, "duration_minutes": None}]
    pick = explore.budget_pick(_Trip(25000), None, rows)
    assert pick["mode"] == "Train" and pick["fits"] and pick["hotel"] == 0
