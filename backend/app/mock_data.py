"""Loads the mock flight/hotel data described in docs/09_Mock_Data_Spec.md.

There's no `flights`/`hotels` table in the database (see docs/06_Database_Design.md) —
this data is deliberately static JSON, read straight off disk. The Week 5-6 LangGraph
`search_node` (docs/08_GenAI_Architecture.md) is the real consumer of these functions.
"""
import json
from functools import lru_cache
from pathlib import Path

# backend/app/mock_data.py -> repo root -> data/
DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@lru_cache
def load_flights() -> list[dict]:
    with open(DATA_DIR / "mock_flights.json", encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def load_hotels() -> list[dict]:
    with open(DATA_DIR / "mock_hotels.json", encoding="utf-8") as f:
        return json.load(f)


def flights_for_route(origin: str, destination: str) -> list[dict]:
    return [f for f in load_flights() if f["origin"] == origin and f["destination"] == destination]


def hotels_for_city(city: str) -> list[dict]:
    return [h for h in load_hotels() if h["city"] == city]
