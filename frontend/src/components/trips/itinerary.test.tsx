import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Flight, Hotel, Itinerary, Trip } from "@/lib/types";
import { CostSummary, FlightCard, StayCard, layoverText } from "./itinerary";

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

const flight = (overrides: Partial<Flight>): Flight => ({
  id: "FL-AI501",
  origin: "BOM",
  destination: "GOI",
  airline: "Air India",
  flightNo: "AI501",
  departure: "2026-12-12T06:00:00",
  arrival: "2026-12-12T09:00:00",
  durationMin: 180,
  price: 4200,
  cabin: "economy",
  stops: 0,
  ...overrides,
});

describe("FlightCard", () => {
  it("names each connection, how long it waits and when it is overnight", () => {
    expect(layoverText([{ airport: "MAA", airportName: "Chennai International Airport", minutes: 60, overnight: false }])).toBe(
      "1 stop via MAA (Chennai International Airport), 1h 00m"
    );
    expect(
      layoverText([
        { airport: "MAA", airportName: "Chennai International Airport", minutes: 60, overnight: false },
        { airport: "HYD", minutes: 615, overnight: true },
      ])
    ).toBe("2 stops via MAA (Chennai International Airport), 1h 00m; HYD, 10h 15m, overnight");
  });

  it("shows the layover line and Google's high-fare badge with the typical range", () => {
    render(
      <FlightCard
        flight={flight({ stops: 1, layovers: [{ airport: "MAA", airportName: "Chennai International Airport", minutes: 60, overnight: false }], priceLevel: "high", typicalPriceRange: [3000, 4000], priceStatus: "live" })}
        label="Outbound"
        pax={1}
      />
    );
    expect(screen.getByText("1 stop via MAA (Chennai International Airport), 1h 00m")).toBeInTheDocument();
    expect(screen.getByText(/Fares: high for this date/)).toHaveTextContent("(typical ₹3,000 to ₹4,000)");
    expect(screen.getByText("Live fare")).toBeInTheDocument();
  });

  it("shows no fare badge when Google gave no level or a normal one", () => {
    render(<FlightCard flight={flight({ priceLevel: "typical" })} label="Outbound" pax={1} />);
    expect(screen.queryByText(/Fares: high/)).not.toBeInTheDocument();
  });
});

describe("StayCard", () => {
  const hotel: Hotel = { id: "HT-1", city: "GOI", name: "Sea View", pricePerNight: 3000, amenities: [] };

  it("shows the first photo labelled as Google's and enlarges it on click", async () => {
    render(<StayCard hotel={{ ...hotel, images: [{ thumbnail: "https://example.org/t.jpg", original: "https://example.org/o.jpg" }] }} nights={3} rooms={1} />);
    expect(screen.getByRole("img", { name: "Sea View" })).toHaveAttribute("src", "https://example.org/t.jpg");
    expect(screen.getByText("Photo: Google")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enlarge photo of Sea View" }));
    expect((await screen.findAllByRole("img", { name: "Sea View" })).some((img) => img.getAttribute("src") === "https://example.org/o.jpg")).toBe(true);
  });

  it("shows no photo when Google sent none", () => {
    render(<StayCard hotel={hotel} nights={3} rooms={1} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
