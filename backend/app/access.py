"""Door-to-door routes between two trip ends, for each way of travel.

A town without an airport or a railway station of its own is still reachable: fly to its nearest
airport and take a bus or cab for the last stretch, or take a train to a nearby station and do
the same, or take a bus straight to its bus stand. This lays those routes out from the bundled
place data (travel_data.PLACES: every Indian city and town with its nearest airport, railway
station and bus station), so it is instant and costs no searches; the live schedules for each
leg are searched when the trip is optimized or on its Transport tab.

Distances are straight-line kilometres between map points, labelled as such, never a road
distance or a travel time.
"""
import math

from app.travel_data import AIRPORTS, INDIA_PLACES, PLACES

STATION_KM = 60  # nearby stations offered for a train route
MAX_STATIONS = 3
LAST_LEG_KM = 3  # closer than this, the station or airport is in the town itself


def km(a: dict, b: dict) -> int:
    p = math.pi / 180
    la1, lo1, la2, lo2 = a["latitude"], a["longitude"], b["latitude"], b["longitude"]
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return round(12742 * math.asin(math.sqrt(h)))


def town(code: str) -> dict | None:
    """The Indian town for a trip end: the place itself, or for an Indian airport the biggest town it serves."""
    if code in INDIA_PLACES:
        return INDIA_PLACES[code]
    airport = AIRPORTS.get(code)
    if not airport or airport["country"] != "IN":
        return None
    served = [p for p in INDIA_PLACES.values() if p["airport_code"] == code and "flight" in p["serves"]]
    return max(served, key=lambda p: p["population"], default=None)


def stations(place: dict) -> list[dict]:
    """Railway stations a traveller could use for `place`: its own, the nearest ones, and the
    biggest town's within STATION_KM (e.g. Mydukuru: Kamalapuram, then Kadapa)."""
    if "train" in place["serves"] and place.get("station"):
        own = place["station"]
        return [{"name": own["name"], "code": own["code"], "town": place["city"], "km": own["km"]}]
    near = []
    for p in INDIA_PLACES.values():
        if "train" not in p["serves"] or not p.get("station") or p["code"] == place["code"]:
            continue
        if abs(p["latitude"] - place["latitude"]) > 0.6 or abs(p["longitude"] - place["longitude"]) > 0.6:
            continue
        d = km(place, p)
        if d <= STATION_KM:
            near.append((d, p))
    near.sort(key=lambda x: x[0])
    picked = near[:MAX_STATIONS - 1]
    biggest = max(near, key=lambda x: x[1]["population"], default=None)
    if biggest and biggest not in picked:
        picked.append(biggest)
    seen, out = set(), []
    for d, p in sorted(picked, key=lambda x: x[0]):
        key = p["station"]["code"] or p["station"]["name"]
        if key not in seen:
            seen.add(key)
            out.append({"name": p["station"]["name"], "code": p["station"]["code"], "town": p["city"], "km": d})
    return out


def _end(code: str) -> dict:
    p = PLACES[code]
    return {"code": code, "name": p["city"], "state": p.get("state"), "kind": p["kind"]}


def _last(frm: str, to: str, distance: int) -> dict:
    return {"mode": "road", "from": frm, "to": to, "km": distance, "note": "Bus or cab"}


def plan(origin: str, destination: str) -> dict:
    """Routes from `origin` to `destination` (airport or place codes), one per way of travel."""
    start, end = PLACES[origin], PLACES[destination]
    a, b = town(origin), town(destination)
    routes = []

    # Flight: to the destination's airport (its own, or the nearest), with the stretches by road.
    fly_from, fly_to = start["airport_code"], end["airport_code"]
    if fly_from and fly_to and fly_from != fly_to:
        legs = []
        if start["kind"] == "place" and start["airport_km"] > LAST_LEG_KM:
            legs.append(_last(start["city"], f"{AIRPORTS[fly_from]['city']} airport ({fly_from})", start["airport_km"]))
        legs.append({"mode": "flight", "from": f"{AIRPORTS[fly_from]['city']} ({fly_from})",
                     "to": f"{AIRPORTS[fly_to]['city']} ({fly_to})", "airport": AIRPORTS[fly_to]["airport"]})
        if end["kind"] == "place" and end["airport_km"] > LAST_LEG_KM:
            legs.append(_last(f"{AIRPORTS[fly_to]['city']} airport", end["city"], end["airport_km"]))
            title = f"Fly to {AIRPORTS[fly_to]['city']} ({fly_to}), then bus or cab {end['airport_km']} km to {end['city']}"
        else:
            title = f"Fly to {AIRPORTS[fly_to]['city']} ({fly_to})"
        routes.append({"mode": "flight", "title": title, "legs": legs, "own": "flight" in end["serves"]})

    # Train: from the origin's station to a station near the destination, then by road.
    if a and b:
        here, there = stations(a), stations(b)
        if here and there and here[0]["code"] != there[0]["code"]:
            first = there[0]
            legs = []
            if here[0]["km"] > LAST_LEG_KM:
                legs.append(_last(a["city"], f"{here[0]['name']} station", here[0]["km"]))
            legs += [{"mode": "train", "from": f"{here[0]['name']}" + (f" ({here[0]['code']})" if here[0]["code"] else ""),
                     "to": f"{first['name']}" + (f" ({first['code']})" if first["code"] else "")}]
            if first["km"] > LAST_LEG_KM:
                legs.append(_last(f"{first['name']} station", b["city"], first["km"]))
                title = f"Train to {first['name']}, then bus or cab {first['km']} km to {b['city']}"
            else:
                title = f"Train to {first['name']}"
            routes.append({"mode": "train", "title": title, "legs": legs, "own": "train" in b["serves"],
                           "stations": there})

    # Bus: straight to the destination's bus stand, or to the nearest one and then by road.
    if b and b.get("bus_station"):
        stand = b["bus_station"]
        legs = [{"mode": "bus", "from": a["city"] if a else start["city"], "to": stand["name"]}]
        if stand["km"] > LAST_LEG_KM:
            legs.append(_last(stand["name"], b["city"], stand["km"]))
            title = f"Bus to {stand['name']}, then {stand['km']} km to {b['city']}"
        else:
            title = f"Direct bus to {b['city']} ({stand['name']})"
        routes.append({"mode": "bus", "title": title, "legs": legs, "own": "bus" in b["serves"]})

    return {"origin": _end(origin), "destination": _end(destination), "routes": routes,
            "note": "Distances are straight-line km between map points. Live times and fares for each leg are "
                    "searched when the trip is optimized and on its Transport tab.",
            "source": "OpenStreetMap contributors (ODbL); airports: OurAirports"}
