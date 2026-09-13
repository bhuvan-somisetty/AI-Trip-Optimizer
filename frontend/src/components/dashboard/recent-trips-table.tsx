import { MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { recentTrips, formatInr, statusBadgeClass } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function RecentTripsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Trip ID</TableHead>
          <TableHead>Destination</TableHead>
          <TableHead>Travel Dates</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Estimated Cost</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {recentTrips.map((trip) => (
          <TableRow key={trip.id}>
            <TableCell className="font-medium text-primary">
              {trip.id}
            </TableCell>
            <TableCell>{trip.destination}</TableCell>
            <TableCell className="text-muted-foreground">
              {trip.travelDates}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={cn("font-medium", statusBadgeClass[trip.status])}
              >
                {trip.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatInr(trip.estimatedCost)}
            </TableCell>
            <TableCell>
              <button className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                <MoreHorizontal className="size-4" />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
