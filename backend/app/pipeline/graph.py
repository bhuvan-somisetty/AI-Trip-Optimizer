"""The LangGraph optimization pipeline: search -> check -> compose.

Described in docs/08_GenAI_Architecture.md. search_node and check_node are plain
Python; compose_node is the only step that calls the LLM.
"""
import json
import logging
import re

from langgraph.graph import END, START, StateGraph

from app import config, live_data
from app.mock_data import flights_for_route, hotels_for_city
from app.pipeline.state import PipelineState

logger = logging.getLogger(__name__)


def search_node(state: PipelineState) -> dict:
    # Pure lookup, no LLM: every option the later nodes see comes straight from the data source.
    request = state["request"]
    if config.DATA_SOURCE == "live":
        return live_search(request)
    departure_day = request["start_date"].isoformat()
    flights = [
        f
        for f in flights_for_route(request["origin"], request["destination"])
        if f["departure_time"].startswith(departure_day)
    ]
    hotels = hotels_for_city(request["destination"])
    return {"flight_options": flights, "hotel_options": hotels}


def live_search(request) -> dict:
    # Live prices come from Google Flights / Google Hotels via SerpApi's MCP server. A failed
    # search fails the run with the reason, rather than quietly using sample data instead.
    try:
        flights = live_data.flights_for_trip(
            request["origin"],
            request["destination"],
            request["start_date"],
            request["preferences"].get("cabin_class"),
        )
        hotels = []
        if request["end_date"] > request["start_date"]:  # a same-day trip needs no hotel
            hotels = live_data.hotels_for_trip(request["destination"], request["start_date"], request["end_date"])
    except live_data.LiveSearchError as e:
        return {"flight_options": [], "hotel_options": [], "search_error": f"Live search failed: {e}"}
    return {"flight_options": flights, "hotel_options": hotels}


def flight_rule_broken(flight: dict, preferences: dict) -> tuple[str, str] | None:
    cabin = preferences.get("cabin_class")
    if cabin and flight["cabin_class"] != cabin:
        return "cabin_class", f"{flight['id']} is {flight['cabin_class']}, trip asks for {cabin}"
    max_stops = preferences.get("max_stops")
    if max_stops is not None and flight["stops"] > max_stops:
        return "max_stops", f"{flight['id']} has {flight['stops']} stop(s), trip allows {max_stops}"
    return None


def hotel_rule_broken(hotel: dict, preferences: dict) -> tuple[str, str] | None:
    min_rating = preferences.get("min_hotel_rating")
    if min_rating is not None and hotel["rating"] < min_rating:
        return "min_hotel_rating", f"{hotel['id']} is rated {hotel['rating']}, trip needs at least {min_rating}"
    return None


def screen(options: list[dict], rule_broken, preferences: dict, rejected: list) -> list[dict]:
    passing = []
    for option in options:
        broken = rule_broken(option, preferences)
        if broken is None:
            passing.append(option)
        else:
            rejected.append({"option_id": option["id"], "rule": broken[0], "detail": broken[1]})
    return passing


