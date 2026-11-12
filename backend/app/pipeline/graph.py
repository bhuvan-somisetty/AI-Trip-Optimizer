"""The LangGraph optimization pipeline: search -> check -> compose.

Described in docs/08_GenAI_Architecture.md. search_node and check_node are plain
Python; compose_node is the only step that calls the LLM.
"""
import json
import logging
import re
from datetime import date

from langgraph.graph import END, START, StateGraph

from app import config
from app import travel_data
from app.pipeline.state import PipelineState

logger = logging.getLogger(__name__)


def search_node(state: PipelineState) -> dict:
    # Pure lookup, no LLM: every option the later nodes see came from a real provider.
    request = state["request"]
    found: dict = {"flight_options": [], "hotel_options": []}
    try:
        found["flight_options"] = travel_data.search_flights(
            request["origin"],
            request["destination"],
            request["start_date"],
            request["preferences"].get("cabin_class"),
        )
    except travel_data.TravelDataError as e:
        found["search_error"] = str(e)
        return found
    if request["end_date"] > request["start_date"]:
        try:
            found["hotel_options"] = travel_data.search_hotels(
                request["destination"], request["start_date"], request["end_date"]
            )
        except travel_data.HotelsUnavailable as e:
            found["hotels_unavailable"] = str(e)
        except travel_data.TravelDataError as e:
            found["search_error"] = str(e)
    return found


def flight_rule_broken(flight: dict, preferences: dict) -> tuple[str, str] | None:
    cabin = preferences.get("cabin_class")
    if cabin and flight["cabin_class"] != cabin:
        return "cabin_class", f"{flight['id']} is {flight['cabin_class']}, trip asks for {cabin}"
    max_stops = preferences.get("max_stops")
    if max_stops is not None and flight["stops"] > max_stops:
        return "max_stops", f"{flight['id']} has {flight['stops']} stop(s), trip allows {max_stops}"
    return None


def days_off(flight: dict, day) -> int:
    # Search also returns fares from nearby days; 0 means the flight leaves on `day`.
    departure = flight.get("departure_time")
    return (date.fromisoformat(departure[:10]) - day).days if departure else 0


def hotel_rule_broken(hotel: dict, preferences: dict) -> tuple[str, str] | None:
    min_rating = preferences.get("min_hotel_rating")
    if min_rating is not None and hotel["rating"] is None:
        return "min_hotel_rating", f"{hotel['id']} has no guest rating, trip needs at least {min_rating}"
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


def price_check(request: dict, flight: dict | None, hotel: dict | None, nights: int) -> tuple[float, bool, str | None]:
    # Total cost and the budget verdict, with a flag naming each line item when it's over.
    flight_cost = flight["price"] if flight else 0
    hotel_cost = hotel["price_per_night"] * nights if hotel else 0
    total_cost = float(flight_cost + hotel_cost)
    within_budget = total_cost <= request["budget"]
    if within_budget:
        return total_cost, True, None
    items = []
    if flight:
        items.append(f"flight {flight['id']} {flight_cost:,}")
    if hotel:
        items.append(f"hotel {hotel['id']} {nights} night(s) {hotel_cost:,}")
    flag = (
        f"Total {total_cost:,.0f} is {total_cost - request['budget']:,.0f} over the "
        f"{request['budget']:,.0f} budget ({' + '.join(items)})"
    )
    return total_cost, False, flag


def check_node(state: PipelineState) -> dict:
    # Pure Python, no LLM: picks the cheapest option that passes every rule and does
    # the money maths here, so the budget verdict is reproducible.
    request = state["request"]
    preferences = request["preferences"]
    nights = (request["end_date"] - request["start_date"]).days
    route = f"{request['origin']} to {request['destination']} on {request['start_date'].isoformat()}"
    flags: list[str] = []
    rejected: list = []

    # The trip's dates are fixed (hotel nights hang off them), so only a flight on the start
    # date can be booked. Fares from nearby days stay in the ledger as date trade-offs.
    on_day = []
    for option in state["flight_options"]:
        moved = days_off(option, request["start_date"])
        if moved == 0:
            on_day.append(option)
        else:
            side = "before" if moved < 0 else "after"
            rejected.append({
                "option_id": option["id"],
                "rule": "travel_date",
                "detail": f"{option['id']} departs {option['departure_time'][:10]}, "
                          f"{abs(moved)} day(s) {side} the trip starts",
            })
    flights = screen(on_day, flight_rule_broken, preferences, rejected)
    flight = min(flights, key=lambda f: f["price"], default=None)
    if state.get("search_error"):
        flags.append(state["search_error"])
    elif not state["flight_options"]:
        flags.append(f"No flights found from {route}")
    elif not on_day:
        nearest = sorted(state["flight_options"], key=lambda f: f["price"])[:3]
        listed = ", ".join(f"{f['id']} on {f['departure_time'][:10]} for {f['price']:,}" for f in nearest)
        flags.append(f"No flights found from {route}; nearest real fares: {listed}")
    elif flight is None:
        flags.append(f"No flight from {route} meets the trip's preferences")

    hotel = None
    if nights > 0 and state.get("hotels_unavailable"):
        flags.append(state["hotels_unavailable"])
    elif nights > 0:
        hotels = screen(state["hotel_options"], hotel_rule_broken, preferences, rejected)
        hotel = min(hotels, key=lambda h: h["price_per_night"], default=None)
        if not state["hotel_options"] and not state.get("search_error"):
            flags.append(f"No hotels found in {request['destination']}")
        elif state["hotel_options"] and hotel is None:
            flags.append(f"No hotel in {request['destination']} meets the trip's preferences")

    total_cost, within_budget, budget_flag = price_check(request, flight, hotel, nights)
    if budget_flag:
        flags.append(budget_flag)

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
    label = f"{flight['id']} {flight['airline']} {flight['cabin_class']}, {flight['stops']} stop(s)"
    if flight.get("departure_time"):
        label += f", departs {flight['departure_time'][:10]}"
    return label


