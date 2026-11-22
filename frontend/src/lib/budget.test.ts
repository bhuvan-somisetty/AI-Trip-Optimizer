import { describe, expect, it } from "vitest";
import type { JourneyMode, JourneyResponse } from "@/lib/api";
import { bestWithinBudget, budgetFit, fitsBudget, modeSummary, sortCost } from "@/lib/budget";

function journey(id: string, modes: JourneyMode[], fare: number | null, extra: Partial<JourneyResponse> = {}): JourneyResponse {
  return {
    id,
    kind: modes.length > 1 ? "connecting" : "direct",
    separate_tickets: modes.length > 1,
    via: [],
    modes,
    departure_time: "2027-10-26T06:00:00",
    arrival_time: "2027-10-26T09:00:00",
    duration_minutes: 180,
    transfers: modes.length - 1,
    transfer_waits: [],
    fare,
    currency: fare === null ? null : "INR",
    fare_label: fare === null ? "Not available: a leg has no published fare" : "Sum of real fares",
    legs: [],
    ...extra,
  };
}

const flight = journey("J-1", ["flight"], 30000);
const cheaper = journey("J-2", ["flight", "flight", "flight"], 18000, { duration_minutes: 600 });
const train = journey("J-3", ["train"], null, { fare_estimate: { low: 1100, high: 4600, currency: "INR", label: "Estimate" } });
const bus = journey("J-4", ["bus"], null);

describe("budget fit", () => {
  it("compares real fares exactly", () => {
    expect(budgetFit(cheaper, 20000)).toEqual({ status: "within", label: "Within budget · ₹2,000 left" });
    expect(budgetFit(flight, 20000)).toEqual({ status: "over", label: "₹10,000 over budget" });
    expect(budgetFit(flight, null)).toBeNull();
  });

  it("says likely for an estimate, and never compares a fare in another currency", () => {
    expect(budgetFit(train, 5000)?.status).toBe("likely");
    expect(budgetFit(train, 2000)?.status).toBe("partly");
    expect(budgetFit(train, 1000)).toEqual({ status: "over", label: "Likely over budget (estimate)" });
    expect(budgetFit(bus, 1000)?.status).toBe("unknown");
    expect(budgetFit({ ...flight, currency: "EUR", fare: 100 }, 20000)?.status).toBe("unknown");
    expect(fitsBudget(train, 2000)).toBe(true);
    expect(fitsBudget(flight, 20000)).toBe(false);
  });

  it("sorts estimates by their low end and unknown fares last", () => {
    expect([flight, bus, train, cheaper].sort((a, b) => sortCost(a) - sortCost(b)).map((j) => j.id)).toEqual(["J-3", "J-2", "J-1", "J-4"]);
  });

  it("summarises each mode against the budget", () => {
    const rows = modeSummary([flight, cheaper, train, bus], ["flight", "train", "bus"], 20000);
    expect(rows[0]).toEqual({ mode: "flight", count: 2, fitting: 1, cheapestFare: 18000, estimate: null });
    expect(rows[1]).toEqual({ mode: "train", count: 1, fitting: 1, cheapestFare: null, estimate: { low: 1100, high: 4600 } });
    expect(rows[2]).toMatchObject({ mode: "bus", count: 1, fitting: 0 });
  });

  it("picks the cheapest and the best value within the budget", () => {
    const fast = journey("J-5", ["flight"], 19000, { duration_minutes: 150 });
    const { cheapest, bestValue } = bestWithinBudget([flight, cheaper, fast, train], 20000, 300);
    expect(cheapest?.id).toBe("J-2");
    expect(bestValue?.id).toBe("J-5"); // ₹1,000 more but 7.5 hours shorter
    expect(bestWithinBudget([flight], 20000).cheapest).toBeNull();
  });
});