def check_node(state: PipelineState) -> dict:
    # Pure Python, no LLM: picks the cheapest option that passes every rule and does
    # the money maths here, so the budget verdict is reproducible.
    request = state["request"]
    preferences = request["preferences"]
    nights = (request["end_date"] - request["start_date"]).days
    route = f"{request['origin']} to {request['destination']} on {request['start_date'].isoformat()}"
    flags: list[str] = [state["search_error"]] if state.get("search_error") else []
    rejected: list = []

    flights = screen(state["flight_options"], flight_rule_broken, preferences, rejected)
    flight = min(flights, key=lambda f: f["price"], default=None)
    if not state["flight_options"]:
        flags.append(f"No flights found from {route}")
    elif flight is None:
        flags.append(f"No flight from {route} meets the trip's preferences")

    hotel = None
    if nights > 0:
        hotels = screen(state["hotel_options"], hotel_rule_broken, preferences, rejected)
        hotel = min(hotels, key=lambda h: h["price_per_night"], default=None)
        if not state["hotel_options"]:
            flags.append(f"No hotels found in {request['destination']}")
        elif hotel is None:
            flags.append(f"No hotel in {request['destination']} meets the trip's preferences")

    flight_cost = flight["price"] if flight else 0
    hotel_cost = hotel["price_per_night"] * nights if hotel else 0
    total_cost = float(flight_cost + hotel_cost)
    within_budget = total_cost <= request["budget"]
    if not within_budget:
        items = []
        if flight:
            items.append(f"flight {flight['id']} {flight_cost:,}")
        if hotel:
            items.append(f"hotel {hotel['id']} {nights} night(s) {hotel_cost:,}")
        flags.append(
            f"Total {total_cost:,.0f} is {total_cost - request['budget']:,.0f} over the "
            f"{request['budget']:,.0f} budget ({' + '.join(items)})"
        )

    return {
        "check": {
            "flight": flight,
            "hotel": hotel,
            "nights": nights,
            "total_cost": total_cost,
            "within_budget": within_budget,
            "flags": flags,
            "rejected": rejected,
        }
    }


def flight_label(flight: dict) -> str:
    return f"{flight['id']} {flight['airline']} {flight['cabin_class']}, {flight['stops']} stop(s)"


def hotel_label(hotel: dict) -> str:
    return f"{hotel['id']} {hotel['name']}, rated {hotel['rating']}"


def ledger_entries(kind, options, chosen, price_of, label, rejected_by_id) -> list[dict]:
    # Every option search_node found gets one row: the winner, or why it lost.
    # `kind` ("flight" or "stay") lets clients group rows without parsing option ids.
    entries = []
    for option in sorted(options, key=price_of):
        price = float(price_of(option))
        if chosen and option["id"] == chosen["id"]:
            reason = "Cheapest option that meets every trip preference"
        elif option["id"] in rejected_by_id:
            rejection = rejected_by_id[option["id"]]
            reason = f"Preference {rejection['rule']}: {rejection['detail']}"
        else:
            reason = f"Price: {price - price_of(chosen):,.0f} more than {chosen['id']}"
        entries.append({"kind": kind, "alternative": label(option), "price": price, "won": option is chosen, "reason": reason})
    return entries


def build_ledger(state: PipelineState) -> list[dict]:
    check = state["check"]
    nights = check["nights"]
    rejected_by_id = {r["option_id"]: r for r in check["rejected"]}
    ledger = ledger_entries(
        "flight",
        state["flight_options"], check["flight"], lambda f: f["price"], flight_label, rejected_by_id
    )
    if nights > 0:
        ledger += ledger_entries(
            "stay",
            state["hotel_options"],
            check["hotel"],
            lambda h: h["price_per_night"] * nights,
            hotel_label,
            rejected_by_id,
        )
    return ledger


# check_node's selection rule, stated once so the rationale can explain the choice.
WHY_CHOSEN = "cheapest option that meets every trip preference"


def rationale_facts(state: PipelineState) -> dict:
    # The only numbers the rationale may use; all of them were computed in code.
    request = state["request"]
    check = state["check"]
    hotel = check["hotel"]
    return {
        "route": f"{request['origin']} to {request['destination']}",
        "dates": f"{request['start_date'].isoformat()} to {request['end_date'].isoformat()}",
        "budget": request["budget"],
        "flight": {
            "option": flight_label(check["flight"]),
            "price": check["flight"]["price"],
            "why_chosen": WHY_CHOSEN,
            "options_compared": len(state["flight_options"]),
        },
        "hotel": None
        if hotel is None
        else {
            "option": hotel_label(hotel),
            "price_per_night": hotel["price_per_night"],
            "nights": check["nights"],
            "stay_cost": hotel["price_per_night"] * check["nights"],
            "why_chosen": WHY_CHOSEN,
            "options_compared": len(state["hotel_options"]),
        },
        "total_cost": check["total_cost"],
        "within_budget": check["within_budget"],
        "difference_from_budget": abs(request["budget"] - check["total_cost"]),
        "flags": check["flags"],
        "options_ruled_out": [r["detail"] for r in check["rejected"]],
    }


