"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Hotel, Loader2, MapPinned, RefreshCw, Route as RouteIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/fields";
import { EmptyState } from "@/components/app/common";
import * as api from "@/lib/api";
import type { RouteResponse, RouteWeight } from "@/lib/api";
import { minutesLabel } from "@/lib/geo";
import { useStore } from "@/lib/store";

// Leaflet touches `window` when it loads, so the map only renders in the browser.
const RouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-xl border bg-muted lg:h-full lg:min-h-[480px]" />,
});

const STOP_CHOICES = [3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Shortest road routes from the trip's hotel to its top attractions (GET /trips/{id}/route), by
 * road distance or by estimated driving time. Times are estimates from speed limits and typical
 * road speeds, not live traffic, and are labelled so.
 * Nothing here changes the trip's prices, budget check or Trade-off Ledger.
 */
export function RouteTab({ tripId }: { tripId: string }) {
  const token = useStore().session?.token;
  const [stops, setStops] = useState(6);
  const [weight, setWeight] = useState<RouteWeight>("distance");
  const [attempt, setAttempt] = useState(0);
  const key = `${tripId}:${stops}:${weight}:${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: RouteResponse; error?: string }>();

  useEffect(() => {
    if (!token) return;
    let live = true;
    // The default (distance) call keeps its three-argument form.
    (weight === "distance" ? api.getRoute(token, tripId, stops) : api.getRoute(token, tripId, stops, weight)).then(
      (data) => live && setResult({ key, data }),
      (e) => live && setResult({ key, error: (e as Error).message })
    );
    return () => {
      live = false;
    };
  }, [token, tripId, stops, weight, key]);

  if (!token) {
    return (
      <Card>
        <EmptyState icon={MapPinned} title="Routes need the server" description="Road routes come from the API. Sign in with your account to see them." />
      </Card>
    );
  }

  const loading = result?.key !== key;
  const route = loading ? undefined : result.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Route from the hotel</CardTitle>
        <CardDescription>The trip&apos;s hotel to its top attractions, nearest by road next.</CardDescription>
        <div className="flex items-center gap-2 pt-2">
          <label htmlFor="route-stops" className="text-sm text-muted-foreground">
            Stops
          </label>
          <NativeSelect id="route-stops" value={String(stops)} onChange={(e) => setStops(Number(e.target.value))} className="w-24" disabled={loading}>
            {STOP_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
          <label htmlFor="route-weight" className="ml-3 text-sm text-muted-foreground">
            Shortest by
          </label>
          <NativeSelect id="route-weight" value={weight} onChange={(e) => setWeight(e.target.value as RouteWeight)} className="w-32" disabled={loading}>
            <option value="distance">Distance</option>
            <option value="time">Time</option>
          </NativeSelect>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <EmptyState
            icon={Loader2}
            className="[&_svg]:animate-spin"
            title="Finding the shortest roads…"
            description="The first route for a city can take up to a minute while OpenStreetMap roads are fetched. After that it loads quickly."
          />
        ) : result.error || !route ? (
          <EmptyState
            icon={MapPinned}
            title="Couldn't load the route"
            description={result.error}
            action={
              <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw />
                Try again
              </Button>
            }
          />
        ) : !route.hotel || !route.legs.length ? (
          <EmptyState icon={MapPinned} title="No route yet" description={route.notice ?? "No route could be built for this trip."} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <RouteMap key={key} route={route} />
            <RouteList route={route} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RouteList({ route }: { route: RouteResponse }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="font-normal">{route.data_label}</Badge>
        <span className="text-xs text-muted-foreground">{route.source}</span>
      </div>
      <ol className="space-y-3">
        <li className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Hotel className="size-3.5" />
          </span>
          <span className="pt-1 font-medium">{route.hotel?.name}</span>
        </li>
        {route.legs.map((leg, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
            <div className="pt-1">
              <p className="font-medium">{leg.to}</p>
              <p className="text-xs text-muted-foreground">
                {km(leg.road_m)} by road ({km(leg.straight_m)} straight) from {i === 0 ? "the hotel" : leg.from}
              </p>
              {leg.estimated_minutes !== undefined && <p className="text-xs text-muted-foreground">About {minutesLabel(leg.estimated_minutes)} by car (estimate)</p>}
            </div>
          </li>
        ))}
      </ol>
      {route.total_road_m !== null && (
        <p className="flex items-center gap-2 border-t pt-3 font-medium">
          <RouteIcon className="size-4 text-primary" />
          Total {km(route.total_road_m)} by road
          {route.total_estimated_minutes != null && <span className="font-normal text-muted-foreground">, about {minutesLabel(route.total_estimated_minutes)}</span>}
        </p>
      )}
      {!!route.unreachable.length && <p className="text-xs text-muted-foreground">No road found to: {route.unreachable.join(", ")}.</p>}
      {route.notice && <p className="text-xs text-muted-foreground">{route.notice}</p>}
      <p className="text-xs text-muted-foreground">
        Shortest road {route.weight === "time" ? "times" : "distances"} found with Dijkstra&apos;s algorithm on OpenStreetMap roads.{" "}
        {route.time_label ?? "Driving times are estimates, not live traffic."}
      </p>
      <p className="text-xs text-muted-foreground">
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          OpenStreetMap
        </a>{" "}
        contributors
      </p>
    </div>
  );
}

const km = (metres: number) => `${(metres / 1000).toFixed(1)} km`;
