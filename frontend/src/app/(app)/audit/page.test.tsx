import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actions } from "@/lib/store";
import type { Session } from "@/lib/types";

// The full audit trail is an admin view: admins get it in the sidebar's Admin section and can
// open the page; members see neither.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const { default: AuditPage } = await import("./page");
const { SidebarBody } = await import("@/components/dashboard/sidebar");

const signIn = (role: Session["role"]) => actions.login({ name: "Bhuvan", email: "b@example.com", role, mode: "demo" });

beforeEach(() => {
  actions.resetWorkspace();
});

describe("audit trail access", () => {
  it("is listed under Admin for admins", () => {
    signIn("admin");
    render(<SidebarBody />);
    expect(screen.getByRole("link", { name: /audit trail/i })).toHaveAttribute("href", "/audit");
  });

  it("is not listed for members", () => {
    signIn("member");
    render(<SidebarBody />);
    expect(screen.queryByRole("link", { name: /audit trail/i })).not.toBeInTheDocument();
  });

  it("shows the trail to admins", () => {
    signIn("admin");
    render(<AuditPage />);
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("tells members it is for admins", () => {
    signIn("member");
    render(<AuditPage />);
    expect(screen.getByText("Admins only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export csv/i })).not.toBeInTheDocument();
  });
});
