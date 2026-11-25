import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroundOptionResponse, TransportResponse } from "@/lib/api";

const getTransport = vi.fn();

vi.mock("@/lib/api", () => ({ getTransport: (...a: unknown[]) => getTransport(...a) }));
vi.mock("@/lib/store", () => ({ useStore: () => ({ session: { token: "tok" } }), cityName: (code: string) => code }));

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

  it("shows the API's notice when Google has nothing for the route", async () => {
    const notice = "Google Maps lists no trains, buses or ferries for this route and day";
    getTransport.mockResolvedValue(transport({ trains: [], ferries: [], comparison: [transport().comparison[0]], notice }));
    render(<TransportTab tripId="t1" />);
    expect(await screen.findByText(notice)).toBeInTheDocument();
    expect(screen.queryByText("Trains")).not.toBeInTheDocument();
  });

  it("lists ferries and their comparison row, with the operator Google gives", async () => {
    const ferry: GroundOptionResponse = {
      ...train,
      id: "GT-2",
      kind: "ferry",
      service: "Dover - Calais",
      operator: "P&O Ferries",
      from: { name: "Dover", code: null, time: "8:00 AM" },
      to: { name: "Calais", code: null, time: "10:30 AM" },
      departs: "8:00 AM",
      arrives: "10:30 AM",
      duration_minutes: 90,
      distance_km: 42,
    };
    const eurostar: GroundOptionResponse = { ...train, service: "Eurostar 9014", operator: "Eurostar", distance_km: 492 };
    getTransport.mockResolvedValue(
      transport({
        trains: [eurostar],
        ferries: [ferry],
        comparison: [...transport().comparison, { mode: "Ferry", service: "Dover - Calais", departs: "8:00 AM", duration_minutes: 90, fare: null, currency: null, fare_label: "Not available" }],
      })
    );
    render(<TransportTab tripId="t1" />);
    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows[3]).toHaveTextContent("Fastest ferry");
    expect(rows[3]).toHaveTextContent("Not available");
    expect(screen.getByText("P&O Ferries · 42 km · Direct")).toBeInTheDocument();
    expect(screen.getByText(/Dover 8:00 AM → Calais 10:30 AM/)).toHaveTextContent("1h 30m");
    expect(screen.getByText("Eurostar · 492 km · Direct")).toBeInTheDocument();
  });

  it("treats a missing ferries list as empty", async () => {
    // The default response has no `ferries` field, like an API without ferry search.
    getTransport.mockResolvedValue(transport());
    render(<TransportTab tripId="t1" />);
    expect(await screen.findByText("Indian Railways · 303 km · Direct")).toBeInTheDocument();
    expect(screen.queryByText("Ferries")).not.toBeInTheDocument();
  });
  it("marks the recommended way to travel and says how each end is reached", async () => {
    getTransport.mockResolvedValue(
      transport({
        recommended: { mode: "Train", reason: "Best value: cheapest and quick enough, counting each hour of travel as Rs 300" },
        access: {
          origin: null,
          destination: {
            code: "kedarnath",
            name: "Kedarnath",
            state: "Uttarakhand",
            serves: [],
            airport: { code: "DED", name: "Jolly Grant Airport", km: 105 },
            station: null,
            bus_station: { name: "Sonprayag Parking", km: 14 },
          },
        },
      })
    );
    render(<TransportTab tripId="t1" />);
    expect(await screen.findByText("Recommended: train")).toBeInTheDocument();
    expect(screen.getByText(/counting each hour of travel as Rs 300\./)).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument(); // the badge on the train row
    expect(screen.getByText("Kedarnath, Uttarakhand")).toBeInTheDocument();
    expect(screen.getByText("Nearest airport: DED (Jolly Grant Airport), 105 km")).toBeInTheDocument();
    expect(screen.getByText("Sonprayag Parking, 14 km")).toBeInTheDocument();
  });
});
