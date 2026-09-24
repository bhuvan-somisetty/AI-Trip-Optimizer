"""Validates data/mock_flights.json and data/mock_hotels.json against docs/09_Mock_Data_Spec.md.

There's no `flights`/`hotels` database table to seed (see docs/06_Database_Design.md) —
the mock data is read straight from these JSON files by app/mock_data.py, which is what
the Week 5-6 search_node will actually import. This script exists so a typo or a missing
field is caught now, in Week 3, instead of surfacing as a confusing bug once the pipeline
is built and depending on it.

Run from backend/: python scripts/seed_mock_data.py
"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.mock_data import load_flights, load_hotels  # noqa: E402

REQUIRED_FLIGHT_FIELDS = {
    "id": str, "origin": str, "destination": str, "departure_time": str,
    "arrival_time": str, "airline": str, "price": (int, float), "cabin_class": str, "stops": int,
}
REQUIRED_HOTEL_FIELDS = {
    "id": str, "city": str, "name": str, "price_per_night": (int, float),
    "rating": (int, float), "amenities": list, "distance_to_center_km": (int, float),
}


def validate(records: list[dict], required_fields: dict, label: str) -> list[str]:
    errors = []
    seen_ids = set()
    for i, record in enumerate(records):
        for field, expected_type in required_fields.items():
            if field not in record:
                errors.append(f"{label}[{i}] missing field '{field}'")
            elif not isinstance(record[field], expected_type):
                errors.append(f"{label}[{i}] field '{field}' has type {type(record[field]).__name__}, expected {expected_type}")
        if "id" in record:
            if record["id"] in seen_ids:
                errors.append(f"{label}[{i}] duplicate id '{record['id']}'")
            seen_ids.add(record["id"])
        if record.get("price", record.get("price_per_night", 1)) <= 0:
            errors.append(f"{label}[{i}] non-positive price")
    return errors


def main() -> int:
    flights = load_flights()
    hotels = load_hotels()

    errors = validate(flights, REQUIRED_FLIGHT_FIELDS, "flights") + validate(hotels, REQUIRED_HOTEL_FIELDS, "hotels")

    routes = Counter((f["origin"], f["destination"]) for f in flights)
    cities = Counter(h["city"] for h in hotels)

    print(f"{len(flights)} flights across {len(routes)} routes")
    for (origin, dest), count in sorted(routes.items()):
        under_covered = " (spec recommends >=3-4)" if count < 3 else ""
        print(f"  {origin} -> {dest}: {count} options{under_covered}")

    print(f"\n{len(hotels)} hotels across {len(cities)} cities")
    for city, count in sorted(cities.items()):
        under_covered = " (spec recommends >=3-4)" if count < 3 else ""
        print(f"  {city}: {count} hotels{under_covered}")

    flight_cities = {c for pair in routes for c in pair}
    hotel_cities = set(cities)
    missing_hotels = flight_cities - hotel_cities
    if missing_hotels:
        errors.append(f"cities reachable by flight but with no hotel data: {sorted(missing_hotels)}")

    if errors:
        print(f"\n{len(errors)} problem(s) found:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("\nAll good - data matches docs/09_Mock_Data_Spec.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
