"""Official Indian Railways fares (app/rail_fares.py) from the Railway Board fare table (CC 24/2025)
and the Ministry of Railways timetable distances, and their place in train search results."""
from app import ground
from app.rail_fares import basic_fare, class_fare, distance_km, official_fares, train_number


def test_basic_fares_are_the_circulars_own_numbers():
    # Spot checks against the scanned tables: Mail/Express non-AC and AC, first and last slabs.
    assert basic_fare("SL", 294) == 190 and basic_fare("2S", 3) == 31 and basic_fare("FC", 400) == 696
    assert basic_fare("SL", 2290) == 856 and basic_fare("FC", 2440) == 2506 and basic_fare("SL", 5000) == 1427
    assert basic_fare("CC", 150) == 217 and basic_fare("3A", 2163) == 2029 and basic_fare("1A", 300) == 1071
    # Beyond 5,000 km: the 5,000 km fare plus a fixed amount per 50 km slab.
    assert basic_fare("SL", 5051) == 1427 + 2 * 14


def test_a_class_fare_adds_the_charges_and_gst_and_is_rounded_up_to_five():
    # Sleeper, 294 km, not superfast: basic 190 + reservation 20.
    assert class_fare("SL", 294, superfast=False) == 210
    # AC 3-tier is charged for at least 300 km: 452 + 40, plus 5% GST = 516.6 -> 520.
    assert class_fare("3A", 100, superfast=False) == 520
    # Superfast adds its charge: 2163 km 3A = (2029 + 40 + 45) * 1.05 = 2219.7 -> 2220.
    assert class_fare("3A", 2163, superfast=True) == 2220


def test_the_distance_is_this_trains_own_between_its_stations():
    assert train_number("12414 Galta Dham Pooja SF Express") == "12414" and train_number("FlixBus") is None
    assert distance_km("15014", "DEC", "JP") == 294
    assert distance_km("15014", "JP", "DEC") is None  # not its direction of travel
    assert distance_km("15014", "DEC", "ZZZZ") is None


def test_official_fares_for_an_ordinary_train():
    found = official_fares("15014 Ranikhet Express", "DEC", "JP")
    assert found["distance_km"] == 294 and found["superfast"] is False
    assert found["fares"]["SL"] == 210 and found["fares"]["3A"] == 520
    assert "CC 24/2025" in found["source"]
    assert official_fares("12414 Galta Dham Pooja SF Express", "DEC", "JP")["superfast"] is True


def test_trains_with_their_own_tariff_or_missing_data_get_no_fare():
    assert official_fares("12015 Daurai Shatabdi Express", "DEC", "JP")["fares"] is None
    assert "own tariff" in official_fares("22436 Vande Bharat Express", "NDLS", "BSB")["reason"]
    assert "official timetable" in official_fares("19702 Sainik Express", "DEC", "DKBJ")["reason"]
    assert official_fares("04050 Holi Special", "NDLS", "JP")["fares"] is None  # specials: 0 series


def route(service, frm, to, changes=0, fare=None, kind="train"):
    return {"kind": kind, "service": service, "from": {"name": frm, "code": frm}, "to": {"name": to, "code": to},
            "changes": changes, "fare": fare, "currency": "INR" if fare else None, "fare_label": "Not available"}


def test_search_results_get_the_official_fare_only_for_a_single_indian_train():
    priced = ground.with_official_fares(route("15014 Ranikhet Express", "DEC", "JP"), "IN")
    assert priced["fare"] == 210 and priced["fare_class"] == "SL" and priced["class_fares"]["2A"] > priced["class_fares"]["3A"]
    assert priced["fare_label"] == "Sleeper: official fare for 294 km"
    google = ground.with_official_fares(route("15014 Ranikhet Express", "DEC", "JP", fare=273.0), "IN")
    assert google["fare"] == 273.0 and google["class_fares"]["SL"] == 210  # Google's own fare is kept
    assert ground.with_official_fares(route("15014 Ranikhet Express", "DEC", "JP", changes=1), "IN")["fare"] is None
    assert ground.with_official_fares(route("15014 Ranikhet Express", "DEC", "JP"), "GB")["fare"] is None
    assert ground.with_official_fares(route("FlixBus", "DEC", "JP", kind="bus"), "IN")["fare"] is None
    shatabdi = ground.with_official_fares(route("12015 Daurai Shatabdi Express", "DEC", "JP"), "IN")
    assert shatabdi["fare"] is None and "own tariff" in shatabdi["class_fares_note"]
