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


def check_node(state: PipelineState) -> dict:
    # Day 23: compute totals and budget/constraint flags into `check`. No LLM call.
    return {}


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
