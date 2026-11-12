import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions, getState } from "@/lib/store";

// The review flow in the browser workspace (PRD US-007): start review, approve, reject with a reason.
const params = { id: "" };
vi.mock("next/navigation", () => ({
  useParams: () => params,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => `/trips/${params.id}`,
}));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const { default: TripDetailPage } = await import("./page");

const tripWith = (status: string) => {
  const trip = getState().trips.find((t) => t.status === status && t.itinerary);
  if (!trip) throw new Error(`no seeded ${status} trip`);
  params.id = trip.id;
  return trip;
};

const statusOf = (id: string) => getState().trips.find((t) => t.id === id)?.status;

beforeEach(() => {
  params.id = "";
  actions.resetWorkspace(); // every test starts from the same seeded trips
});

describe("trip review", () => {
  it("moves an optimized trip to review", async () => {
    const trip = tripWith("OPTIMIZED");
    render(<TripDetailPage />);
    await userEvent.click(screen.getByRole("button", { name: /start review/i }));
    await waitFor(() => expect(statusOf(trip.id)).toBe("UNDER_REVIEW"));
  });

  it("won't reject without a reason", async () => {
    const trip = tripWith("UNDER_REVIEW");
    render(<TripDetailPage />);
    await userEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /reject itinerary/i }));

    expect(await screen.findByText(/rejections must be explained/)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason for rejection/i)).toHaveAttribute("aria-invalid", "true");
    expect(statusOf(trip.id)).toBe("UNDER_REVIEW");
  });

  it("rejects with the reason stored and logged", async () => {
    const trip = tripWith("UNDER_REVIEW");
    render(<TripDetailPage />);
    await userEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    await userEvent.type(await screen.findByLabelText(/reason for rejection/i), "Meeting moved online");
    await userEvent.click(screen.getByRole("button", { name: /reject itinerary/i }));

    await waitFor(() => expect(statusOf(trip.id)).toBe("DECIDED"));
    const saved = getState().trips.find((t) => t.id === trip.id)!;
    expect(saved.outcome).toBe("REJECTED");
    expect(saved.decisionReason).toBe("Meeting moved online");
    const event = getState().audit.find((e) => e.tripId === trip.id && e.type === "DECISION");
    expect(event?.summary).toContain("Meeting moved online");
  });

  it("approves without a note and shows the trip as decided", async () => {
    const trip = tripWith("OPTIMIZED");
    render(<TripDetailPage />);
    await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /approve itinerary/i }));

    await waitFor(() => expect(statusOf(trip.id)).toBe("DECIDED"));
    expect(getState().trips.find((t) => t.id === trip.id)?.outcome).toBe("APPROVED");
    expect(await screen.findByText(/approved itineraries are final/i)).toBeInTheDocument();
    // A decided trip offers no more decisions.
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });
});
