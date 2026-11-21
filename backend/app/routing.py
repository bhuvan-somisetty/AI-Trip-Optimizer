"""Shortest road routes between a trip's hotel and its attractions: Dijkstra's algorithm.

The road network is a weighted graph (app/roads.py builds it from OpenStreetMap):
  - a node  = a point where roads meet or bend, with its latitude and longitude
  - an edge = the stretch of road between two consecutive nodes, weighted by its length in metres
A one-way street is an edge in one direction only.

Dijkstra finds, from one start node, the shortest road distance to every other node. It keeps a
priority queue (heapq) of "distance found so far" and always settles the closest unsettled node
next; once settled, a node's distance can no longer get shorter, because every edge is >= 0.
Running it once from each stop (hotel + attractions) gives the road distance between every pair
of stops, and the day's visiting order is then chosen from those distances (nearest next).
"""
import heapq
import math

Graph = dict[int, list[tuple[int, float]]]  # node -> [(neighbour, metres), ...]


def dijkstra(graph: Graph, source: int) -> tuple[dict[int, float], dict[int, int]]:
    """Shortest distance (metres) from `source` to every node it can reach, and each node's
    previous node on that shortest path (to rebuild the path)."""
    dist: dict[int, float] = {source: 0.0}
    prev: dict[int, int] = {}
    settled: set[int] = set()
    queue: list[tuple[float, int]] = [(0.0, source)]
    while queue:
        d, node = heapq.heappop(queue)
        if node in settled:
            continue  # an older, longer entry for a node already settled
        settled.add(node)
        for neighbour, metres in graph.get(node, ()):
            candidate = d + metres
            if candidate < dist.get(neighbour, math.inf):
                dist[neighbour] = candidate
                prev[neighbour] = node
                heapq.heappush(queue, (candidate, neighbour))
    return dist, prev


def path_to(prev: dict[int, int], source: int, target: int) -> list[int]:
    """The node path from `source` to `target` read back from Dijkstra's `prev` links."""
    if target != source and target not in prev:
        return []
    path = [target]
    while path[-1] != source:
        path.append(prev[path[-1]])
    return path[::-1]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line ("as the crow flies") distance in metres, for edge weights and comparison."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(a))


def road_matrix(graph: Graph, stop_nodes: list[int]) -> tuple[list[list[float]], list[dict[int, int]]]:
    """Road distance between every pair of stops: one Dijkstra run per stop.

    matrix[i][j] is metres from stop i to stop j (math.inf when no road connects them).
    """
    matrix, prevs = [], []
    for start in stop_nodes:
        dist, prev = dijkstra(graph, start)
        matrix.append([dist.get(end, math.inf) for end in stop_nodes])
        prevs.append(prev)
    return matrix, prevs


def visiting_order(matrix: list[list[float]]) -> list[int]:
    """Stops in the order to visit them, starting at stop 0 (the hotel): always the nearest
    unvisited stop next by road. Stops no road reaches are left out."""
    order, here = [0], 0
    left = set(range(1, len(matrix)))
    while left:
        nxt = min(left, key=lambda j: matrix[here][j])
        if matrix[here][nxt] == math.inf:
            break
        order.append(nxt)
        left.remove(nxt)
        here = nxt
    return order
