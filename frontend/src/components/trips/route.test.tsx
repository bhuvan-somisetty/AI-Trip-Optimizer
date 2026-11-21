import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteResponse } from "@/lib/api";

const getRoute = vi.fn();

vi.mock("@/lib/api", () => ({ getRoute: (...a: unknown[]) => getRoute(...a) }));
vi.mock("@/lib/store", () => ({ useStore: () => ({ session: { token: "tok" } }) }));
// Leaflet needs a real browser; the map itself is not under test here.
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="route-map" /> }));

const { RouteTab } = await import("./route");

const route: RouteResponse = {
  city: "GOI",
  hotel: { name: "Sea View", latitude: 15.5, longitude: 73.8, to_road_m: 20 },
  stops: [
    { order: 1, name: "Fort Aguada", category: "Fort", latitude: 15.49, longitude: 73.77, to_road_m: 40, road_m_from_hotel: 11300 },
    { order: 2, name: "Se Cathedral", category: "Religious site", latitude: 15.5, longitude: 73.91, to_road_m: 10, road_m_from_hotel: 14000 },
  ],
  legs: [
    { from: "Sea View", to: "Fort Aguada", road_m: 11300, straight_m: 9000, path: [[15.5, 73.8], [15.49, 73.77]] },
    { from: "Fort Aguada", to: "Se Cathedral", road_m: 15200, straight_m: 13000, path: [[15.49, 73.77], [15.5, 73.91]] },
  ],
  total_road_m: 26500,
  unreachable: ["Chapora Fort"],
  source: "OpenStreetMap",
  data_label: "Map data",
  notice: null,
};

beforeEach(() => {
  getRoute.mockReset();
});

describe("RouteTab", () => {
  it("lists the stops in order with road and straight distances, and no times", async () => {
    getRoute.mockResolvedValue(route);
    render(<RouteTab tripId="t1" />);
    expect(await screen.findByText("Fort Aguada")).toBeInTheDocument();
    expect(getRoute).toHaveBeenCalledWith("tok", "t1", 6);
    expect(screen.getByText("11.3 km by road (9.0 km straight) from the hotel")).toBeInTheDocument();
    expect(screen.getByText("15.2 km by road (13.0 km straight) from Fort Aguada")).toBeInTheDocument();
    expect(screen.getByText("Total 26.5 km by road")).toBeInTheDocument();
    expect(screen.getByText("No road found to: Chapora Fort.")).toBeInTheDocument();
    expect(screen.getByText(/Dijkstra's algorithm on OpenStreetMap roads. No travel times are shown./)).toBeInTheDocument();
    expect(screen.getByTestId("route-map")).toBeInTheDocument();
  });

  it("shows the API's notice when there is no route yet", async () => {
    getRoute.mockResolvedValue({ ...route, hotel: null, stops: [], legs: [], total_road_m: null, unreachable: [], notice: "Optimize the trip first: the route starts at its hotel" });
    render(<RouteTab tripId="t1" />);
    expect(await screen.findByText("Optimize the trip first: the route starts at its hotel")).toBeInTheDocument();
    expect(screen.queryByTestId("route-map")).not.toBeInTheDocument();
  });
});