def hotel_label(hotel: dict) -> str:
    rating = "unrated" if hotel["rating"] is None else f"rated {hotel['rating']}"
    return f"{hotel['id']} {hotel['name']}, {rating}"


def ledger_entries(kind, options, chosen, price_of, label, rejected_by_id, picked=False) -> list[dict]:
    # Every option search_node found gets one row: the winner, or why it lost.
    # `kind` ("flight" or "stay") lets clients group rows without parsing option ids.
    # `picked` means a reviewer chose this line item by hand instead of the optimizer.
    entries = []
    for option in sorted(options, key=price_of):
        price = float(price_of(option))
        if chosen and option["id"] == chosen["id"]:
            reason = PICKED_REASON if picked else "Cheapest option that meets every trip preference"
        elif option["id"] in rejected_by_id and rejected_by_id[option["id"]]["rule"] == "travel_date":
            reason = f"Different day: {rejected_by_id[option['id']]['detail']}"
            if chosen:
                difference = price - price_of(chosen)
                reason += f"; {abs(difference):,.0f} {'less' if difference < 0 else 'more'} than {chosen['id']}"
        elif option["id"] in rejected_by_id:
            rejection = rejected_by_id[option["id"]]
            reason = f"Preference {rejection['rule']}: {rejection['detail']}"
        else:
            difference = price - price_of(chosen)
            reason = f"Price: {abs(difference):,.0f} {'less' if difference < 0 else 'more'} than {chosen['id']}"
        won = bool(chosen) and option["id"] == chosen["id"]
        entries.append({"kind": kind, "alternative": label(option), "price": price, "won": won, "reason": reason})
    return entries


def build_ledger(state: PipelineState) -> list[dict]:
    check = state["check"]
    nights = check["nights"]
    picked = state.get("picked", [])
    rejected_by_id = {r["option_id"]: r for r in check["rejected"]}
    ledger = ledger_entries(
        "flight",
        state["flight_options"], check["flight"], lambda f: f["price"], flight_label, rejected_by_id,
        picked="flight" in picked,
    )
    if nights > 0:
        ledger += ledger_entries(
            "stay",
            state["hotel_options"],
            check["hotel"],
            lambda h: h["price_per_night"] * nights,
            hotel_label,
            rejected_by_id,
            picked="stay" in picked,
        )
    return ledger


# check_node's selection rule, stated once so the rationale can explain the choice.
WHY_CHOSEN = "cheapest option that meets every trip preference"
# A line item a reviewer swapped in by hand (edit_itinerary).
WHY_PICKED = "picked by the reviewer from the options that meet every trip preference"
PICKED_REASON = "Picked by the reviewer; meets every trip preference"


