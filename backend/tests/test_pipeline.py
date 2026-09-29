from datetime import date

from app.pipeline.graph import pipeline

REQUEST = {
    "origin": "BLR",
    "destination": "DEL",
    "start_date": date(2026, 11, 1),
    "end_date": date(2026, 11, 3),
    "budget": 20000.0,
    "preferences": {},
}


def test_pipeline_runs_nodes_in_order():
    edges = {(e.source, e.target) for e in pipeline.get_graph().edges}
    assert edges == {
        ("__start__", "search"),
        ("search", "check"),
        ("check", "compose"),
        ("compose", "__end__"),
    }


def test_pipeline_runs_end_to_end_and_keeps_request():
    result = pipeline.invoke({"request": REQUEST})
    assert result["request"] == REQUEST
