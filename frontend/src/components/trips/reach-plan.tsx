"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Bus, Car, Loader2, Plane, TrainFront } from "lucide-react";
import * as api from "@/lib/api";
import type { AccessRoute, RouteLeg } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TravelChoice } from "./mode-picker";

const ICON = { flight: Plane, train: TrainFront, bus: Bus, road: Car } as const;
const LABEL = { flight: "By flight", train: "By train", bus: "By bus" } as const;

/**
 * Door-to-door routes, one card per way of travel: e.g. Bengaluru to Mydukuru by flight to Kadapa
 * (CDP) and a bus or cab for the last 24 km, by train to Kamalapuram or Kadapa Junction, or by a
 * direct bus. Compare all shows every way; Flights, Trains or Buses shows that one.
 */
export function ReachRoutes({ routes, mode = "all", to, note }: { routes: AccessRoute[]; mode?: TravelChoice; to: string; note?: string }) {
  const shown = routes.filter((r) => mode === "all" || r.mode === mode);
  if (!shown.length) return null;
  return (
    <section aria-label={`How to get to ${to}`} className="space-y-3">
      <div>
        <p className="text-sm font-semibold">How to get to {to}</p>
        <p className="text-xs text-muted-foreground">
          {mode === "all" ? "Every way there, door to door. Pick the one that suits you." : "The way there, door to door."}
        </p>
      </div>
      <div className={cn("grid gap-3", shown.length > 1 && "lg:grid-cols-3")}>
        {shown.map((r) => (
          <RouteCard key={r.mode} route={r} />
        ))}
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </section>
  );
}

function RouteCard({ route: r }: { route: AccessRoute }) {
  const Icon = ICON[r.mode];
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Icon className="size-4" />
        </span>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{LABEL[r.mode]}</p>
      </div>
      <p className="mt-2 text-sm font-medium">{r.title}</p>
      <ol className="mt-2.5 space-y-1.5">
        {r.legs.map((leg, i) => (
          <Leg key={i} leg={leg} />
        ))}
      </ol>
      {r.stations && r.stations.length > 1 && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          Other stations nearby:{" "}
          {r.stations
            .slice(1)
            .map((s) => `${s.name}${s.code ? ` (${s.code})` : ""}, ${s.km} km`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function Leg({ leg }: { leg: RouteLeg }) {
  const Icon = ICON[leg.mode];
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", leg.mode === "road" ? "text-muted-foreground" : "text-primary")} />
      <span className="min-w-0">
        <span className="inline-flex flex-wrap items-center gap-1">
          {leg.from} <ArrowRight className="size-3 text-muted-foreground" /> {leg.to}
        </span>
        {leg.mode === "road" && leg.km !== undefined && (
          <span className="block text-muted-foreground">
            {leg.note ?? "Bus or cab"}, {leg.km} km
          </span>
        )}
      </span>
    </li>
  );
}

/** The routes for two trip ends, looked up as soon as both are picked (no search, so instant). */
export function ReachPlan({ origin, destination, mode }: { origin: string; destination: string; mode: TravelChoice }) {
  const key = `${origin}>${destination}`;
  const [state, setState] = useState<{ key: string; data?: api.AccessResponse; failed?: boolean }>();

  useEffect(() => {
    if (!origin || !destination || origin === destination) return;
    let live = true;
    api.getAccess(origin, destination).then(
      (data) => live && setState({ key, data }),
      () => live && setState({ key, failed: true })
    );
    return () => {
      live = false;
    };
  }, [origin, destination, key]);

  if (!origin || !destination || origin === destination || state?.failed) return null;
  if (state?.key !== key || !state.data) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Working out how to get there...
      </p>
    );
  }
  return <ReachRoutes routes={state.data.routes} mode={mode} to={state.data.destination.name} note={state.data.note} />;
}
