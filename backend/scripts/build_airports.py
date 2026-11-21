"""Build app/data/airports.json: every airport with scheduled flights and an IATA code.

Source: OurAirports (https://ourairports.com/data/), public domain. Download the two files
and run, from backend/:

    curl -LO https://davidmegginson.github.io/ourairports-data/airports.csv
    curl -LO https://davidmegginson.github.io/ourairports-data/countries.csv
    pip install timezonefinder        # build-time only, not needed by the app
    python scripts/build_airports.py airports.csv countries.csv

Only airports with `scheduled_service = yes` and an IATA code are kept (about 4,000). The city
is OurAirports' `municipality`, with any note in brackets removed ("Paris (Roissy-en-France)"
-> "Paris"); travel_data.CITY_NAMES then renames the few where the airport's town is not the
city a traveller means (Goa's airport is in Vasco da Gama, Tokyo's in Narita).

Each airport's time zone (e.g. "Asia/Kolkata") is looked up from its coordinates with
timezonefinder (MIT, boundaries from timezone-boundary-builder, ODbL), so a train or bus search
can start at a local time of day anywhere in the world.
"""
import csv
import json
import re
import sys
from datetime import date
from pathlib import Path

from timezonefinder import TimezoneFinder

OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "airports.json"
SIZES = {"large_airport": 3, "medium_airport": 2, "small_airport": 1}


def city_of(row: dict) -> str:
    town = re.sub(r"\s*\(.*?\)\s*", " ", row["municipality"] or "").strip()
    return town.split(",")[0].strip() or row["name"]


def build(airports_csv: str, countries_csv: str) -> dict:
    with open(countries_csv, encoding="utf-8") as f:
        countries = {r["code"]: r["name"] for r in csv.DictReader(f)}
    airports = {}
    zones = TimezoneFinder()
    with open(airports_csv, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = (row["iata_code"] or "").strip().upper()
            if not re.fullmatch(r"[A-Z]{3}", code) or row["scheduled_service"] != "yes":
                continue
            if row["type"] not in SIZES:
                continue
            size = SIZES[row["type"]]
            if code in airports and airports[code][5] >= size:
                continue  # a code listed twice: keep the bigger airport
            lat, lon = float(row["latitude_deg"]), float(row["longitude_deg"])
            airports[code] = [
                city_of(row),
                row["iso_country"],
                row["name"],
                round(lat, 4),
                round(lon, 4),
                size,
                zones.timezone_at(lat=lat, lng=lon) or zones.closest_timezone_at(lat=lat, lng=lon),
            ]
    used = {a[1] for a in airports.values()}
    return {
        "source": "OurAirports (https://ourairports.com/data/), public domain",
        "built": date.today().isoformat(),
        "fields": ["city", "country", "airport", "latitude", "longitude", "size (3 large, 2 medium, 1 small)",
                   "time zone"],
        "countries": {c: countries.get(c, c) for c in sorted(used)},
        "airports": dict(sorted(airports.items())),
    }


if __name__ == "__main__":
    data = build(sys.argv[1], sys.argv[2])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(data['airports'])} airports in {len(data['countries'])} countries -> {OUT}")