def rationale_facts(state: PipelineState) -> dict:
    # The only numbers the rationale may use; all of them were computed in code.
    request = state["request"]
    check = state["check"]
    hotel = check["hotel"]
    picked = state.get("picked", [])
    return {
        "route": f"{request['origin']} to {request['destination']}",
        "dates": f"{request['start_date'].isoformat()} to {request['end_date'].isoformat()}",
        "budget": request["budget"],
        "flight": {
            "option": flight_label(check["flight"]),
            "price": check["flight"]["price"],
            "why_chosen": WHY_PICKED if "flight" in picked else WHY_CHOSEN,
            "options_compared": len(state["flight_options"]),
        },
        "hotel": None
        if hotel is None
        else {
            "option": hotel_label(hotel),
            "price_per_night": hotel["price_per_night"],
            "nights": check["nights"],
            "stay_cost": hotel["price_per_night"] * check["nights"],
            "why_chosen": WHY_PICKED if "stay" in picked else WHY_CHOSEN,
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
    by_hand = [item for item in (facts["flight"], facts["hotel"]) if item and item["why_chosen"] == WHY_PICKED]
    if by_hand:
        which = "these options" if len(by_hand) > 1 else "one of them"
        text = " ".join(parts) + f". The reviewer picked {which} by hand from the options that meet every trip preference. "
    else:
        text = " ".join(parts) + ", the cheapest options that meet every trip preference. "
    text += f"Total cost is {facts['total_cost']:,.0f} against a budget of {facts['budget']:,.0f}, "
    if facts["within_budget"]:
        text += f"leaving {facts['difference_from_budget']:,.0f} unspent."
    else:
        text += f"which is {facts['difference_from_budget']:,.0f} over budget."
    if facts["options_ruled_out"]:
        text += f" {len(facts['options_ruled_out'])} option(s) were ruled out by the trip's dates or preferences."
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


def write_rationale(facts: dict) -> tuple[str, str | None]:
    """The LLM's rationale, or the template one when no LLM is set up or the call fails.

    The second value is the guardrail failure (docs/08_GenAI_Architecture.md): set when the
    LLM's prose used a number that isn't in the facts, so the caller never shows it.
    """
    llm = get_llm()
    if llm is not None:
        facts_text = json.dumps(facts, indent=2)
        rationale = None
        try:
            rationale = llm.invoke(RATIONALE_PROMPT.format(facts=facts_text)).content.strip() or None
        except Exception:
            # A busy or rate-limited LLM shouldn't fail a trip whose choices are already made.
            logger.warning("Rationale LLM call failed, using the template rationale", exc_info=True)
        if rationale is not None:
            invented = numbers_in(rationale) - numbers_in(facts_text)
            if invented:
                listed = ", ".join(f"{n:g}" for n in sorted(invented))
                return rationale, f"Rationale used numbers not in the itinerary: {listed}"
            return rationale, None
    return template_rationale(facts), None


def compose_node(state: PipelineState) -> dict:
    # The only LLM call in the pipeline, and it only writes prose: the choice, the total
    # and the Trade-off Ledger all come from check_node's numbers.
    check = state["check"]
    hotel_missing = check["nights"] > 0 and check["hotel"] is None and not state.get("hotels_unavailable")
    if check["flight"] is None or hotel_missing:
        return {"failure_reason": "; ".join(check["flags"]) or "No itinerary could be built"}

    rationale, invented = write_rationale(rationale_facts(state))
    if invented:
        # The guardrail fails the run instead of showing a figure the code didn't compute.
        return {"failure_reason": invented}

    return {
        "itinerary": {
            "flight": check["flight"],
            "hotel": check["hotel"],
            "total_cost": check["total_cost"],
            "rationale": rationale,
            "tradeoff_ledger": build_ledger(state),
        }
    }


class EditRefused(ValueError):
    """A reviewer edit that can't be applied; the message says why."""


def edit_itinerary(state: PipelineState, current: dict, kind: str, option_id: str, picked: list[str]) -> dict:
    """Swaps one line item of a saved itinerary for another option from the same search (PRD US-007).

    `state` holds the request and the saved search results, `current` the itinerary's flight and
    hotel, `picked` the line items a reviewer already chose. Only options that pass every rule can
    be picked, so an edit changes the price but never brings in a flight on another day or one
    that breaks a preference. Total, budget verdict, ledger and rationale are recomputed in code.
    """
    check = check_node(state)["check"]
    if kind == "stay" and check["nights"] == 0:
        raise EditRefused("A same-day trip has no stay to change")
    rejected_by_id = {r["option_id"]: r for r in check["rejected"]}
    options = state["flight_options"] if kind == "flight" else state["hotel_options"]
    option = next((o for o in options if o["id"] == option_id), None)
    if option is None:
        raise EditRefused(f"{option_id} isn't one of this trip's {'flight' if kind == 'flight' else 'hotel'} options")
    if option_id in rejected_by_id:
        raise EditRefused(f"{option_id} can't be picked: {rejected_by_id[option_id]['detail']}")

    request = state["request"]
    flight = option if kind == "flight" else current["flight"]
    hotel = option if kind == "stay" else current["hotel"]
    # check_node's flags describe its own pick: keep the availability ones, redo the budget one.
    _, _, own_budget_flag = price_check(request, check["flight"], check["hotel"], check["nights"])
    flags = [f for f in check["flags"] if f != own_budget_flag]
    total_cost, within_budget, budget_flag = price_check(request, flight, hotel, check["nights"])
    if budget_flag:
        flags.append(budget_flag)

    edited: PipelineState = {
        **state,
        "picked": sorted(set(picked) | {kind}),
        "check": {**check, "flight": flight, "hotel": hotel, "total_cost": total_cost,
                  "within_budget": within_budget, "flags": flags},
    }
    facts = rationale_facts(edited)
    rationale, invented = write_rationale(facts)
    if invented:
        # The reviewer made this choice, so a bad LLM sentence falls back instead of failing the trip.
        logger.warning("Edited itinerary's rationale failed the guardrail: %s", invented)
        rationale = template_rationale(facts)
    return {
        "flight": flight,
        "hotel": hotel,
        "total_cost": total_cost,
        "within_budget": within_budget,
        "flags": flags,
        "rationale": rationale,
        "tradeoff_ledger": build_ledger(edited),
        "picked": edited["picked"],
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
