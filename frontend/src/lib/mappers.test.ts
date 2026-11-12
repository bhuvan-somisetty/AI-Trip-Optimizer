import { describe, expect, it } from "vitest";
import type { FlightResponse, TripResultResponse } from "./api";
import { fromTrip, toItinerary, toTrip, tripCode, type TripInput } from "./mappers";
import { defaultFilters } from "./store";
import type { Trip } from "./types";

const flight = (id: string, origin: string, destination: string, price: number, day: string): FlightResponse => ({
  id,
  origin,
  destination,
  departure_time: `${day}T06:00:00+05:30`,
  arrival_time: `${day}T08:40:00+05:30`,
  airline: "IndiGo",
  flight_number: id.replace("FL-", ""),
  price,
  cabin_class: "economy",
  stops: 0,
});

const trip = { id: "t1", departDate: "2026-12-22", returnDate: "2026-12-25", budget: 30000 } as Trip;

function result(overrides: Partial<NonNullable<TripResultResponse["itinerary"]>> = {}): TripResultResponse {
  return {
    status: "OPTIMIZED",
    itinerary: {
      flight: flight("FL-6E101", "DEL", "BOM", 4500, "2026-12-22"),
      return_flight: flight("FL-6E202", "BOM", "DEL", 5200, "2026-12-25"),
      hotel: { id: "HT-abc", city: "BOM", name: "Sea View", price_per_night: 3000, rating: 4.1 },
      total_cost: 18700,
      savings: 6300,
      within_budget: true,
      flags: [],
      rationale: "Chose flight ...",
      picked: [],
      editable: true,
      ...overrides,
    },
    tradeoff_ledger: [
      { kind: "flight", alternative: "FL-6E101 IndiGo economy, 0 stop(s)", price: 4500, won: true, reason: "Cheapest option that meets every trip preference" },
      { kind: "return", alternative: "FL-6E202 IndiGo economy, 0 stop(s)", price: 5200, won: true, reason: "Cheapest option that meets every trip preference" },
      { kind: "return", alternative: "FL-6E303 IndiGo economy, 0 stop(s)", price: 4000, won: false, reason: "Different day: FL-6E303 departs 2026-12-26, 1 day(s) after the trip ends" },
      { kind: "return", alternative: "FL-AI404 Air India economy, 0 stop(s)", price: 6000, won: false, reason: "Timing: FL-AI404 leaves before FL-6E101 lands" },
      { kind: "stay", alternative: "HT-abc Sea View, rated 4.1", price: 9000, won: true, reason: "Cheapest option that meets every trip preference" },
    ],
    reason: null,
  };
}

describe("toItinerary", () => {
  it("maps the return flight and counts it in the flight cost", () => {
    const it = toItinerary(result(), trip)!;
    expect(it.outbound.flightNo).toBe("6E101");
    expect(it.return?.flightNo).toBe("6E202");
    expect(it.return?.origin).toBe("BOM");
    expect(it.flightCost).toBe(4500 + 5200);
    expect(it.stayCost).toBe(3000 * 3);
    expect(it.totalCost).toBe(18700);
  });

  it("reports savings against typical valid options", () => {
    const it = toItinerary(result(), trip)!;
    expect(it.savings).toBe(6300);
    expect(it.baselineCost).toBe(18700 + 6300);
    expect(it.savingsBasis).toBe("valid-options");
  });

  it("shows no savings figure for itineraries saved before savings existed", () => {
    const it = toItinerary(result({ savings: null, return_flight: undefined }), trip)!;
    expect(it.savings).toBe(0);
    expect(it.baselineCost).toBe(0);
    expect(it.return).toBeNull();
    expect(it.flightCost).toBe(4500);
  });

  it("sorts ledger rows into outbound, return and stay, and marks screened ones", () => {
    const rows = toItinerary(result(), trip)!.ledger;
    expect(rows.map((r) => r.kind)).toEqual(["outbound", "return", "return", "return", "stay"]);
    const late = rows.find((r) => r.optionId === "FL-6E303")!;
    const early = rows.find((r) => r.optionId === "FL-AI404")!;
    expect(late.feasible).toBe(false);
    expect(early.feasible).toBe(false);
    expect(early.reasonCode).toBe("CONSTRAINT");
    // Stays come back priced for the whole stay; the UI shows them per night.
    expect(rows.find((r) => r.kind === "stay")!.price).toBe(3000);
  });

  it("turns flags into issues with the right severity", () => {
    const it = toItinerary(
      result({
        flags: [
          "No return fare found from BOM to DEL on 2026-12-25, so the total has no return flight in it",
          "Total 40,000 is 10,000 over the 30,000 budget (flight FL-6E101 4,500)",
          "Live hotel prices are unavailable (no SERPAPI_API_KEY is set), so this total covers the flights only",
        ],
      }),
      trip
    )!;
    expect(it.issues.map((i) => [i.rule, i.severity])).toEqual([
      ["Return flight", "warning"],
      ["Budget", "error"],
      ["Hotel prices", "info"],
    ]);
  });

  it("returns undefined when optimization failed", () => {
    expect(toItinerary({ status: "OPTIMIZATION_FAILED", itinerary: null, tradeoff_ledger: [], reason: "No flights" }, trip)).toBeUndefined();
  });
});

describe("trip form mapping", () => {
  const input: TripInput = {
    title: "Investor day",
    travelerIds: ["trv_1"],
    origin: "DEL",
    destination: "BOM",
    departDate: "2026-12-22",
    returnDate: "2026-12-25",
    purpose: "Investor relations",
    budget: 30000,
    rooms: 1,
    filters: { ...defaultFilters, cabin: "economy", maxStops: 0, minHotelRating: 4 },
    notes: "",
  };

  it("sends the optimizer's own preference keys", () => {
    const body = fromTrip(input, "2026-11-12T10:00:00Z");
    expect(body).toMatchObject({ traveler_id: "trv_1", origin: "DEL", destination: "BOM", dates: ["2026-12-22", "2026-12-25"], budget: 30000 });
    expect(body.preferences).toMatchObject({ cabin_class: "economy", max_stops: 0, min_hotel_rating: 4, title: "Investor day" });
  });

  it("refuses a trip with no traveler or no return date", () => {
    expect(() => fromTrip({ ...input, travelerIds: [] }, "")).toThrow("Select a traveler");
    expect(() => fromTrip({ ...input, returnDate: null }, "")).toThrow("A return date is required");
  });

  it("reads a saved trip back, preferring the optimizer's keys", () => {
    const body = fromTrip(input, "2026-11-12T10:00:00Z");
    const saved = toTrip(
      { ...body, id: "0b1c2d3e-0000-4000-8000-000000000000", status: "DRAFT", failure_reason: null, created_by: "u1", preferences: { ...body.preferences, max_stops: 1 } },
      { defaultFilters, createdBy: "Bhuvan" }
    );
    expect(saved.code).toBe(tripCode("0b1c2d3e-0000-4000-8000-000000000000"));
    expect(saved.filters.maxStops).toBe(1);
    expect(saved.title).toBe("Investor day");
  });
});
