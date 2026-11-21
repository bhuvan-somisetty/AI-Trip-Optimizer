import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroundOptionResponse, TransportResponse } from "@/lib/api";

const getTransport = vi.fn();

vi.mock("@/lib/api", () => ({ getTransport: (...a: unknown[]) => getTransport(...a) }));
vi.mock("@/lib/store", () => ({ useStore: () => ({ session: { token: "tok" } }) }));

const { TransportTab } = await import("./transport");

const train: GroundOptionResponse = {
  id: "GT-0",
  kind: "train",
  service: "12015 Ajmer Shatabdi",
  operator: "Indian Railways",
  from: { name: "New Delhi", code: "NDLS", time: "6:10 AM" },
  to: { name: "Jaipur Junction", code: "JP", time: "10:40 AM" },
  departs: "6:10 AM",
  arrives: "10:40 AM",
  duration_minutes: 270,
  distance_km: 303,
  changes: 0,
  legs: [],
  fare: null,
  currency: null,
  fare_label: "Not available",
  source: "Google Maps transit via SerpApi",
  data_label: "Live schedule",
};

const transport = (overrides: Partial<TransportResponse> = {}): TransportResponse => ({
  origin: "DEL",
  destination: "JAI",
  date: "2026-12-12",
  flight: {
    kind: "flight",
    service: "IndiGo 6E2011",
    departs: "07:00",
    arrives: "08:05",
    duration_minutes: 65,
    stops: 0,
    fare: 3900,
    currency: "INR",
    fare_label: "Flight fare used by the optimizer",
    source: "Google Flights via SerpApi",
    data_label: "Live",
  },
  trains: [train],
  buses: [],
  comparison: [
    { mode: "Flight", service: "IndiGo 6E2011", departs: "07:00", duration_minutes: 65, fare: 3900, currency: "INR", fare_label: "Flight fare used by the optimizer" },
    { mode: "Train", service: "12015 Ajmer Shatabdi", departs: "6:10 AM", duration_minutes: 270, fare: null, currency: null, fare_label: "Not available" },
  ],
  notice: null,
  ...overrides,
});

beforeEach(() => {
  getTransport.mockReset();
});

describe("TransportTab", () => {
  it("compares the modes and never shows a fare it doesn't have", async () => {
    getTransport.mockResolvedValue(transport());
    render(<TransportTab tripId="t1" />);
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("₹3,900");
    expect(rows[2]).toHaveTextContent("Fastest train");
    expect(rows[2]).toHaveTextContent("Not available");
    expect(rows[2]).not.toHaveTextContent("₹");
  });

  it("lists trains with their stations, times and source", async () => {
    getTransport.mockResolvedValue(transport());
    render(<TransportTab tripId="t1" />);
    expect(await screen.findByText("Indian Railways · 303 km · Direct")).toBeInTheDocument();
    expect(screen.getByText(/NDLS 6:10 AM → JP 10:40 AM/)).toHaveTextContent("4h 30m");
    expect(screen.getByText(/Schedules from Google Maps/)).toBeInTheDocument();
    expect(screen.queryByText("Buses")).not.toBeInTheDocument();
  });

  it("shows the API's notice, e.g. for trips outside India", async () => {
    getTransport.mockResolvedValue(transport({ trains: [], comparison: [transport().comparison[0]], notice: "Trains and buses are only searched within India" }));
    render(<TransportTab tripId="t1" />);
    expect(await screen.findByText("Trains and buses are only searched within India")).toBeInTheDocument();
  });
});
