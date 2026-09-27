"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Trip } from "@/lib/types";

const groups = [
  { key: "approved", label: "Approved", color: "var(--color-success)", match: (t: Trip) => t.status === "DECIDED" && t.outcome === "APPROVED" },
  { key: "review", label: "Needs review", color: "var(--color-warning)", match: (t: Trip) => t.status === "OPTIMIZED" || t.status === "UNDER_REVIEW" },
  { key: "draft", label: "Draft", color: "var(--color-muted-foreground)", match: (t: Trip) => t.status === "DRAFT" || t.status === "OPTIMIZING" },
  { key: "rejected", label: "Rejected", color: "var(--color-destructive)", match: (t: Trip) => t.status === "DECIDED" && t.outcome === "REJECTED" },
  { key: "failed", label: "Failed", color: "oklch(0.65 0.2 45)", match: (t: Trip) => t.status === "OPTIMIZATION_FAILED" },
];

export function TripsByStatusChart({ trips }: { trips: Trip[] }) {
  const data = groups.map((g) => ({ ...g, count: trips.filter(g.match).length })).filter((g) => g.count > 0);
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-52 w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={62} outerRadius={90} paddingAngle={3} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
              itemStyle={{ color: "var(--color-popover-foreground)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{trips.length}</span>
          <span className="text-xs text-muted-foreground">Total Trips</span>
        </div>
      </div>

      <ul className="mt-2 w-full space-y-2.5">
        {data.map((entry) => (
          <li key={entry.key}>
            <Link href="/trips" className="flex items-center justify-between rounded-md text-sm hover:bg-muted/50">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.label}
              </span>
              <span className="font-medium tabular-nums">{entry.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
