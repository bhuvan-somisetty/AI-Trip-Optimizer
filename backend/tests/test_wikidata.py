"""Day trips and famous hotels from Wikidata (app/wikidata.py) on the destination page.

No network: the SPARQL answer is canned in the shape query.wikidata.org returns.
"""
from app import wikidata
from app.travel_data import TravelDataError
import app.routers.explore as explore


def row(qid, name, type_qid, km, links, image=True, description="fort in Rajasthan, India"):
    out = {
        "item": {"value": f"http://www.wikidata.org/entity/{qid}"},
        "itemLabel": {"value": name},
        "type": {"value": f"http://www.wikidata.org/entity/{type_qid}"},
        "dist": {"value": str(km)},
        "links": {"value": str(links)},
        "coord": {"value": "Point(75.85 26.98)"},
        "article": {"value": f"https://en.wikipedia.org/wiki/{name.replace(' ', '_')}"},
        "itemDescription": {"value": description},
    }
    if image:
        out["image"] = {"value": "http://commons.wikimedia.org/wiki/Special:FilePath/Amber%20Fort.jpg"}
    return out


ROWS = [
    row("Q1", "Bhangarh Fort", "Q57821", 56.0, 20, image=False),
    row("Q2", "Ranthambore National Park", "Q46169", 113.0, 38),
    row("Q2", "Ranthambore National Park", "Q473972", 113.0, 38),  # two matching classes
    row("Q3", "Q3", "Q57821", 40.0, 9),  # no English label
]


def test_places_are_ranked_by_fame_once_each():
    found = wikidata.rows_to_places(ROWS, wikidata.DAY_TRIP_TYPES, "day_trip", 5)
    assert [p["name"] for p in found] == ["Ranthambore National Park", "Bhangarh Fort"]
    park, fort = found
    assert park["category"] == "National park" and park["distance_m"] == 113000
    assert park["image"].startswith("https://commons.wikimedia.org/wiki/Special:FilePath/Amber%20Fort.jpg?width=")
    assert park["image_label"] == "Photo: Wikimedia Commons" and park["data_label"] == "Wikidata"
    assert (park["latitude"], park["longitude"]) == (26.98, 75.85)
    assert fort["image"] is None and fort["description"] == "Fort in Rajasthan, India"


def test_a_slow_wide_search_falls_back_to_a_smaller_radius(monkeypatch):
    asked = []

    def query(sparql):
        asked.append(sparql)
        if f'"{wikidata.DAY_TRIP_MAX_KM}"' in sparql:
            raise TravelDataError("Wikidata took too long to answer, please try again")
        return ROWS[:1]

    monkeypatch.setattr(wikidata, "_query", query)
    found, notice = wikidata.around("day_trip", 26.9, 75.8)
    assert [p["name"] for p in found] == ["Bhangarh Fort"] and notice is None and len(asked) == 2
    assert wikidata.around("day_trip", 26.9, 75.8) == (found, None) and len(asked) == 2  # cached


def test_when_wikidata_is_down_the_lists_are_empty_with_a_notice(monkeypatch):
    def down(sparql):
        raise TravelDataError("Wikidata couldn't be reached, please try again")

    monkeypatch.setattr(wikidata, "_query", down)
    found, notice = wikidata.around("stay", 26.9, 75.8)
    assert found == [] and notice.startswith("Wikidata couldn't be reached right now")


def test_day_trips_and_famous_stays_on_the_destination_page(client, auth_headers, monkeypatch):
    city = {"city": "JAI", "city_name": "Jaipur", "centre": {"latitude": 26.91, "longitude": 75.79},
            "attractions": [{"name": "Bhangarh Fort", "section": "history_culture", "latitude": None, "longitude": None}],
            "restaurants": [], "food_spots": [], "source": "test"}
    monkeypatch.setattr(explore, "explore_city", lambda session, code: city)
    monkeypatch.setattr(explore, "dishes_for", lambda session, code: ([], "no AI model in tests"))
    stays = [row("Q9", "Rambagh Palace", "Q27686", 3.0, 13, description="building in Jaipur")]
    monkeypatch.setattr(wikidata, "_query", lambda sparql: stays if "wd:Q57821" not in sparql else ROWS)
    body = client.get("/destinations/JAI", headers=auth_headers).json()
    # Bhangarh is already among the attractions, so it isn't listed again as a day trip.
    assert [p["name"] for p in body["day_trips"]] == ["Ranthambore National Park"]
    assert [p["name"] for p in body["famous_stays"]] == ["Rambagh Palace"]
    assert body["famous_stays"][0]["category"] == "Hotel" and body["around_from"] == "the city centre"
    assert body["around_source"] == "Wikidata and Wikipedia" and body["around_notice"] is None
