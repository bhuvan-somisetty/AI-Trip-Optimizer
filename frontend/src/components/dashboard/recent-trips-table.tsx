"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TripStatusBadge } from "@/components/app/common";
import { cityByCode } from "@/lib/catalog";
import { formatDateRange, formatInr } from "@/lib/format";
import type { Trip } from "@/lib/types";

export function RecentTripsTable({ trips }: { trips: Trip[] }) {
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Trip ID</TableHead>
          <TableHead>Destination</TableHead>
          <TableHead>Travel Dates</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {trips.map((trip) => (
          <TableRow key={trip.id} className="cursor-pointer" onClick={() => router.push(`/trips/${trip.id}`)}>
            <TableCell className="font-medium text-primary">{trip.code}</TableCell>
            <TableCell>{cityByCode[trip.destination]?.name ?? trip.destination}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateRange(trip.departDate, trip.returnDate)}</TableCell>
            <TableCell>
              <TripStatusBadge trip={trip} />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {trip.itinerary ? formatInr(trip.itinerary.totalCost) : <span className="text-muted-foreground">Budget {formatInr(trip.budget)}</span>}
            </TableCell>
            <TableCell>
              <ChevronRight className="size-4 text-muted-foreground" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
