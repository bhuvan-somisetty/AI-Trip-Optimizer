"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactInr, formatInr } from "@/lib/format";
import type { Trip } from "@/lib/types";

export function monthlySpend(trips: Trip[], months: number) {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString("en-IN", { month: "short" }), spend: 0, savings: 0, trips: 0 };
  });
  for (const t of trips) {
    if (t.status !== "DECIDED" || t.outcome !== "APPROVED" || !t.decidedAt || !t.itinerary) continue;
    const d = new Date(t.decidedAt);
    const b = buckets.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (!b) continue;
    b.spend += t.itinerary.totalCost;
    b.savings += t.itinerary.savings;
    b.trips += 1;
  }
  return buckets;
}

export function SpendChart({ trips, months, height = 260 }: { trips: Trip[]; months: number; height?: number }) {
  const data = monthlySpend(trips, months);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
          <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" tickFormatter={(v) => formatCompactInr(v)} width={64} />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
            formatter={(v) => formatInr(Number(v))}
            contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "var(--color-popover-foreground)", fontWeight: 600 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="spend" name="Approved spend" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={36} />
          <Bar dataKey="savings" name="Savings" fill="var(--color-success)" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
