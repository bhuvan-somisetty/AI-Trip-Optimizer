import type { ReasonCode, TripStatus } from "./types";

export function formatInr(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatCompactInr(amount: number) {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
  if (amount >= 1e3) return `₹${(amount / 1e3).toFixed(1)}K`;
  return formatInr(amount);
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-IN", opts);
}

export function formatDateRange(a: string, b: string | null) {
  const s = formatDate(a, { day: "numeric", month: "short" });
  return b ? `${s} – ${formatDate(b, { day: "numeric", month: "short", year: "numeric" })}` : `${formatDate(a)} · one-way`;
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const statusLabel: Record<TripStatus, string> = {
  DRAFT: "Draft",
  OPTIMIZING: "Optimizing",
  OPTIMIZED: "Optimized",
  UNDER_REVIEW: "Under review",
  DECIDED: "Decided",
  OPTIMIZATION_FAILED: "Failed",
};

export const statusClass: Record<TripStatus | "APPROVED" | "REJECTED", string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  OPTIMIZING: "bg-primary/10 text-primary border-primary/20",
  OPTIMIZED: "bg-sky-500/10 text-sky-600 border-sky-500/25 dark:text-sky-400",
  UNDER_REVIEW: "bg-warning/15 text-amber-700 border-warning/30 dark:text-warning",
  DECIDED: "bg-success/15 text-success border-success/20",
  APPROVED: "bg-success/15 text-emerald-700 border-success/25 dark:text-success",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  OPTIMIZATION_FAILED: "bg-destructive/10 text-destructive border-destructive/20",
};

export const reasonMeta: Record<ReasonCode, { label: string; className: string }> = {
  WINNER: { label: "Chosen", className: "bg-success/15 text-emerald-700 border-success/25 dark:text-success" },
  PRICE: { label: "Price", className: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-400" },
  BUDGET: { label: "Budget", className: "bg-destructive/10 text-destructive border-destructive/20" },
  CONSTRAINT: { label: "Constraint", className: "bg-orange-500/10 text-orange-700 border-orange-500/25 dark:text-orange-400" },
  PREFERENCE: { label: "Preference", className: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-400" },
};

export function uid(prefix = "") {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function toIsoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
