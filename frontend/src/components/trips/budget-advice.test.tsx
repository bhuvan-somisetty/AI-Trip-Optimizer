import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JourneyResponse, JourneysResponse } from "@/lib/api";

const searchJourneys = vi.fn();
vi.mock("@/lib/api", () => ({ searchJourneys: (...a: unknown[]) => searchJourneys(...a) }));

const { BudgetAdvice, pickForBudget, describe: describeJourney } = await import("./budget-advice");

function j(id: string, modes: ("flight" | "train" | "bus")[], fare: number | null, minutes: number, via: string[] = []): JourneyResponse {
  return {
    id, kind: via.length ? "connecting" : "direct", separate_tickets: via.length > 0,
    via: via.map((name) => ({ code: name.slice(0, 3).toUpperCase(), name })), modes,
    departure_time: "2026-12-17T08:00:00", arrival_time: "2026-12-17T12:00:00", duration_minutes: minutes,
    transfers: via.length, transfer_waits: [], fare, currency: fare === null ? null : "INR", fare_label: "",
    legs: modes.map((mode) => ({ mode, service: null, operator: null, from: { code: "A", name: "A" }, to: { code: "B", name: "B" } })),
  } as unknown as JourneyResponse;
}

const out = [j("f1", ["flight", "bus"], 4335, 140, ["Kadapa"]), j("b1", ["bus"], 650, 420), j("t1", ["train"], null, 380)];
const back = [j("f2", ["bus", "flight"], 5000, 150, ["Kadapa"]), j("b2", ["bus"], 700, 430)];
const data = { journeys: out, return: { journeys: back } } as unknown as JourneysResponse;

beforeEach(() => searchJourneys.mockReset());

describe("pickForBudget", () => {
  it("takes the best value way there and back that fits", () => {
    const pick = pickForBudget(data, 10000)!;
    expect(pick.fits).toBe(true);
    // Bus there and back: 1,350 + 14h x 300 = 5,550; flight via Kadapa: 9,335 + 4h50 x 300 = 10,785.
    expect([pick.out?.id, pick.back?.id]).toEqual(["b1", "b2"]);
    expect(pick.total).toBe(1350);
  });

  it("names the cheapest pair when nothing fits", () => {
    const pick = pickForBudget(data, 1000)!;
    expect(pick.fits).toBe(false);
    expect(pick.out?.id).toBe("b1");
    expect(pick.total).toBe(1350);
  });

  it("has nothing to say without a published fare", () => {
    expect(pickForBudget({ journeys: [out[2]], return: null } as unknown as JourneysResponse, 5000)).toBeNull();
  });

  it("describes a journey in words", () => {
    expect(describeJourney(out[0])).toBe("Flight then bus via Kadapa, 2h 20m");
  });
});

describe("BudgetAdvice", () => {
  it("searches when asked, then highlights the pick and compares every way", async () => {
    searchJourneys.mockResolvedValue(data);
    render(<BudgetAdvice token="t" origin="BLR" destination="mydukuru" date="2026-12-17" returnDate="2026-12-20" modes={["flight", "train", "bus"]} budget={10000} travellers={1} />);
    expect(searchJourneys).not.toHaveBeenCalled(); // no searches until the traveller asks
    await userEvent.click(screen.getByRole("button", { name: /Find the best way within/ }));
    expect(searchJourneys).toHaveBeenCalledWith("t", expect.objectContaining({ origin: "BLR", destination: "mydukuru", returnDate: "2026-12-20", vias: 0 }));
    const card = await screen.findByRole("note", { name: "Best for your budget" });
    expect(card).toHaveTextContent("Your budget is ₹10,000");
    const table = screen.getByRole("region", { name: "Compare every way" });
    expect(table).toHaveTextContent("Bus");
    expect(table).toHaveTextContent("1 of 1 fit, from ₹650");
    expect(table).toHaveTextContent("Train");
    expect(table).toHaveTextContent("1 found, fare not published");
  });
});
