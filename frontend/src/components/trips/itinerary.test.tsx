import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Itinerary, Trip } from "@/lib/types";
import { CostSummary } from "./itinerary";

const trip = { budget: 30000 } as Trip;

const it_ = (overrides: Partial<Itinerary>): Itinerary =>
  ({
    nights: 3,
    travelers: 1,
    flightCost: 9700,
    stayCost: 9000,
    totalCost: 18700,
    baselineCost: 25000,
    savings: 6300,
    savingsBasis: "valid-options",
    ledger: [],
    runMs: 2700,
    ...overrides,
  }) as Itinerary;

describe("CostSummary", () => {
  it("shows the server's savings and what they are measured against", () => {
    render(<CostSummary trip={trip} it={it_({})} />);
    expect(screen.getByText("Savings")).toBeInTheDocument();
    expect(screen.getByText("₹6,300")).toBeInTheDocument();
    expect(screen.getByText(/typical options that met every rule/)).toBeInTheDocument();
    expect(screen.getByText("₹11,300 headroom")).toBeInTheDocument();
  });

  it("asks for a re-run when an old itinerary has no savings figure", () => {
    render(<CostSummary trip={trip} it={it_({ savings: 0, baselineCost: 0 })} />);
    expect(screen.getByText("Not worked out")).toBeInTheDocument();
  });

  it("flags a total over budget", () => {
    render(<CostSummary trip={trip} it={it_({ totalCost: 34000 })} />);
    expect(screen.getByText("₹4,000 over")).toBeInTheDocument();
  });

  it("keeps the demo optimizer's market baseline wording", () => {
    render(<CostSummary trip={trip} it={it_({ savingsBasis: "market" })} />);
    expect(screen.getByText("Savings vs typical")).toBeInTheDocument();
  });
});
