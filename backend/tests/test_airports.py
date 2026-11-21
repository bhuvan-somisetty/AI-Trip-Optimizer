"""Every airport with scheduled flights (app/data/airports.json) and GET /airports."""
from datetime import date

from app import ground, travel_data
from app.pipeline import graph
from app.travel_data import AIRPORTS, CITIES, country_name, search_airports


def test_thousands_of_airports_with_their_cities():
    assert len(AIRPORTS) > 3500
    assert sum(a["country"] == "IN" for a in AIRPORTS.values()) > 100
    assert CITIES["VNS"] == ("Varanasi", "IN") and CITIES["ATQ"] == ("Amritsar", "IN")
    assert CITIES["CDG"] == ("Paris", "FR")  # "Paris (Roissy-en-France, Val-d'Oise)" cleaned
    assert all(len(code) == 3 and code.isupper() for code in AIRPORTS)


def test_city_names_a_traveller_means():
    # The airport's own town is Vasco da Gama / Narita; travellers mean Goa / Tokyo.
    assert CITIES["GOI"] == ("Goa", "IN") and CITIES["GOX"] == ("Goa", "IN")
    assert CITIES["NRT"][0] == CITIES["HND"][0] == "Tokyo"
    assert CITIES["EWR"][0] == "New York"


def test_search_puts_the_meant_airport_first():
    first = lambda q: search_airports(q)[0]["code"]
    assert first("DEL") == "DEL"
    assert first("goa") in ("GOI", "GOX")  # Goa, India before Genova (code GOA)
    assert first("varanasi") == "VNS"
    assert first("udai") == "UDR"
    assert {a["code"] for a in search_airports("london", 4)} >= {"LHR", "LGW"}
    assert search_airports("   ") == [] and search_airports("zzzzqq") == []
    assert len(search_airports("a", 7)) == 7


def test_country_names():
    assert country_name("IN") == "India" and country_name("JP") == "Japan"
    assert country_name("XX") == "XX"


def test_any_listed_airport_is_domestic_or_international_by_its_country():
    assert graph.international({"destination": "VNS"}) is False
    assert graph.international({"destination": "CMB"}) is True  # Colombo, Sri Lanka


def test_trains_and_buses_reach_new_indian_cities(monkeypatch):
    monkeypatch.setattr(travel_data, "_cache", {})
    monkeypatch.setattr(ground.config, "SERPAPI_API_KEY", "test-key")
    asked = []
    monkeypatch.setattr(ground, "_request", lambda *a, params=None, **k: asked.append(params) or {})
    assert ground.search_ground("VNS", "LKO", date(2026, 12, 12)) == []
    assert asked[0]["start_addr"] == "Varanasi, India" and asked[0]["end_addr"] == "Lucknow, India"


# ---- GET /airports -----------------------------------------------------------------------

def test_airport_search_endpoint(client):
    body = client.get("/airports", params={"q": "amrit"}).json()
    top = body["airports"][0]
    assert top["code"] == "ATQ" and top["city"] == "Amritsar" and top["country_name"] == "India"
    assert {"airport", "latitude", "longitude"} <= top.keys()
    assert "OurAirports" in body["source"]
    assert client.get("/airports", params={"q": ""}).status_code == 422
    assert client.get("/airports", params={"q": "a", "limit": 51}).status_code == 422


def test_one_airport_by_code(client):
    assert client.get("/airports/ixz").json()["city"] == "Port Blair"
    assert client.get("/airports/QQQ").status_code == 404


def test_a_trip_to_a_newly_listed_city_is_accepted(client, auth_headers, trip_payload):
    response = client.post("/trip", json={**trip_payload, "destination": "VNS"}, headers=auth_headers)
    assert response.status_code == 201 and response.json()["destination"] == "VNS"


# ---- a namesake city far from its airport ------------------------------------------------

def test_a_namesake_city_is_replaced_by_the_one_near_the_airport(monkeypatch):
    from app import places

    # By name alone OpenTripMap finds Udaipur in Tripura, about 1,500 km from Udaipur airport.
    monkeypatch.setattr(places, "_otm", lambda endpoint, **p: {"lat": 23.53, "lon": 91.48})
    asked = []

    class Reply:
        status_code = 200

        def json(self):
            return [{"lat": "24.5787", "lon": "73.6863"}]
    monkeypatch.setattr(places.httpx, "get", lambda url, params, **k: asked.append(params) or Reply())
    assert places.city_centre("UDR") == (24.5787, 73.6863)
    assert asked[0]["q"] == "Udaipur" and asked[0]["bounded"] == 1 and asked[0]["countrycodes"] == "in"


def test_the_city_found_by_name_is_kept_when_near_its_airport(monkeypatch):
    from app import places

    monkeypatch.setattr(places, "_otm", lambda endpoint, **p: {"lat": 15.4957, "lon": 73.8262})
    monkeypatch.setattr(places.httpx, "get", lambda *a, **k: (_ for _ in ()).throw(AssertionError("not needed")))
    assert places.city_centre("GOI") == (15.4957, 73.8262)  # Panaji, 14 km from Dabolim


def test_the_airport_itself_when_nothing_else_finds_the_city(monkeypatch):
    from app import places

    monkeypatch.setattr(places, "_otm", lambda endpoint, **p: {})
    monkeypatch.setattr(places, "near_airport", lambda *a: None)
    assert places.city_centre("IXZ") == (AIRPORTS["IXZ"]["latitude"], AIRPORTS["IXZ"]["longitude"])
