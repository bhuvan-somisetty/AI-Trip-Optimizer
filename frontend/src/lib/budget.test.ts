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
const train = journey("J-3", ["train"], 1200);
const unpricedTrain = journey("J-4", ["train"], null);
const bus = journey("J-5", ["bus"], null);

describe("budget fit", () => {
  it("compares real fares exactly", () => {
    expect(budgetFit(cheaper, 20000)).toEqual({ status: "within", label: "Within budget · ₹2,000 left" });
    expect(budgetFit(flight, 20000)).toEqual({ status: "over", label: "₹10,000 over budget" });
    expect(budgetFit(flight, null)).toBeNull();
  });

  it("never guesses a fare that isn't published, or compares one in another currency", () => {
    expect(budgetFit(unpricedTrain, 5000)).toEqual({ status: "unknown", label: "Fare not published: check with the operator" });
    expect(budgetFit({ ...flight, currency: "EUR", fare: 100 }, 20000)?.status).toBe("unknown");
    expect(fitsBudget(train, 2000)).toBe(true);
    expect(fitsBudget(unpricedTrain, 2000)).toBe(false);
    expect(fitsBudget(unpricedTrain, null)).toBe(true);
  });

  it("sorts by real fare, unpublished fares last", () => {
    expect([flight, bus, train, cheaper].sort((a, b) => sortCost(a) - sortCost(b)).map((j) => j.id)).toEqual(["J-3", "J-2", "J-1", "J-5"]);
  });

  it("summarises each mode against the budget", () => {
    const rows = modeSummary([flight, cheaper, train, unpricedTrain, bus], ["flight", "train", "bus"], 20000);
    expect(rows[0]).toEqual({ mode: "flight", count: 2, fitting: 1, unpriced: 0, cheapestFare: 18000 });
    expect(rows[1]).toEqual({ mode: "train", count: 2, fitting: 1, unpriced: 1, cheapestFare: 1200 });
    expect(rows[2]).toEqual({ mode: "bus", count: 1, fitting: 0, unpriced: 1, cheapestFare: null });
  });

  it("picks the cheapest and the best value within the budget", () => {
    const fast = journey("J-6", ["flight"], 19000, { duration_minutes: 150 });
    const { cheapest, bestValue } = bestWithinBudget([flight, cheaper, fast, unpricedTrain], 20000, 300);
    expect(cheapest?.id).toBe("J-2");
    expect(bestValue?.id).toBe("J-6"); // ₹1,000 more but 7.5 hours shorter
    expect(bestWithinBudget([flight], 20000).cheapest).toBeNull();
  });
});
