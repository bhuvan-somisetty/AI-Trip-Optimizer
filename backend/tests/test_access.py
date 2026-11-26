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
