"""The real road network around a trip's stops, from OpenStreetMap, as a graph for Dijkstra.

Roads come from the public Overpass API (https://wiki.openstreetmap.org/wiki/Overpass_API):
free, no key, fair use (well under 10,000 requests a day; we cache, so one city area is asked
for once). Data (c) OpenStreetMap contributors, ODbL.

One query returns every drivable road ("way") in a box around the hotel and attractions, with
the points ("nodes") along it. Consecutive nodes of a road become an edge weighted by the
straight distance between them, so a curved road adds up its real length. One-way roads only
get an edge in their direction.

A second graph has the same edges weighted by estimated driving time: the road's own speed limit
when OpenStreetMap has one ("maxspeed"), otherwise a typical speed for its class (SPEEDS_KMH).
Those speeds are assumptions, not traffic data, so times are labelled as estimates.
"""
import re
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

# Typical city driving speeds by road class, km/h: an estimate where a road has no speed limit tag.
SPEEDS_KMH = {
    "motorway": 80, "trunk": 60, "primary": 40, "secondary": 35, "tertiary": 30,
    "unclassified": 25, "residential": 20, "living_street": 10,
}
_cache: dict[tuple, tuple[float, "RoadGraph"]] = {}


def speed_kmh(tags: dict) -> float:
    """The road's "maxspeed" when it is a plain number (km/h or mph), else its class's typical speed."""
    found = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(mph)?\s*", str(tags.get("maxspeed") or ""))
    if found and float(found.group(1)) > 0:
        return float(found.group(1)) * (1.609 if found.group(2) else 1)
    road = (tags.get("highway") or "").removesuffix("_link")
    return SPEEDS_KMH.get(road, 20)


class RoadGraph:
    """Nodes with coordinates, directed weighted edges, and the largest connected part."""

    def __init__(self, coords: dict[int, tuple[float, float]], graph: Graph, time_graph: Graph | None = None):
        self.coords = coords
        self.graph = graph  # weights: metres
        self.time_graph = time_graph or {}  # the same edges, weights: estimated seconds
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
    times: Graph = {}
    for way in (e for e in elements if e.get("type") == "way"):
        tags = way.get("tags") or {}
        metres_per_second = speed_kmh(tags) / 3.6
        oneway = tags.get("oneway")
        forward = oneway in ("yes", "true", "1") or tags.get("junction") == "roundabout"
        backward = oneway == "-1"
        nodes = [n for n in way.get("nodes") or [] if n in coords]
        for a, b in zip(nodes, nodes[1:]):
            metres = haversine_m(*coords[a], *coords[b])
            seconds = metres / metres_per_second
            if not backward:
                graph.setdefault(a, []).append((b, metres))
                times.setdefault(a, []).append((b, seconds))
            if not forward:
                graph.setdefault(b, []).append((a, metres))
                times.setdefault(b, []).append((a, seconds))
    used = {n for n in graph} | {b for edges in graph.values() for b, _ in edges}
    return RoadGraph({n: coords[n] for n in used}, graph, times)


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
