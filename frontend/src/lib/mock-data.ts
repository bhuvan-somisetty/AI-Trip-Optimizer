export type TripStatus = "Approved" | "In Review" | "Draft" | "Rejected";

export type Trip = {
  id: string;
  destination: string;
  travelDates: string;
  status: TripStatus;
  estimatedCost: number;
};

export const recentTrips: Trip[] = [
  { id: "TRIP-001", destination: "London", travelDates: "10 Oct - 14 Oct", status: "Approved", estimatedCost: 142500 },
  { id: "TRIP-002", destination: "Singapore", travelDates: "5 Nov - 10 Nov", status: "In Review", estimatedCost: 110000 },
  { id: "TRIP-003", destination: "New York", travelDates: "18 Dec - 25 Dec", status: "Draft", estimatedCost: 240000 },
  { id: "TRIP-004", destination: "Tokyo", travelDates: "12 Jan - 18 Jan", status: "Approved", estimatedCost: 185000 },
  { id: "TRIP-005", destination: "Dubai", travelDates: "20 Jan - 25 Jan", status: "Rejected", estimatedCost: 95000 },
];

export const tripsByStatus: { status: TripStatus; count: number; color: string }[] = [
  { status: "Approved", count: 18, color: "var(--color-success)" },
  { status: "In Review", count: 6, color: "var(--color-warning)" },
  { status: "Draft", count: 4, color: "var(--color-muted-foreground)" },
  { status: "Rejected", count: 2, color: "var(--color-destructive)" },
];

export const totalTrips = tripsByStatus.reduce((sum, s) => sum + s.count, 0);

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export const statusBadgeClass: Record<TripStatus, string> = {
  Approved: "bg-success/15 text-success border-success/20",
  "In Review": "bg-warning/15 text-warning border-warning/30",
  Draft: "bg-muted text-muted-foreground border-border",
  Rejected: "bg-destructive/15 text-destructive border-destructive/20",
};
