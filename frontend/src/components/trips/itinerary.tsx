"use client";

import { AlertOctagon, AlertTriangle, Info, Plane, Hotel as HotelIcon, Star, MapPin, Luggage, RotateCcw, Sparkles, Pencil, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { amenityLabel, cabinLabel, cityByCode } from "@/lib/catalog";
import { formatDate, formatDuration, formatInr, formatTime } from "@/lib/format";
import type { Flight, Hotel, Itinerary, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CostSummary({ trip, it }: { trip: Trip; it: Itinerary }) {
  const pct = Math.round((it.totalCost / trip.budget) * 100);
  const over = it.totalCost > trip.budget;
  return (
    <Card className="overflow-hidden py-0">
      <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <Metric label="Total cost" value={formatInr(it.totalCost)} sub={`${it.travelers} traveler${it.travelers > 1 ? "s" : ""} · ${it.nights} night${it.nights > 1 ? "s" : ""}`} strong />
        <Metric label="Budget" value={formatInr(trip.budget)} sub={over ? `${formatInr(it.totalCost - trip.budget)} over` : `${formatInr(trip.budget - it.totalCost)} headroom`} tone={over ? "bad" : "good"} />
        <Metric label="Savings vs typical" value={formatInr(it.savings)} sub={`Typical market cost ${formatInr(it.baselineCost)}`} tone={it.savings > 0 ? "good" : undefined} />
        <Metric label="Options evaluated" value={String(it.ledger.length)} sub={`Pipeline ran in ${it.runMs} ms`} />
      </div>
      <div className="border-t px-5 py-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Flights {formatInr(it.flightCost)} · Stay {formatInr(it.stayCost)}
          </span>
          <span className={cn("font-medium", over ? "text-destructive" : pct > 90 ? "text-amber-600" : "text-muted-foreground")}>{pct}% of budget</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, (it.flightCost / Math.max(trip.budget, it.totalCost)) * 100)}%` }} title="Flights" />
          <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, (it.stayCost / Math.max(trip.budget, it.totalCost)) * 100)}%` }} title="Stay" />
          {over && <div className="h-full flex-1 bg-destructive/30" />}
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Flights</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-cyan-500" />Stay</span>
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value, sub, strong, tone }: { label: string; value: string; sub: string; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className="space-y-1 p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", strong && "text-primary")}>{value}</p>
      <p className={cn("text-xs", tone === "good" ? "text-emerald-600 dark:text-success" : tone === "bad" ? "text-destructive" : "text-muted-foreground")}>{sub}</p>
    </div>
  );
}

export function FlightCard({ flight, label, pax, onChange, editable }: { flight: Flight; label: string; pax: number; onChange?: () => void; editable?: boolean }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Plane className="size-3.5" />
          {label} · {formatDate(flight.departure.slice(0, 10), { weekday: "short", day: "numeric", month: "short" })}
        </CardDescription>
        <CardTitle>
          {flight.airline} <span className="font-normal text-muted-foreground">{flight.flightNo}</span>
        </CardTitle>
        {editable && onChange && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onChange}>
              <Pencil />
              Change
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{formatTime(flight.departure)}</p>
            <p className="text-sm text-muted-foreground">{flight.origin} · {cityByCode[flight.origin]?.name}</p>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{formatDuration(flight.durationMin)}</span>
            <div className="relative h-px w-full bg-border">
              {flight.stops > 0 && <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-warning" />}
            </div>
            <span className={cn("text-xs font-medium", flight.stops === 0 ? "text-emerald-600 dark:text-success" : "text-amber-600")}>{flight.stops === 0 ? "Non-stop" : `${flight.stops} stop · ${flight.via}`}</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{formatTime(flight.arrival)}</p>
            <p className="text-sm text-muted-foreground">{flight.destination} · {cityByCode[flight.destination]?.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
          <Badge variant="outline">{cabinLabel[flight.cabin]}</Badge>
          <Badge variant="outline" className="gap-1"><Luggage className="size-3" />{flight.baggageKg} kg</Badge>
          <Badge variant="outline" className={cn("gap-1", flight.refundable ? "text-emerald-700 dark:text-success" : "text-muted-foreground")}>
            <RotateCcw className="size-3" />
            {flight.refundable ? "Refundable" : "Non-refundable"}
          </Badge>
          <span className="ml-auto text-right">
            <span className="text-base font-semibold tabular-nums">{formatInr(flight.price)}</span>
            <span className="text-muted-foreground"> /traveler{pax > 1 ? ` · ${formatInr(flight.price * pax)} total` : ""}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function StayCard({ hotel, nights, rooms, onChange, editable }: { hotel: Hotel; nights: number; rooms: number; onChange?: () => void; editable?: boolean }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <HotelIcon className="size-3.5" />
          Stay · {nights} night{nights > 1 ? "s" : ""} · {rooms} room{rooms > 1 ? "s" : ""}
        </CardDescription>
        <CardTitle>{hotel.name}</CardTitle>
        {editable && onChange && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onChange}>
              <Pencil />
              Change
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1 font-medium">
            {Array.from({ length: hotel.stars }).map((_, i) => (
              <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
            ))}
          </span>
          <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-success">{hotel.rating} / 5</span>
          <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" />{hotel.area} · {hotel.distanceKm} km</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hotel.amenities.map((a) => (
            <Badge key={a} variant="secondary" className="font-normal">{amenityLabel[a] ?? a}</Badge>
          ))}
          <Badge variant="outline" className={hotel.freeCancellation ? "text-emerald-700 dark:text-success" : "text-muted-foreground"}>
            {hotel.freeCancellation ? "Free cancellation" : "Non-cancellable"}
          </Badge>
        </div>
        <div className="flex items-end justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">{formatInr(hotel.pricePerNight)} × {nights} × {rooms}</span>
          <span className="text-base font-semibold tabular-nums">{formatInr(hotel.pricePerNight * nights * rooms)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
