import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions, getState } from "@/lib/store";

// Logging out always asks first, from the top bar's account menu and from the sidebar's.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const { Topbar } = await import("./topbar");
const { SidebarBody } = await import("./sidebar");

beforeEach(() => {
  push.mockReset();
  actions.resetWorkspace();
  actions.login({ name: "Bhuvan Somisetty", email: "b@example.com", role: "admin", mode: "demo" });
});

async function chooseLogOut(openMenu: () => Promise<void>) {
  await openMenu();
  await userEvent.click(await screen.findByRole("menuitem", { name: /log out/i }));
}

describe("log out", () => {
  it("asks before logging out from the top bar, and Cancel keeps you signed in", async () => {
    render(<Topbar />);
    await chooseLogOut(() => userEvent.click(screen.getByText("BS")));
    expect(await screen.findByRole("alertdialog", { name: /log out\?/i })).toBeInTheDocument();
    expect(getState().session).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(getState().session).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("logs out from the sidebar only after confirming", async () => {
    render(<SidebarBody />);
    await chooseLogOut(() => userEvent.click(screen.getByRole("button", { name: /bhuvan somisetty/i })));
    const dialog = await screen.findByRole("alertdialog", { name: /log out\?/i });
    expect(getState().session).not.toBeNull();

    await userEvent.click(within(dialog).getByRole("button", { name: /^log out$/i }));
    expect(getState().session).toBeNull();
    expect(push).toHaveBeenCalledWith("/login");
  });
});

