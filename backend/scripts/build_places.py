"""Build app/data/places_in.json: every Indian city and town, and how to reach it.

Source: OpenStreetMap (https://www.openstreetmap.org/copyright), ODbL, through the Overpass API.
From backend/:

    python scripts/build_places.py                 # downloads into overpass.json, then builds
    python scripts/build_places.py overpass.json   # builds from an earlier download

One query walks India's states and union territories (admin_level 4) and returns, for each, its
cities and towns (place=city|town), railway stations (railway=station) and bus stations
(amenity=bus_station). Every city and town is kept, with its nearest airport, railway station
and bus station (name and distance), so a trip can go anywhere and still show how to get close.
A place counts as served by:

- air when an Indian airport from airports.json is within AIR_KM (towns) or AIR_CITY_KM
  (cities, whose airports often sit far out, like Bengaluru's);
- rail when a railway station is within RAIL_KM of it (towns) or twice that (cities);
- bus when a bus station is within BUS_KM of it, again doubled for cities.

A railway or bus station with no city or town near it becomes a place of its own, named after
the station without "Junction", "Bus Stand" and the like, so a trip can go to a pilgrimage stop
or a village such as Hampi too.

Each place's code is a lowercase slug of its English name ("ayodhya"); when two places share a
name, the state's short name is added ("rampur-up"). Airport codes stay upper case (e.g. "BLR"),
so the two can never collide.
"""
import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "app" / "data"
OUT = DATA / "places_in.json"
OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = """[out:json][timeout:900];
area["ISO3166-1"="IN"][admin_level=2]->.in;
rel["admin_level"="4"]["boundary"="administrative"](area.in)->.states;
foreach.states->.s(
  .s out tags;
  .s map_to_area->.a;
  node["place"~"^(city|town)$"](area.a); out;
  node["railway"="station"](area.a); out;
  nwr["amenity"="bus_station"](area.a); out center;
);"""

RAIL_KM, BUS_KM, AIR_KM, AIR_CITY_KM = 5, 6, 20, 45
NEAR_KM = 60  # nearest station and bus station are listed up to this far; the nearest airport at any distance
# Words dropped from a station's name when it becomes a place of its own.
STATION_WORDS = re.compile(
    r"\b(junction|jn|railway station|station|halt|road|cantt|cantonment|terminus|terminal|bus stand|"
    r"bus station|bus stop|bus depot|bus terminal|ksrtc|msrtc|tnstc|apsrtc|tsrtc|upsrtc|new|old|central|dham)\b\.?",
    re.I,
)
STATE_SHORT = {
    "Andaman and Nicobar Islands": "an", "Andhra Pradesh": "ap", "Arunachal Pradesh": "ar", "Assam": "as",
    "Bihar": "br", "Chandigarh": "ch", "Chhattisgarh": "cg", "Dadra and Nagar Haveli and Daman and Diu": "dd",
    "Delhi": "dl", "Goa": "ga", "Gujarat": "gj", "Haryana": "hr", "Himachal Pradesh": "hp",
    "Jammu and Kashmir": "jk", "Jharkhand": "jh", "Karnataka": "ka", "Kerala": "kl", "Ladakh": "la",
    "Lakshadweep": "ld", "Madhya Pradesh": "mp", "Maharashtra": "mh", "Manipur": "mn", "Meghalaya": "ml",
    "Mizoram": "mz", "Nagaland": "nl", "Odisha": "od", "Puducherry": "py", "Punjab": "pb", "Rajasthan": "rj",
    "Sikkim": "sk", "Tamil Nadu": "tn", "Telangana": "ts", "Tripura": "tr", "Uttar Pradesh": "up",
    "Uttarakhand": "uk", "West Bengal": "wb",
}


# Metro, monorail and tram stops are tagged railway=station too; only Indian Railways stations count.
METRO = {"subway", "light_rail", "monorail", "tram"}
MAIN_STATION = re.compile(r"(junction|jn|terminus|central|cantt)", re.I)


def km(a, b) -> float:
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def english(tags: dict) -> str | None:
    for key in ("name", "name:en", "int_name"):
        name = (tags.get(key) or "").strip()
        if name and name.isascii():
            return name
    return None


def aliases(tags: dict, name: str) -> list[str]:
    """Other English names a traveller may type: Bangalore for Bengaluru, Faizabad and so on."""
    out = []
    for key in ("name:en", "old_name:en", "old_name", "alt_name:en", "alt_name", "official_name:en"):
        for v in (tags.get(key) or "").split(";"):
            v = v.strip()
            if v and v.isascii() and v.lower() != name.lower() and v not in out:
                out.append(v)
    return out[:4]


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def state_name(tags: dict) -> str:
    name = tags.get("name:en") or tags.get("name") or ""
    return re.sub(r"^(State of|Union Territory of|National Capital Territory of)\s+", "", name).strip()


def download(path: Path) -> None:
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": "ai-trip-optimizer-build/1.0"})
    with urllib.request.urlopen(req, timeout=1000) as r:
        path.write_bytes(r.read())


def near(point, items, radius) -> tuple[float, dict] | None:
    """The closest of `items` within `radius` km of `point`, with its distance."""
    best = None
    for it in items:
        if abs(it["lat"] - point[0]) * 111 > radius or abs(it["lng"] - point[1]) * 100 > radius:
            continue
        d = km(point, (it["lat"], it["lng"]))
        if d <= radius and (best is None or d < best[0]):
            best = (d, it)
    return best


