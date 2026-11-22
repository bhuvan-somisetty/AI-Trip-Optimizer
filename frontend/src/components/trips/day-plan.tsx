"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, Hotel, Loader2, MapPin, Plane, RefreshCw, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/common";
import * as api from "@/lib/api";
import type { DishResponse, ExploreResponse, PlaceResponse, RouteLegResponse, RouteResponse, RouteStopResponse } from "@/lib/api";
import { addDays, formatDate, formatTime } from "@/lib/format";
import { km, minutesLabel } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { Trip } from "@/lib/types";

const RouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => <div className="h-[320px] animate-pulse rounded-xl border bg-muted" />,
});

// Sightseeing time per day: a shorter first day (arrival) and last day (departure).
const FIRST_DAY_MIN = 180;
const MIDDLE_DAY_MIN = 240;
const LAST_DAY_MIN = 120;
const VISIT_MIN = 60; // time at each place
const MAX_STOPS = 10;

type Day = {
  date: string;
  stops: RouteStopResponse[];
  legs: RouteLegResponse[];
  dish?: DishResponse;
  restaurant?: PlaceResponse;
};

/**
 * Splits the route's ordered stops across the trip's days: each place costs its estimated driving
 * time plus an hour there, within a day's sightseeing time. Pure arithmetic on the route's own
 * numbers; exported so it can be checked on its own.
 */
export function splitDays(dates: string[], route: RouteResponse, explore?: ExploreResponse): Day[] {
  const days: Day[] = dates.map((date, i) => ({
    date,
    stops: [],
    legs: [],
    dish: explore?.dishes.length ? explore.dishes[i % explore.dishes.length] : undefined,
    restaurant: explore?.restaurants.length ? explore.restaurants[i % explore.restaurants.length] : undefined,
  }));
  const budget = (i: number) => (dates.length === 1 ? MIDDLE_DAY_MIN : i === 0 ? FIRST_DAY_MIN : i === dates.length - 1 ? LAST_DAY_MIN : MIDDLE_DAY_MIN);
  let day = 0;
  let used = 0;
  route.stops.forEach((stop, i) => {
    const leg = route.legs[i];
    const cost = (leg?.estimated_minutes ?? 0) + VISIT_MIN;
    while (day < days.length - 1 && used + cost > budget(day) && days[day].stops.length > 0) {
      day += 1;
      used = 0;
    }
    days[day].stops.push(stop);
    if (leg) days[day].legs.push(leg);
    used += cost;
  });
  return days;
}

/** The trip day by day: transport, sights in route order, a local dish and a restaurant. */
export function DayPlanTab({ trip }: { trip: Trip }) {
  const token = useStore().session?.token;
  const [attempt, setAttempt] = useState(0);
  const key = `${trip.id}:${attempt}`;
  const [result, setResult] = useState<{ key: string; route?: RouteResponse; explore?: ExploreResponse; error?: string }>();

  useEffect(() => {
    if (!token) return;
    let live = true;
    Promise.all([api.getRoute(token, trip.id, MAX_STOPS), api.getExplore(token, trip.id).catch(() => undefined)]).then(
      ([route, explore]) => live && setResult({ key, route, explore }),
      (e) => live && setResult({ key, error: (e as Error).message })
    );
    return () => {
      live = false;
    };
  }, [token, trip.id, key]);

  if (!token) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="The day plan needs the server" description="It is built from the route and places the API finds. Sign in with your account to see it." />
      </Card>
    );
  }
  if (result?.key !== key) {
    return (
      <Card>
        <EmptyState icon={Loader2} className="[&_svg]:animate-spin" title="Building the day-by-day plan…" description="It uses the route and places for this city; the first time can take up to a minute." />
      </Card>
    );
  }
  if (result.error || !result.route) {
    return (
      <Card>
        <EmptyState
          icon={CalendarDays}
          title="Couldn't build the plan"
          description={result.error}
          action={
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw />
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  const route = result.route;
  if (!route.hotel || !route.stops.length) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="No plan yet" description={route.notice ?? "The plan starts at the trip's hotel: optimize the trip first."} />
      </Card>
    );
  }

  const last = trip.returnDate ?? trip.departDate;
  const dates: string[] = [];
  for (let d = new Date(`${trip.departDate}T00:00:00`); dates.length < 30; d = addDays(d, 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dates.push(iso);
    if (iso >= last) break;
  }
  const days = splitDays(dates, route, result.explore);
  const it = trip.itinerary;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Day by day</CardTitle>
          <CardDescription>
            Suggested plan, built from the route and places above: each day takes the next stops in road order, about four hours of sightseeing (driving time
            estimated, plus an hour at each place). Food ideas are the destination&apos;s AI-suggested dishes and nearby restaurants. Nothing here changes the
            trip&apos;s prices.
          </CardDescription>
        </CardHeader>
      </Card>
      {days.map((day, i) => {
        const roadM = day.legs.reduce((a, l) => a + l.road_m, 0);
        const minutes = day.legs.reduce((a, l) => a + (l.estimated_minutes ?? 0), 0);
        const transport = i === 0 ? it?.outbound : i === days.length - 1 ? it?.return : null;
        return (
          <Card key={day.date}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Day {i + 1}</Badge>
                <CardTitle className="text-base">{formatDate(day.date, { weekday: "long", day: "numeric", month: "short" })}</CardTitle>
              </div>
              {day.legs.length > 0 && (
                <CardDescription>
                  {km(roadM)} by road{minutes > 0 ? `, about ${minutesLabel(minutes)} of driving (estimate)` : ""}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {transport && (
                <p className="flex items-center gap-2">
                  <Plane className="size-4 text-primary" />
                  {i === 0 ? "Arrive" : "Fly home"}: {transport.airline} {transport.flightNo}, {transport.origin} {formatTime(transport.departure)}
                  {transport.arrival ? ` → ${transport.destination} ${formatTime(transport.arrival)}` : ` → ${transport.destination}`}
                </p>
              )}
              {i === 0 && it?.stay && (
                <p className="flex items-center gap-2">
                  <Hotel className="size-4 text-primary" />
                  Check in: {it.stay.name}
                </p>
              )}
              {day.stops.length ? (
                <ol className="space-y-1.5">
                  {day.stops.map((s, n) => (
                    <li key={s.order} className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="font-medium">{s.name}</span>
                        {s.category && <span className="text-muted-foreground"> · {s.category}</span>}
                        {day.legs[n] && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            ({km(day.legs[n].road_m)}
                            {day.legs[n].estimated_minutes !== undefined ? `, ~${minutesLabel(day.legs[n].estimated_minutes!)}` : ""} from {day.legs[n].from})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">{i === days.length - 1 ? "Departure day: no sightseeing planned." : "A free day: no more stops on the route."}</p>
              )}
              {(day.dish || day.restaurant) && (
                <p className="flex items-start gap-2">
                  <UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    {day.dish && (
                      <>
                        Try <span className="font-medium">{day.dish.name}</span> <span className="text-xs text-muted-foreground">({day.dish.data_label})</span>
                      </>
                    )}
                    {day.dish && day.restaurant && "; "}
                    {day.restaurant && (
                      <>
                        eat at <span className="font-medium">{day.restaurant.name}</span>
                        {day.restaurant.cuisine && <span className="text-muted-foreground"> ({day.restaurant.cuisine})</span>}
                      </>
                    )}
                  </span>
                </p>
              )}
              {day.legs.length > 0 && <RouteMap route={{ ...route, stops: day.stops, legs: day.legs }} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
