"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { tripsByStatus, totalTrips } from "@/lib/mock-data";

export function TripsByStatusChart() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-52 w-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={tripsByStatus}
              dataKey="count"
              nameKey="status"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={3}
              stroke="none"
            >
              {tripsByStatus.map((entry) => (
                <Cell key={entry.status} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{totalTrips}</span>
          <span className="text-xs text-muted-foreground">Total Trips</span>
        </div>
      </div>

      <ul className="mt-2 w-full space-y-2.5">
        {tripsByStatus.map((entry) => (
          <li
            key={entry.status}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.status}
            </span>
            <span className="font-medium">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
