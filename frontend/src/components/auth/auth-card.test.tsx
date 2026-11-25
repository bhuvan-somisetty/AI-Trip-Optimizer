import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const login = vi.fn();
const register = vi.fn();
const push = vi.fn();
const signedIn = vi.fn();

vi.mock("@/lib/api", () => ({
  login: (...a: unknown[]) => login(...a),
  register: (...a: unknown[]) => register(...a),
}));
vi.mock("@/lib/store", () => ({ actions: { login: (...a: unknown[]) => signedIn(...a) } }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/auth/google-sign-in", () => ({ GoogleSignIn: () => null }));

const { AuthCard, strength } = await import("./auth-card");

const session = { name: "Bhuvan Somisetty", email: "b@example.com", role: "member", mode: "api", token: "t" };

beforeEach(() => {
  login.mockReset();
  register.mockReset();
  push.mockReset();
  signedIn.mockReset();
  window.history.replaceState(null, "", "/login");
});

describe("AuthCard", () => {
  it("signs in and goes to the dashboard", async () => {
    login.mockResolvedValue(session);
    render(<AuthCard initial="signin" />);
    const card = screen.getByRole("region", { name: "Sign in" });
    await userEvent.type(within(card).getAllByLabelText("Email address")[0], "b@example.com");
    await userEvent.type(within(card).getAllByLabelText("Password")[0], "secret123");
    await userEvent.click(within(card).getByRole("button", { name: "Sign in" }));
    expect(login).toHaveBeenCalledWith("b@example.com", "secret123");
    expect(signedIn).toHaveBeenCalledWith(session);
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("refuses a short password before asking the server", async () => {
    render(<AuthCard initial="signin" />);
    await userEvent.type(screen.getAllByLabelText("Email address")[0], "b@example.com");
    await userEvent.type(screen.getAllByLabelText("Password")[0], "abc");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Password must be at least 6 characters.");
    expect(login).not.toHaveBeenCalled();
  });

  it("switches to create account, follows in the address bar, and registers", async () => {
    register.mockResolvedValue(session);
    render(<AuthCard initial="signin" />);
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(window.location.pathname).toBe("/signup");
    const card = screen.getByRole("region", { name: "Create account" });
    await userEvent.type(within(card).getByLabelText("Full name"), "Bhuvan Somisetty");
    await userEvent.type(within(card).getAllByLabelText("Email address").at(-1)!, "b@example.com");
    await userEvent.type(within(card).getAllByLabelText("Password").at(-1)!, "Trips2026!");
    expect(screen.getByText("Strong")).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Create account" }));
    expect(register).toHaveBeenCalledWith("Bhuvan Somisetty", "b@example.com", "Trips2026!");
    expect(push).toHaveBeenCalledWith("/dashboard");

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(window.location.pathname).toBe("/login");
  });

  it("keeps the hidden form out of reach of the keyboard", () => {
    render(<AuthCard initial="signup" />);
    // The sign-in form is inert while creating an account, so tabbing never lands in it.
    const signIn = screen.getAllByRole("button", { name: "Sign in", hidden: true });
    expect(signIn.some((b) => b.getAttribute("type") === "submit" && b.closest("[inert]"))).toBe(true);
    expect(screen.getByRole("heading", { name: "Create account" })).toBeVisible();
  });

  it("sends the traveller back to the page they came from", async () => {
    window.history.replaceState(null, "", "/login?next=/trips/t1");
    login.mockResolvedValue(session);
    render(<AuthCard initial="signin" />);
    await userEvent.type(screen.getAllByLabelText("Email address")[0], "b@example.com");
    await userEvent.type(screen.getAllByLabelText("Password")[0], "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(push).toHaveBeenCalledWith("/trips/t1");
  });
});

describe("strength", () => {
  it("scores length, a digit and a capital or symbol", () => {
    expect(strength("")).toBe(0);
    expect(strength("abcdef")).toBe(1);
    expect(strength("abcdefghij")).toBe(2);
    expect(strength("abcdefghi1")).toBe(3);
    expect(strength("Trips2026!")).toBe(4);
  });
});
