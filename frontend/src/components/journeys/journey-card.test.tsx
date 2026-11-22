import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JourneyLegResponse, JourneyResponse } from "@/lib/api";
import { JourneyCard } from "./journey-card";

const leg = (over: Partial<JourneyLegResponse> = {}): JourneyLegResponse => ({
  mode: "train",
  service: "12957 Swarna Jayanti Rajdhani",
  operator: "Indian Railways",
  from: { code: "BLR", name: "Bengaluru" },
  to: { code: "JAI", name: "Jaipur" },
  departure_time: "2027-10-26T20:00:00",
  arrival_time: "2027-10-28T05:00:00",
  duration_minutes: 1980,
  stops: 0,
  layovers: [],
  fare: null,
  currency: null,
  fare_label: "Not available",
  link: null,
  source: "Google Maps transit via SerpApi",
  data_label: "Live schedule",
  fare_estimate: { low: 1130, high: 4640, currency: "INR", label: "Estimate from about 1,975 km (sleeper to AC 2-tier)" },
  ...over,
});

const train: JourneyResponse = {
  id: "J-1",
  kind: "direct",
  separate_tickets: false,
  via: [],
  modes: ["train"],
  departure_time: "2027-10-26T20:00:00",
  arrival_time: "2027-10-28T05:00:00",
  duration_minutes: 1980,
  transfers: 0,
  transfer_waits: [],
  fare: null,
  currency: null,
  fare_label: "Not available: a leg has no published fare",
  fare_estimate: { low: 1130, high: 4640, currency: "INR", label: "Estimate" },
  legs: [leg()],
};

describe("JourneyCard", () => {
  it("shows a typical range, marked as an estimate, when there is no fare", () => {
    render(<JourneyCard journey={train} />);
    expect(screen.getByText("₹1,130 – ₹4,640")).toBeInTheDocument();
    expect(screen.getByText("Typical fare, estimate")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show details/ }));
    expect(screen.getByText(/No published fare. Typically ₹1,130 – ₹4,640 per person \(estimate from about 1,975 km/)).toBeInTheDocument();
  });

  it("shows how the journey fits the budget", () => {
    render(<JourneyCard journey={{ ...train, fare: 18000, currency: "INR", fare_estimate: null }} fit={{ status: "within", label: "Within budget · ₹2,000 left" }} />);
    expect(screen.getByText("₹18,000")).toBeInTheDocument();
    expect(screen.getByText("Within budget · ₹2,000 left")).toBeInTheDocument();
    expect(screen.queryByText(/Typical fare/)).not.toBeInTheDocument();
  });
});
