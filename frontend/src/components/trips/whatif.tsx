"use client";

import { useState } from "react";
import { FlaskConical, ArrowRight, Save, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Range, Segmented } from "@/components/ui/fields";
import { actions, useStore } from "@/lib/store";
import { OptimizationError, optimize, priorityLabel } from "@/lib/optimizer";
import { cabinLabel } from "@/lib/catalog";
import { formatInr, formatTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { CabinClass, Itinerary, Priority, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

/** PRD US-011 (stretch): preview a changed input without touching the saved itinerary. */
export function WhatIf({ trip, editable }: { trip: Trip; editable: boolean }) {
  const s = useStore();
  const [budget, setBudget] = useState(trip.budget);
  const [priority, setPriority] = useState<Priority>(trip.filters.priority);
  const [cabin, setCabin] = useState<CabinClass>(trip.filters.cabin);
  const [maxStops, setMaxStops] = useState<0 | 1 | 2>(trip.filters.maxStops);
  const [preview, setPreview] = useState<{ it: Itinerary } | { error: string } | null>(null);

  const patch: Partial<Trip> = { budget, filters: { ...trip.filters, priority, cabin, maxStops } };
  const changed = budget !== trip.budget || priority !== trip.filters.priority || cabin !== trip.filters.cabin || maxStops !== trip.filters.maxStops;

  function run() {
    try {
      setPreview({ it: optimize({ ...trip, ...patch } as Trip, s.policy) });
    } catch (e) {
      setPreview({ error: e instanceof OptimizationError ? e.message : "Preview failed." });
    }
  }

  function reset() {
    setBudget(trip.budget);
    setPriority(trip.filters.priority);
    setCabin(trip.filters.cabin);
    setMaxStops(trip.filters.maxStops);
    setPreview(null);
  }

  const orig = trip.itinerary!;
  const next = preview && "it" in preview ? preview.it : null;
  const rows: { label: string; a: string; b: string; better?: boolean | null }[] = next
    ? [
        { label: "Outbound", a: `${orig.outbound.airline} ${orig.outbound.flightNo} · ${formatTime(orig.outbound.departure)}`, b: `${next.outbound.airline} ${next.outbound.flightNo} · ${formatTime(next.outbound.departure)}` },
        ...(orig.return && next.return ? [{ label: "Return", a: `${orig.return.airline} ${orig.return.flightNo} · ${formatTime(orig.return.departure)}`, b: `${next.return.airline} ${next.return.flightNo} · ${formatTime(next.return.departure)}` }] : []),
        { label: "Stay", a: orig.stay?.name ?? "—", b: next.stay?.name ?? "—" },
        { label: "Cabin", a: cabinLabel[orig.outbound.cabin], b: cabinLabel[next.outbound.cabin] },
        { label: "Budget", a: formatInr(trip.budget), b: formatInr(budget) },
        { label: "Total cost", a: formatInr(orig.totalCost), b: formatInr(next.totalCost), better: next.totalCost === orig.totalCost ? null : next.totalCost < orig.totalCost },
        { label: "Savings vs typical", a: formatInr(orig.savings), b: formatInr(next.savings), better: next.savings === orig.savings ? null : next.savings > orig.savings },
        { label: "Blocking issues", a: String(orig.issues.filter((i) => i.severity === "error").length), b: String(next.issues.filter((i) => i.severity === "error").length) },
        { label: "Warnings", a: String(orig.issues.filter((i) => i.severity === "warning").length), b: String(next.issues.filter((i) => i.severity === "warning").length) },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          What-if simulator
        </CardTitle>
        <CardDescription>Change one or more inputs and preview the result side by side. The saved itinerary is untouched until you choose “Save this instead”.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Budget</Label>
              <span className="text-sm font-semibold tabular-nums">{formatInr(budget)}</span>
            </div>
            <Range min={Math.round((trip.budget * 0.5) / 1000) * 1000} max={Math.round((trip.budget * 2) / 1000) * 1000} step={1000} value={budget} onChange={setBudget} aria-label="What-if budget" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>−50%</span>
              <span>current {formatInr(trip.budget)}</span>
              <span>+100%</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Segmented size="sm" value={priority} onChange={setPriority} options={(Object.keys(priorityLabel) as Priority[]).map((p) => ({ value: p, label: priorityLabel[p] }))} />
          </div>
          <div className="space-y-2">
            <Label>Cabin</Label>
            <Segmented size="sm" value={cabin} onChange={setCabin} options={(Object.keys(cabinLabel) as CabinClass[]).map((c) => ({ value: c, label: cabinLabel[c] }))} />
          </div>
          <div className="space-y-2">
            <Label>Max stops</Label>
            <Segmented size="sm" value={maxStops} onChange={(v) => setMaxStops(v as 0 | 1 | 2)} options={[{ value: 0, label: "Non-stop" }, { value: 1, label: "≤ 1" }, { value: 2, label: "≤ 2" }]} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={run} disabled={!changed}>
            <FlaskConical />
            Preview changes
          </Button>
          {(changed || preview) && (
            <Button variant="ghost" onClick={reset}>
              <RotateCcw />
              Reset
            </Button>
          )}
        </div>

        {preview && "error" in preview && (
          <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {preview.error}
          </div>
        )}

        {next && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[110px_1fr_24px_1fr] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[150px_1fr_24px_1fr]">
                <span />
                <span>Saved itinerary</span>
                <span />
                <span>Preview</span>
              </div>
              {rows.map((r) => {
                const diff = r.a !== r.b;
                return (
                  <div key={r.label} className={cn("grid grid-cols-[110px_1fr_24px_1fr] items-center gap-2 border-b px-3 py-2.5 text-sm last:border-0 sm:grid-cols-[150px_1fr_24px_1fr]", diff && "bg-primary/[0.04]")}>
                    <span className="text-xs text-muted-foreground">{r.label}</span>
                    <span className={cn("min-w-0 truncate", diff && "text-muted-foreground line-through decoration-muted-foreground/40")}>{r.a}</span>
                    <ArrowRight className={cn("size-3.5", diff ? "text-primary" : "text-muted-foreground/30")} />
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        diff && "font-semibold",
                        r.better === true && "text-emerald-600 dark:text-success",
                        r.better === false && "text-destructive"
                      )}
                    >
                      {r.b}
                    </span>
                  </div>
                );
              })}
            </div>
            {editable ? (
              <Button
                onClick={() => {
                  actions.applyPreview(trip.id, patch);
                  toast("Preview saved as the itinerary", { description: `New total ${formatInr(next.totalCost)}. Logged to the audit trail.` });
                  setPreview(null);
                }}
              >
                <Save />
                Save this instead
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">This trip has been decided — previews can&apos;t be saved.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
