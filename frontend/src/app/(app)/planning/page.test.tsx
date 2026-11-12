import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions, getState } from "@/lib/store";

// The trip request form (PRD US-002): each step checks its own fields before moving on,
// and a saved trip starts in DRAFT.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/planning",
}));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const { default: PlanningPage } = await import("./page");

const cont = () => userEvent.click(screen.getByRole("button", { name: /continue/i }));

beforeEach(() => {
  push.mockReset();
  actions.resetWorkspace();
});

describe("trip request form", () => {
  it("needs a traveler before the trip details", async () => {
    render(<PlanningPage />);
    await cont();
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one traveler.");
  });

  it("needs a title before the flight filters", async () => {
    render(<PlanningPage />);
    await userEvent.click(screen.getByRole("button", { name: /priya nair/i }));
    await cont();
    await screen.findByLabelText(/trip title/i);
    await cont();
    expect(screen.getByRole("alert")).toHaveTextContent("Give the trip a title.");
  });

  it("saves a complete request as a DRAFT trip", async () => {
    const before = getState().trips.length;
    render(<PlanningPage />);
    await userEvent.click(screen.getByRole("button", { name: /priya nair/i }));
    await cont();
    await userEvent.type(await screen.findByLabelText(/trip title/i), "Investor day");
    // Flight filters, stay filters, then budget (pre-filled from the demo estimate), then review.
    for (let i = 0; i < 4; i++) await cont();
    await userEvent.click(await screen.findByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(getState().trips.length).toBe(before + 1));
    const trip = getState().trips[0];
    expect(trip).toMatchObject({ title: "Investor day", status: "DRAFT", origin: "BLR" });
    expect(trip.travelerIds).toHaveLength(1);
    expect(trip.budget).toBeGreaterThanOrEqual(1000);
    expect(push).toHaveBeenCalledWith(`/trips/${trip.id}`);
    expect(getState().audit[0]).toMatchObject({ type: "TRIP_CREATED", tripId: trip.id });
  });
});
