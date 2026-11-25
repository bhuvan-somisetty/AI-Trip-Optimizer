"use client";

import { useState } from "react";
import { AlertTriangle, Bus, ChevronDown, Clock, ExternalLink, Plane, Ship, TrainFront, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { JourneyLegResponse, JourneyMode, JourneyResponse } from "@/lib/api";
import type { BudgetFit } from "@/lib/budget";
import { ClassFares } from "@/components/journeys/class-fares";
import { formatInr } from "@/lib/format";
import { minutesLabel } from "@/lib/geo";
import { cn } from "@/lib/utils";

export const MODE_ICON: Record<JourneyMode, LucideIcon> = { flight: Plane, train: TrainFront, bus: Bus, ferry: Ship };
export const MODE_LABEL: Record<JourneyMode, string> = { flight: "Flight", train: "Train", bus: "Bus", ferry: "Ferry" };

/** "06:40" from a local ISO date-time, with "+1" when it is a later day than `from`. */
export function clock(iso: string, from?: string) {
  const time = iso.slice(11, 16);
  if (!from) return time;
  const days = Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86400000);
  return days > 0 ? `${time} +${days}` : time;
}

export function money(amount: number, currency: string | null) {
  return !currency || currency === "INR" ? formatInr(amount) : `${currency} ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const FIT_STYLE: Record<BudgetFit["status"], string> = {
  within: "border-success/40 bg-success/10 text-success",
  over: "border-destructive/30 bg-destructive/10 text-destructive",
  unknown: "text-muted-foreground",
};

/**
 * One journey from GET /journeys: times, duration, changes and waits, the fare or why there is
 * none, a warning for separately booked legs, and every leg with its provider link.
 * A null fare is never shown as a price, and nothing is estimated.
 */
export function JourneyCard({ journey: j, badge, fit }: { journey: JourneyResponse; badge?: string; fit?: BudgetFit | null }) {
  const [open, setOpen] = useState(false);
  const first = j.legs[0];
  const last = j.legs[j.legs.length - 1];
  const route = [first.from.name, ...j.via.map((v) => v.name), last.to.name].join(" → ");
  const services = j.legs.map((l) => l.service ?? MODE_LABEL[l.mode]).join(" + ");
  return (
    <Card className={cn("gap-0 py-0", badge && "border-primary/50 shadow-sm")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex gap-1">
            {[...new Set(j.modes)].map((m) => {
              const Icon = MODE_ICON[m];
              return (
                <span key={m} className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary" title={MODE_LABEL[m]}>
                  <Icon className="size-4" />
                </span>
              );
            })}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {badge && <Badge className="font-normal">{badge}</Badge>}
              <Badge variant="secondary" className="font-normal">{j.kind === "direct" ? "Direct" : j.transfers === 1 ? "1 change" : `${j.transfers} changes`}</Badge>
              {j.legs.map((l, i) => l.data_label && <Badge key={i} variant="outline" className="font-normal">{l.data_label}</Badge>)}
              {fit && (
                <Badge variant="outline" className={cn("font-normal", FIT_STYLE[fit.status])}>
                  {fit.label}
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate font-medium">{services}</p>
            <p className="text-xs text-muted-foreground">{route}</p>
          </div>
          <div className="text-right">
            {j.fare !== null ? (
              <>
                <p className="text-lg font-semibold tabular-nums">{money(j.fare, j.currency)}</p>
                {j.travellers && j.travellers > 1 && j.fare_per_person != null && (
                  <p className="text-[11px] text-muted-foreground">{money(j.fare_per_person, j.currency)} each · {j.travellers} travellers</p>
                )}
              </>
            ) : (
              <p className="max-w-[12rem] text-xs text-muted-foreground">{j.fare_label}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold tabular-nums">
            {clock(j.departure_time)} → {clock(j.arrival_time, j.departure_time)}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" />
            {minutesLabel(j.duration_minutes)}
          </span>
          {j.transfer_waits.map((w, i) => (
            <span key={i} className="text-xs text-muted-foreground">
              {minutesLabel(w.minutes)} in {w.city.name}
            </span>
          ))}
        </div>

        {j.separate_tickets && (
          <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Separate tickets: a delay on one leg can make you miss the next, and the next operator won&apos;t rebook you.
          </p>
        )}

        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          {open ? "Hide" : "Show"} {j.legs.length > 1 ? `all ${j.legs.length} legs` : "details"}
          <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <ol className="space-y-2 border-t pt-3">
            {j.legs.map((leg, i) => (
              <Leg key={i} leg={leg} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function Leg({ leg }: { leg: JourneyLegResponse }) {
  const Icon = MODE_ICON[leg.mode];
  const from = leg.from.station ? `${leg.from.station}${leg.from.station_code ? ` (${leg.from.station_code})` : ""}` : `${leg.from.name} (${leg.from.code})`;
  const to = leg.to.station ? `${leg.to.station}${leg.to.station_code ? ` (${leg.to.station_code})` : ""}` : `${leg.to.name} (${leg.to.code})`;
  return (
    <li className="flex gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">
          {leg.service ?? MODE_LABEL[leg.mode]}
          {leg.operator && leg.operator !== leg.service && <span className="font-normal text-muted-foreground"> · {leg.operator}</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {from} {clock(leg.departure_time)} → {to} {clock(leg.arrival_time, leg.departure_time)}
          {leg.duration_minutes !== null && ` · ${minutesLabel(leg.duration_minutes)}`}
          {leg.stops > 0 && ` · ${leg.stops} stop${leg.stops > 1 ? "s" : ""}`}
        </p>
        {leg.layovers.map((l, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            Stop at {l.airport_name ?? l.airport}
            {l.minutes !== null && `, ${minutesLabel(l.minutes)}`}
            {l.overnight && " (overnight)"}
          </p>
        ))}
        <p className="text-xs">
          {leg.fare !== null ? (
            <span className="font-medium">{money(leg.fare, leg.currency)} per person</span>
          ) : (
            <span className="text-muted-foreground">{leg.fare_label ?? "Fare not available"}</span>
          )}
          {leg.source && <span className="text-muted-foreground"> · {leg.source}</span>}
        </p>
        {leg.mode === "train" && <ClassFares fares={leg.class_fares} label={leg.class_fares_label} note={leg.class_fares_note} />}
        {leg.link && (
          <a href={leg.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {leg.link_label ?? "Provider site"} <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </li>
  );
}
