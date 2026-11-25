import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Trip } from "@/lib/types";
import { DashboardHero } from "./hero";
import { KpiBand } from "./kpi-band";

const NOON = new Date("2026-11-25T13:00:00").getTime();
const trip = {
  id: "t1",
  code: "TRIP-0011",
  origin: "HYD",
  destination: "FRA",
  departDate: "2026-12-29",
  returnDate: "2027-01-01",
  budget: 100000,
  itinerary: { totalCost: 84330 },
} as unknown as Trip;

describe("DashboardHero", () => {
  it("greets by time of day and shows the next departure as a boarding pass", () => {
    render(<DashboardHero name="Bhuvan" now={NOON} pending={2} next={trip} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good afternoon,Bhuvan.");
    expect(screen.getByText(/2 itineraries are ready for your review/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review 2 itineraries/ })).toHaveAttribute("href", "/trips");
    expect(screen.getByText("HYD")).toBeInTheDocument();
    expect(screen.getByText("FRA")).toBeInTheDocument();
    expect(screen.getByText("₹84,330")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next departure/ })).toHaveAttribute("href", "/trips/t1");
  });

  it("invites planning when nothing is waiting or departing", () => {
    render(<DashboardHero name="Bhuvan" now={NOON} pending={0} />);
    expect(screen.getByText("No departures yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Review/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Plan a trip/ })).toHaveAttribute("href", "/planning");
  });
});

describe("KpiBand", () => {
  it("shows each number with its change and colours it by whether the change is good", () => {
    render(
      <KpiBand
        items={[
          { label: "Trips", value: "14", trend: { pct: 200, goodWhenUp: true }, series: [0, 1, 1, 2, 3, 7] },
          { label: "Approved spend", value: "₹5.25 L", trend: { pct: 359, goodWhenUp: false } },
          { label: "Awaiting review", value: "2", note: "Optimized, ready to decide" },
        ]}
      />
    );
    expect(screen.getByRole("region", { name: "Key numbers" })).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("200%")).toHaveClass("text-success");
    expect(screen.getByText("359%")).toHaveClass("text-destructive"); // spend going up is not good
    expect(screen.getByText("Optimized, ready to decide")).toBeInTheDocument();
  });
});
