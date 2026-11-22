"use client";

import { useEffect, useState } from "react";
import { Bus, ExternalLink, Loader2, Plane, RefreshCw, Ship, TrainFront } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/app/common";
import * as api from "@/lib/api";
import type { GroundOptionResponse, TransportResponse } from "@/lib/api";
import { formatDate, formatDuration, formatInr } from "@/lib/format";
import { useStore } from "@/lib/store";

/**
 * Flight, trains, buses and ferries for the trip's outbound day, side by side (GET /trips/{id}/transport).
 * A fare is shown only when the API has one; otherwise its label ("Not available"). Nothing here
 * changes the trip's prices, budget check or Trade-off Ledger.
 */
export function TransportTab({ tripId }: { tripId: string }) {
  const token = useStore().session?.token;
  const [attempt, setAttempt] = useState(0);
  const key = `${tripId}:${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: TransportResponse; error?: string }>();

  useEffect(() => {
    if (!token) return;
    let live = true;
    api.getTransport(token, tripId).then(
      (data) => live && setResult({ key, data }),
      (e) => live && setResult({ key, error: (e as Error).message })
    );
    return () => {
      live = false;
    };
  }, [token, tripId, key]);

  if (!token) {
    return (
      <Card>
        <EmptyState icon={TrainFront} title="Transport needs the server" description="Train, bus and ferry schedules come from the API. Sign in with your account to see them." />
      </Card>
    );
  }
  if (result?.key !== key) {
    return (
      <Card>
        <EmptyState icon={Loader2} className="[&_svg]:animate-spin" title="Looking up trains, buses and ferries…" description="Searching Google Maps schedules for the trip's first day, morning to night." />
      </Card>
    );
  }
  if (result.error || !result.data) {
    return (
      <Card>
        <EmptyState
          icon={TrainFront}
          title="Couldn't load transport"
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

  const x = result.data;
  const ferries = x.ferries ?? [];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {x.origin} to {x.destination} on {formatDate(x.date, { weekday: "short", day: "numeric", month: "short" })}
          </CardTitle>
          <CardDescription>
            The fastest of each way to travel. A fare is shown only when it is known.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {x.comparison.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mode</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Departs</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {x.comparison.map((row) => (
                  <TableRow key={row.mode}>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <ModeIcon mode={row.mode} />
                        {row.mode === "Flight" ? "Flight" : `Fastest ${row.mode.toLowerCase()}`}
                      </span>
                    </TableCell>
                    <TableCell>{row.service ?? "-"}</TableCell>
                    <TableCell className="tabular-nums">{row.departs ?? "-"}</TableCell>
                    <TableCell className="tabular-nums">{row.duration_minutes !== null ? formatDuration(row.duration_minutes) : "-"}</TableCell>
                    <TableCell className="text-right">
                      <Fare fare={row.fare} currency={row.currency} label={row.fare_label} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to compare for this trip yet.</p>
          )}
          {x.flight && <p className="text-xs text-muted-foreground">Flight: {x.flight.data_label === "Live" ? "live fare" : "cached fare"}{x.flight.source ? ` from ${x.flight.source}` : ""}.</p>}
          {x.notice && <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">{x.notice}</p>}
        </CardContent>
      </Card>

      <OptionList icon={TrainFront} title="Trains" options={x.trains} />
      <OptionList icon={Bus} title="Buses" options={x.buses} />
      <OptionList icon={Ship} title="Ferries" options={ferries} />
    </div>
  );
}

function OptionList({ icon: Icon, title, options }: { icon: typeof Bus; title: string; options: GroundOptionResponse[] }) {
  if (!options.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          {title}
          <span className="text-sm font-normal text-muted-foreground">({options.length})</span>
        </CardTitle>
        <CardDescription>
          Schedules from Google Maps. <Badge variant="outline" className="ml-1 font-normal">{options[0].data_label}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {options.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{o.service ?? "Unnamed service"}</p>
                <p className="text-xs text-muted-foreground">
                  {[o.operator, o.distance_km !== null ? `${o.distance_km} km` : null, o.changes > 0 ? `${o.changes} change${o.changes > 1 ? "s" : ""}` : "Direct"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-sm tabular-nums">
                  {stopLabel(o.from, o.departs)} → {stopLabel(o.to, o.arrives)}
                  {o.duration_minutes !== null && <span className="text-muted-foreground">, {formatDuration(o.duration_minutes)}</span>}
                </p>
                {o.changes > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {o.legs.map((l) => `${l.service ?? "Leg"} ${l.from.name ?? ""} to ${l.to.name ?? ""}`.trim()).join("; ")}
                  </p>
                )}
              </div>
              <div className="shrink-0 space-y-1 sm:text-right">
                <Fare fare={o.fare} currency={o.currency} label={o.fare_label} />
                {o.link && (
                  <a href={o.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {o.link_label ?? "Provider site"} <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  const Icon = mode === "Flight" ? Plane : mode === "Train" ? TrainFront : mode === "Ferry" ? Ship : Bus;
  return <Icon className="size-4 text-muted-foreground" />;
}

/** The fare and where it came from, or only the label ("Not available") when there is no fare. */
function Fare({ fare, currency, label }: { fare: number | null; currency: string | null; label: string }) {
  if (fare === null) return <span className="text-sm text-muted-foreground">{label}</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <span className="font-semibold tabular-nums">{!currency || currency === "INR" ? formatInr(fare) : `${currency} ${fare.toLocaleString("en-IN")}`}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

/** "NDLS 6:40 AM", from the station code (or name) and the time Google gave. */
function stopLabel(stop: api.TransportStop, fallbackTime: string | null) {
  return [stop.code || stop.name, stop.time ?? fallbackTime].filter(Boolean).join(" ") || "-";
}
