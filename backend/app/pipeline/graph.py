"""The LangGraph optimization pipeline: search -> check -> compose.

Described in docs/08_GenAI_Architecture.md. The nodes are empty for now; each one
gets filled in on its own build day (see docs/27_Day_by_Day_Checklist.md):
search_node on Day 22, check_node on Day 23, compose_node on Day 24.
"""
from langgraph.graph import END, START, StateGraph

from app.mock_data import flights_for_route, hotels_for_city
from app.pipeline.state import PipelineState


def search_node(state: PipelineState) -> dict:
    # Pure lookup, no LLM: every option the later nodes see comes straight from mock data.
    request = state["request"]
    departure_day = request["start_date"].isoformat()
    flights = [
        f
        for f in flights_for_route(request["origin"], request["destination"])
        if f["departure_time"].startswith(departure_day)
    ]
    hotels = hotels_for_city(request["destination"])
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
    flags: list[str] = []
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


def compose_node(state: PipelineState) -> dict:
    # Day 24: the only LLM call; writes `itinerary` from check_node's numbers.
    return {}


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
