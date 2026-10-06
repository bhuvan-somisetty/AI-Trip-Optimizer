import type { Session } from "./types";

/**
 * Thin client for the FastAPI backend (docs/07_API_Specification.md). When the API
 * isn't reachable the app falls back to workspace mode so demos never dead-end.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

class ApiUnavailable extends Error {}

async function call<T>(path: string, body: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiUnavailable();
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data as T;
}

function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/** Reads the role claim from the JWT payload; the backend has no /me endpoint. */
function roleFromToken(token: string): Session["role"] {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
    return payload.role === "admin" ? "admin" : "member";
  } catch {
    return "member";
  }
}

export async function login(email: string, password: string, name?: string): Promise<Session> {
  try {
    const { access_token } = await call<{ access_token: string }>("/auth/login", { email, password });
    return {
      name: name || nameFromEmail(email),
      email,
      role: roleFromToken(access_token),
      mode: "api",
      token: access_token,
    };
  } catch (e) {
    if (e instanceof ApiUnavailable) return { name: name || nameFromEmail(email), email, role: "admin", mode: "demo" };
    throw e;
  }
}

export async function register(name: string, email: string, password: string): Promise<Session> {
  try {
    await call("/auth/register", { email, password });
    return await login(email, password, name);
  } catch (e) {
    if (e instanceof ApiUnavailable) return { name, email, role: "admin", mode: "demo" };
    throw e;
  }
}
