"""The shared state that flows through the LangGraph optimization pipeline.

Described in docs/08_GenAI_Architecture.md: search_node -> check_node -> compose_node.
Each node reads what earlier nodes wrote and adds its own part, so the state starts
with only `request` filled in and gains a key at every step.
"""
from datetime import date
from typing import TypedDict


class TripRequest(TypedDict):
    origin: str  # airport code, e.g. "BLR" (matches data/mock_flights.json)
    destination: str  # airport/city code, e.g. "DEL"
    start_date: date
    end_date: date
    budget: float
    preferences: dict


class Rejection(TypedDict):
    option_id: str  # e.g. "FL-1003" or "HT-2003"
    rule: str  # the preference it broke, e.g. "max_stops"
    detail: str  # human-readable, names the offending value


class CheckResult(TypedDict):
    flight: dict | None  # cheapest flight that passes every rule, None if none does
    hotel: dict | None  # cheapest hotel that passes every rule, None if none does
    nights: int
    total_cost: float  # computed in code, never by the LLM
    within_budget: bool
    flags: list[str]  # human-readable constraint problems, empty if none
    rejected: list[Rejection]  # every option a rule ruled out, for the Trade-off Ledger


class LedgerEntry(TypedDict):
    alternative: str
    price: float
    won: bool
    reason: str


class Itinerary(TypedDict):
    flight: dict
    hotel: dict | None  # None for a same-day trip (0 nights)
    total_cost: float
    rationale: str
    tradeoff_ledger: list[LedgerEntry]


class PipelineState(TypedDict, total=False):
    request: TripRequest  # set by the caller before the graph runs
    flight_options: list[dict]  # written by search_node
    hotel_options: list[dict]  # written by search_node
    check: CheckResult  # written by check_node
    itinerary: Itinerary  # written by compose_node
    failure_reason: str  # written by compose_node instead of `itinerary` when none can be built
