import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Itinerary, Trip } from "@/lib/types";

const previewWhatIf = vi.fn();
const applyWhatIf = vi.fn();

vi.mock("@/lib/store", () => ({
  actions: { previewWhatIf: (...a: unknown[]) => previewWhatIf(...a), applyWhatIf: (...a: unknown[]) => applyWhatIf(...a) },
  useStore: () => ({ policy: {} }),
}));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const { ServerWhatIf } = await import("./whatif");

const flight = (flightNo: string, price: number) => ({
  id: `FL-${flightNo}`,
  origin: "DEL",
  destination: "BOM",
  airline: "IndiGo",
  flightNo,
  departure: "2026-12-22T06:00:00+05:30",
  price,
  cabin: "economy" as const,
  stops: 0,
});

const itinerary = (total: number, outbound = "6E101"): Itinerary => ({
  outbound: flight(outbound, 4500),
  return: flight("6E202", 5200),
  stay: { id: "HT-1", city: "BOM", name: "Sea View", pricePerNight: 3000, amenities: [] },
  nights: 3,
  rooms: 1,
  travelers: 1,
  flightCost: 9700,
  stayCost: 9000,
  totalCost: total,
  baselineCost: total + 1000,
  savings: 1000,
  savingsBasis: "valid-options",
  ledger: [],
  issues: [],
  rationale: "",
  generatedAt: "",
  runMs: 0,
  edited: false,
});

const trip = {
  id: "trip-1",
  code: "TRIP-ABC123",
  budget: 30000,
  status: "OPTIMIZED",
  filters: { cabin: "economy", maxStops: 1, minHotelRating: 3.5 },
  itinerary: itinerary(18700),
} as unknown as Trip;

beforeEach(() => {
  previewWhatIf.mockReset();
  applyWhatIf.mockReset();
});

describe("ServerWhatIf", () => {
  it("only previews once an input changes", async () => {
    render(<ServerWhatIf trip={trip} editable />);
    expect(screen.getByRole("button", { name: /preview changes/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "Non-stop" }));
    expect(screen.getByRole("button", { name: /preview changes/i })).toBeEnabled();
  });

  it("sends only the changed inputs and shows the result next to the saved one", async () => {
    previewWhatIf.mockResolvedValue({ itinerary: itinerary(21400, "AI505"), preview: { reason: null } });
    render(<ServerWhatIf trip={trip} editable />);
    await userEvent.click(screen.getByRole("radio", { name: "Non-stop" }));
    await userEvent.click(screen.getByRole("radio", { name: "4+" }));
    await userEvent.click(screen.getByRole("button", { name: /preview changes/i }));

    expect(previewWhatIf).toHaveBeenCalledWith("trip-1", { max_stops: 0, min_hotel_rating: 4 });
    const table = await screen.findByRole("table", { name: /saved itinerary compared with the preview/i });
    expect(table).toHaveTextContent("₹18,700");
    expect(table).toHaveTextContent("₹21,400");
    expect(table).toHaveTextContent("AI505");
  });

  it("removes a preference when set back to Any", async () => {
    previewWhatIf.mockResolvedValue({ itinerary: itinerary(17000), preview: { reason: null } });
    render(<ServerWhatIf trip={trip} editable />);
    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Max stops" })).getByRole("radio", { name: "Any" }));
    await userEvent.click(screen.getByRole("button", { name: /preview changes/i }));
    expect(previewWhatIf).toHaveBeenCalledWith("trip-1", { max_stops: null });
  });

  it("says why when no itinerary can be built", async () => {
    previewWhatIf.mockResolvedValue({ itinerary: undefined, preview: { reason: "No flight from DEL to BOM on 2026-12-22 meets the trip's preferences" } });
    render(<ServerWhatIf trip={trip} editable />);
    await userEvent.click(screen.getByRole("radio", { name: "Business" }));
    await userEvent.click(screen.getByRole("button", { name: /preview changes/i }));
    expect(await screen.findByText(/meets the trip's preferences/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save this instead/i })).not.toBeInTheDocument();
  });

  it("saves the previewed inputs only when asked", async () => {
    previewWhatIf.mockResolvedValue({ itinerary: itinerary(21400), preview: { reason: null } });
    applyWhatIf.mockResolvedValue(itinerary(21400));
    render(<ServerWhatIf trip={trip} editable />);
    await userEvent.click(screen.getByRole("radio", { name: "Non-stop" }));
    await userEvent.click(screen.getByRole("button", { name: /preview changes/i }));
    expect(applyWhatIf).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole("button", { name: /save this instead/i }));
    expect(applyWhatIf).toHaveBeenCalledWith("trip-1", { max_stops: 0 });
    await waitFor(() => expect(screen.queryByRole("table")).not.toBeInTheDocument());
  });

  it("can't save a preview on a decided trip", async () => {
    previewWhatIf.mockResolvedValue({ itinerary: itinerary(21400), preview: { reason: null } });
    render(<ServerWhatIf trip={trip} editable={false} />);
    await userEvent.click(screen.getByRole("radio", { name: "Non-stop" }));
    await userEvent.click(screen.getByRole("button", { name: /preview changes/i }));
    expect(await screen.findByText(/previews can't be saved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save this instead/i })).not.toBeInTheDocument();
  });
});
