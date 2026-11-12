import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actions, getState } from "./store";

// The store against the real API's shapes: fetch is mocked, so these check what the browser
// sends to the backend and how it reads the answers (docs/07_API_Specification.md).
vi.mock("./toast", () => ({ toast: vi.fn() }));

const TRIP_ID = "0b1c2d3e-0000-4000-8000-000000000000";

const flight = (id: string, origin: string, destination: string, price: number) => ({
  id, origin, destination, departure_time: "2026-12-22T06:00:00+05:30", airline: "IndiGo", price, cabin_class: "economy", stops: 0,
});

const itineraryBody = (total: number, back = "FL-6E202") => ({
  status: "UNDER_REVIEW",
  itinerary: {
    flight: flight("FL-6E101", "DEL", "BOM", 4500),
    return_flight: flight(back, "BOM", "DEL", 5200),
    hotel: { id: "HT-1", city: "BOM", name: "Sea View", price_per_night: 3000, rating: 4.1 },
    total_cost: total,
    savings: 1000,
    within_budget: true,
    flags: [],
    rationale: "",
    picked: [],
    editable: true,
  },
  tradeoff_ledger: [{ kind: "return", alternative: `${back} IndiGo economy, 0 stop(s)`, price: 5200, won: true, reason: "Picked by the reviewer; meets every trip preference" }],
  reason: null,
});

type Call = { method: string; path: string; body?: unknown };
let calls: Call[] = [];
let routes: Record<string, unknown> = {};

beforeEach(async () => {
  calls = [];
  routes = {
    "GET /travelers": [],
    "GET /audit?limit=500": [],
    "GET /trips": [{
      id: TRIP_ID, traveler_id: "trv", origin: "DEL", destination: "BOM", dates: ["2026-12-22", "2026-12-25"],
      budget: 30000, preferences: {}, status: "OPTIMIZED", failure_reason: null, created_by: "u",
    }],
    [`GET /trips/${TRIP_ID}/itinerary`]: { ...itineraryBody(18700), status: "OPTIMIZED" },
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const method = init.method ?? "GET";
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const key = `${method} ${path}`;
    if (!(key in routes)) return new Response(JSON.stringify({ detail: `no mock for ${key}` }), { status: 500 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
  actions.login({ name: "Bhuvan", email: "b@example.com", role: "member", mode: "api", token: "t" });
  await actions.syncFromApi();
});

afterEach(() => {
  actions.logout();
  vi.unstubAllGlobals();
});

describe("store in API mode", () => {
  it("loads the trip with its return flight and savings", () => {
    const trip = getState().trips.find((t) => t.id === TRIP_ID)!;
    expect(trip.itinerary?.return?.id).toBe("FL-6E202");
    expect(trip.itinerary?.savings).toBe(1000);
  });

  it("swaps the return flight through the API", async () => {
    routes[`PATCH /trips/${TRIP_ID}/itinerary`] = itineraryBody(19500, "FL-AI404");
    await actions.editLineItem(TRIP_ID, "return", "FL-AI404");
    expect(calls.at(-1)).toEqual({ method: "PATCH", path: `/trips/${TRIP_ID}/itinerary`, body: { kind: "return", option_id: "FL-AI404" } });
    const trip = getState().trips.find((t) => t.id === TRIP_ID)!;
    expect(trip.itinerary?.return?.id).toBe("FL-AI404");
    expect(trip.itinerary?.totalCost).toBe(19500);
    expect(trip.status).toBe("UNDER_REVIEW");
  });

  it("sends an outbound swap as kind flight", async () => {
    routes[`PATCH /trips/${TRIP_ID}/itinerary`] = itineraryBody(18700);
    await actions.editLineItem(TRIP_ID, "outbound", "FL-6E101");
    expect(calls.at(-1)?.body).toEqual({ kind: "flight", option_id: "FL-6E101" });
  });

  it("previews a what-if without changing the trip", async () => {
    routes[`POST /trips/${TRIP_ID}/preview`] = { inputs: [{ field: "max_stops", before: null, after: 0 }], preview: itineraryBody(21000), diff: [] };
    const res = await actions.previewWhatIf(TRIP_ID, { max_stops: 0 });
    expect(calls.at(-1)).toMatchObject({ method: "POST", path: `/trips/${TRIP_ID}/preview`, body: { max_stops: 0 } });
    expect(res.itinerary?.totalCost).toBe(21000);
    expect(getState().trips.find((t) => t.id === TRIP_ID)?.itinerary?.totalCost).toBe(18700);
  });

  it("applies a what-if and keeps the new inputs", async () => {
    routes[`POST /trips/${TRIP_ID}/preview/apply`] = itineraryBody(21000);
    await actions.applyWhatIf(TRIP_ID, { budget: 40000, max_stops: 0 });
    const trip = getState().trips.find((t) => t.id === TRIP_ID)!;
    expect(trip.budget).toBe(40000);
    expect(trip.filters.maxStops).toBe(0);
    expect(trip.itinerary?.totalCost).toBe(21000);
    expect(trip.status).toBe("UNDER_REVIEW");
  });

  it("records a rejection with its reason, and refuses one without", async () => {
    await expect(actions.decide(TRIP_ID, "REJECTED", "  ")).rejects.toThrow("A reason is required");
    expect(calls.some((c) => c.path.endsWith("/decision"))).toBe(false);

    routes[`POST /trips/${TRIP_ID}/decision`] = { id: "d", trip_id: TRIP_ID, outcome: "REJECTED", reason: "Over budget", decided_by: "u", decided_at: "2026-11-12T10:00:00Z" };
    await actions.decide(TRIP_ID, "REJECTED", "Over budget");
    expect(calls.at(-1)).toEqual({ method: "POST", path: `/trips/${TRIP_ID}/decision`, body: { outcome: "REJECTED", reason: "Over budget" } });
    const trip = getState().trips.find((t) => t.id === TRIP_ID)!;
    expect(trip.status).toBe("DECIDED");
    expect(trip.decisionReason).toBe("Over budget");
  });
});
