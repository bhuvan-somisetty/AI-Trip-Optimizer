"""The real road network around a trip's stops, from OpenStreetMap, as a graph for Dijkstra.

Roads come from the public Overpass API (https://wiki.openstreetmap.org/wiki/Overpass_API):
free, no key, fair use (well under 10,000 requests a day; we cache, so one city area is asked
for once). Data (c) OpenStreetMap contributors, ODbL.

One query returns every drivable road ("way") in a box around the hotel and attractions, with
the points ("nodes") along it. Consecutive nodes of a road become an edge weighted by the
straight distance between them, so a curved road adds up its real length. One-way roads only
get an edge in their direction. No driving time is worked out: without traffic data it would
be a guess, so routes give real road metres only.
"""
import logging
import time
from collections import deque

import httpx

from app.routing import Graph, haversine_m
from app.travel_data import TravelDataError

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
SOURCE = "OpenStreetMap road network via the Overpass API (© OpenStreetMap contributors)"
TIMEOUT_SECONDS = 90  # a city area's roads can take a while to assemble
MARGIN_DEG = 0.01  # about 1 km of extra road around the outermost stops
CACHE_SECONDS = 7 * 24 * 3600  # roads change slowly
ROADS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street"

_cache: dict[tuple, tuple[float, "RoadGraph"]] = {}


class RoadGraph:
    """Nodes with coordinates, directed weighted edges, and the largest connected part."""

    def __init__(self, coords: dict[int, tuple[float, float]], graph: Graph):
        self.coords = coords
        self.graph = graph  # weights: metres
        self.main = largest_component(graph)

    def nearest(self, lat: float, lon: float) -> tuple[int, float]:
        """The road node closest to a point (only on the main connected network, so every
        snapped stop can reach the others), and how far the point is from it."""
        best = min(self.main, key=lambda n: haversine_m(lat, lon, *self.coords[n]))
        return best, haversine_m(lat, lon, *self.coords[best])


def largest_component(graph: Graph) -> set[int]:
    # Roads ignoring direction: a small piece cut off from the rest (a gated estate, a road
    # mapped without its junction) would make every route to it impossible.
    undirected: dict[int, set[int]] = {}
    for a, edges in graph.items():
        for b, _ in edges:
            undirected.setdefault(a, set()).add(b)
            undirected.setdefault(b, set()).add(a)
    seen: set[int] = set()
    best: set[int] = set()
    for start in undirected:
        if start in seen:
            continue
        part, queue = {start}, deque([start])
        while queue:
            for nxt in undirected[queue.popleft()]:
                if nxt not in part:
                    part.add(nxt)
                    queue.append(nxt)
        seen |= part
        if len(part) > len(best):
            best = part
    return best


def query(south: float, west: float, north: float, east: float) -> str:
    return (
        f'[out:json][timeout:{TIMEOUT_SECONDS}];'
        f'way["highway"~"^({ROADS})(_link)?$"]({south},{west},{north},{east});'
        'out body;>;out skel qt;'
    )


def fetch_elements(south: float, west: float, north: float, east: float) -> list[dict]:
    try:
        response = httpx.post(
            OVERPASS_URL,
            data={"data": query(south, west, north, east)},
            headers={"User-Agent": "AI-Trip-Optimizer/1.0 (student project)"},
            timeout=TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException as e:
        raise TravelDataError("OpenStreetMap roads took too long to load, please try again") from e
    except httpx.HTTPError as e:
        logger.warning("Overpass request failed: %s", e)
        raise TravelDataError("OpenStreetMap roads couldn't be reached, please try again") from e
    if response.status_code == 429:
        raise TravelDataError("OpenStreetMap roads are busy right now, please wait a minute and try again")
    if response.status_code >= 400:
        raise TravelDataError(f"OpenStreetMap roads couldn't be loaded (HTTP {response.status_code})")
    try:
        return response.json().get("elements") or []
    except ValueError as e:
        raise TravelDataError("OpenStreetMap sent roads that couldn't be read") from e


def build_graph(elements: list[dict]) -> RoadGraph:
    coords = {e["id"]: (e["lat"], e["lon"]) for e in elements if e.get("type") == "node" and "lat" in e}
    graph: Graph = {}
    for way in (e for e in elements if e.get("type") == "way"):
        tags = way.get("tags") or {}
        oneway = tags.get("oneway")
        forward = oneway in ("yes", "true", "1") or tags.get("junction") == "roundabout"
        backward = oneway == "-1"
        nodes = [n for n in way.get("nodes") or [] if n in coords]
        for a, b in zip(nodes, nodes[1:]):
            metres = haversine_m(*coords[a], *coords[b])
            if not backward:
                graph.setdefault(a, []).append((b, metres))
            if not forward:
                graph.setdefault(b, []).append((a, metres))
    used = {n for n in graph} | {b for edges in graph.values() for b, _ in edges}
    return RoadGraph({n: coords[n] for n in used}, graph)


def road_graph(points: list[tuple[float, float]]) -> RoadGraph:
    """The road network covering all `points` (lat, lon) plus a margin, cached by area."""
    south = min(p[0] for p in points) - MARGIN_DEG
    north = max(p[0] for p in points) + MARGIN_DEG
    west = min(p[1] for p in points) - MARGIN_DEG
    east = max(p[1] for p in points) + MARGIN_DEG
    key = tuple(round(v, 3) for v in (south, west, north, east))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    roads = build_graph(fetch_elements(south, west, north, east))
    if not roads.main:
        raise TravelDataError("OpenStreetMap has no roads mapped around these places")
    _cache[key] = (time.time(), roads)
    return roads