def main_station(point, stations, radius, names=()) -> tuple[float, dict] | None:
    """The station a traveller would use: one named after the town, or a junction or terminus,
    beats a nearer halt ("New Delhi" over "Shivaji Bridge", "Ayodhya Dham Junction" over a halt)."""
    names = [n.lower() for n in names]
    best = None
    for st in stations:
        if abs(st["lat"] - point[0]) * 111 > radius or abs(st["lng"] - point[1]) * 100 > radius:
            continue
        d = km(point, (st["lat"], st["lng"]))
        if d > radius:
            continue
        name = st["name"].lower()
        score = (d + 1) * (0.3 if MAIN_STATION.search(name) else 1) * (2 if "halt" in name else 1)
        score *= 0.25 if any(n in name for n in names) else 1
        if best is None or score < best[0]:
            best = (score, d, st)
    return (best[1], best[2]) if best else None


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("overpass.json")
    if not src.exists():
        download(src)
    elements = json.loads(src.read_text(encoding="utf-8"))["elements"]

    towns, stations, buses, state = [], [], [], ""
    for e in elements:
        tags = e.get("tags", {})
        if e["type"] == "relation" and "center" not in e:
            state = state_name(tags)
            continue
        lat = e.get("lat", e.get("center", {}).get("lat"))
        lng = e.get("lon", e.get("center", {}).get("lon"))
        name = english(tags)
        if lat is None or not name:
            continue
        row = {"name": name, "state": state, "lat": round(lat, 4), "lng": round(lng, 4)}
        if tags.get("place") in ("city", "town"):
            pop = tags.get("population", "").replace(",", "")
            towns.append({**row, "city": tags["place"] == "city", "pop": int(pop) if pop.isdigit() else 0,
                          "aka": aliases(tags, name)})
        elif tags.get("railway") == "station" and tags.get("station") not in METRO and tags.get("subway") != "yes":
            stations.append({**row, "ref": tags.get("ref") or tags.get("railway:ref") or ""})
        elif tags.get("amenity") == "bus_station":
            buses.append(row)

    airports = json.loads((DATA / "airports.json").read_text(encoding="utf-8"))["airports"]
    indian = [{"code": c, "lat": a[3], "lng": a[4]} for c, a in airports.items() if a[1] == "IN"]

    def describe(p: dict) -> dict:
        here, k = (p["lat"], p["lng"]), 2 if p["city"] else 1
        own_air = near(here, indian, AIR_CITY_KM if p["city"] else AIR_KM)
        airport = own_air or near(here, indian, 5000)
        station = main_station(here, stations, RAIL_KM * k * 2, [p["name"], *p["aka"]]) or near(here, stations, NEAR_KM)
        bus = near(here, buses, NEAR_KM)
        return {
            **p,
            "air": bool(own_air),
            "rail": bool(station and station[0] <= RAIL_KM * k),
            "bus": bool(bus and bus[0] <= BUS_KM * k),
            "airport": [airport[1]["code"], round(airport[0])],
            "station": [station[1]["name"], station[1]["ref"], round(station[0])] if station else None,
            "busstop": [bus[1]["name"], round(bus[0])] if bus else None,
        }

    places = [describe(t) for t in towns]
    # Stations and bus stations far from every town become places of their own.
    for items in (stations, buses):
        for s in items:
            if near((s["lat"], s["lng"]), towns, 4):
                continue
            name = re.sub(r"\s+", " ", STATION_WORDS.sub("", s["name"])).strip(" -,") or s["name"]
            places.append(describe({**s, "name": name, "city": False, "pop": 0, "aka": []}))

    # Same name and state twice (OSM duplicates, or a station next to another): keep the larger one.
    seen: dict[tuple, dict] = {}
    for p in sorted(places, key=lambda p: (-p["city"], -p["pop"], -(p["air"] + p["rail"] + p["bus"]))):
        seen.setdefault((p["name"].lower(), p["state"]), p)
    places = list(seen.values())

    counts: dict[str, int] = {}
    for p in places:
        counts[slug(p["name"])] = counts.get(slug(p["name"]), 0) + 1
    out, codes = {}, set()
    for p in sorted(places, key=lambda p: (-p["city"], -p["pop"], p["name"])):
        base = slug(p["name"]) or "place"
        short = STATE_SHORT.get(p["state"], "in")
        code, n = (base if counts[base] == 1 else f"{base}-{short}"), 2
        while code in codes:
            code, n = f"{base}-{short}{n}", n + 1
        codes.add(code)
        flags = (1 if p["air"] else 0) | (2 if p["rail"] else 0) | (4 if p["bus"] else 0)
        out[code] = [p["name"], p["state"], p["lat"], p["lng"], flags, p["pop"],
                     p["airport"], p["station"], p["busstop"], p["aka"]]

    OUT.write_text(json.dumps({
        "source": "OpenStreetMap contributors (https://www.openstreetmap.org/copyright), ODbL",
        "built": date.today().isoformat(),
        "fields": ["name", "state", "latitude", "longitude", "served by (1 air, 2 rail, 4 bus)", "population",
                   "nearest airport [code, km]", "nearest railway station [name, code, km]",
                   "nearest bus station [name, km]", "other names"],
        "places": out,
    }, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    count = lambda bit: sum(1 for v in out.values() if v[4] & bit)  # noqa: E731
    print(f"{len(out)} places: {count(1)} with an airport, {count(2)} with a railway station, "
          f"{count(4)} with a bus station")


if __name__ == "__main__":
    main()