def template_rationale(facts: dict) -> str:
    parts = [f"Chose flight {facts['flight']['option']} at {facts['flight']['price']:,.0f}"]
    if facts["hotel"]:
        hotel = facts["hotel"]
        parts.append(
            f"and hotel {hotel['option']} at {hotel['price_per_night']:,.0f} a night for "
            f"{hotel['nights']} night(s) ({hotel['stay_cost']:,.0f})"
        )
    text = " ".join(parts) + f", the cheapest options that meet every trip preference. "
    text += f"Total cost is {facts['total_cost']:,.0f} against a budget of {facts['budget']:,.0f}, "
    if facts["within_budget"]:
        text += f"leaving {facts['difference_from_budget']:,.0f} unspent."
    else:
        text += f"which is {facts['difference_from_budget']:,.0f} over budget."
    if facts["options_ruled_out"]:
        text += f" {len(facts['options_ruled_out'])} option(s) were ruled out by trip preferences."
    return text


RATIONALE_PROMPT = """You explain a business trip itinerary to the manager who will approve it.
Write 3 to 5 short sentences in plain, natural English: which flight and hotel were chosen and why
(use why_chosen and options_compared), the total cost against the budget, and any flags or options
ruled out. Write like a helpful colleague, not a report: never mention field names such as
price_per_night or within_budget, never say true or false, and skip anything that is empty.

Use ONLY the facts below. Never introduce, round, convert or calculate a number that is not written
in the facts. No currency symbols, no markdown.

Facts:
{facts}"""


def numbers_in(text: str) -> set[float]:
    return {float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text)}


def get_llm():
    if not config.OPENAI_API_KEY:
        return None
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=config.OPENAI_MODEL,
        api_key=config.OPENAI_API_KEY,
        base_url=config.OPENAI_BASE_URL,
        temperature=0,
        timeout=20,
        # One retry rides out a brief 503; more would burn the free tier's small daily quota.
        max_retries=1,
    )


def compose_node(state: PipelineState) -> dict:
    # The only LLM call in the pipeline, and it only writes prose: the choice, the total
    # and the Trade-off Ledger all come from check_node's numbers.
    check = state["check"]
    if check["flight"] is None or (check["nights"] > 0 and check["hotel"] is None):
        return {"failure_reason": "; ".join(check["flags"]) or "No itinerary could be built"}

    facts = rationale_facts(state)
    llm = get_llm()
    rationale = None
    if llm is not None:
        facts_text = json.dumps(facts, indent=2)
        try:
            rationale = llm.invoke(RATIONALE_PROMPT.format(facts=facts_text)).content.strip() or None
        except Exception:
            # A busy or rate-limited LLM shouldn't fail a trip whose choices are already made.
            logger.warning("Rationale LLM call failed, using the template rationale", exc_info=True)
        if rationale is not None:
            # Guardrail (docs/08_GenAI_Architecture.md): every number in the prose must
            # already be in the facts, otherwise the run fails instead of showing it.
            invented = numbers_in(rationale) - numbers_in(facts_text)
            if invented:
                listed = ", ".join(f"{n:g}" for n in sorted(invented))
                return {"failure_reason": f"Rationale used numbers not in the itinerary: {listed}"}
    if rationale is None:
        rationale = template_rationale(facts)

    return {
        "itinerary": {
            "flight": check["flight"],
            "hotel": check["hotel"],
            "total_cost": check["total_cost"],
            "rationale": rationale,
            "tradeoff_ledger": build_ledger(state),
        }
    }


def build_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("search", search_node)
    graph.add_node("check", check_node)
    graph.add_node("compose", compose_node)
    graph.add_edge(START, "search")
    graph.add_edge("search", "check")
    graph.add_edge("check", "compose")
    graph.add_edge("compose", END)
    return graph.compile()


pipeline = build_graph()
