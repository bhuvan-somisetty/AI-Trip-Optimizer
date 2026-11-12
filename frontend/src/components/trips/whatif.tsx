"use client";

import { useState } from "react";
import { FlaskConical, ArrowRight, Save, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Range, Segmented } from "@/components/ui/fields";
import type { WhatIfBody } from "@/lib/api";
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
  const rows = next ? compareRows(trip, orig, next, budget) : [];

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
            <Segmented size="sm" aria-label="Priority" value={priority} onChange={setPriority} options={(Object.keys(priorityLabel) as Priority[]).map((p) => ({ value: p, label: priorityLabel[p] }))} />
          </div>
          <div className="space-y-2">
            <Label>Cabin</Label>
            <Segmented size="sm" aria-label="Cabin" value={cabin} onChange={setCabin} options={(Object.keys(cabinLabel) as CabinClass[]).map((c) => ({ value: c, label: cabinLabel[c] }))} />
          </div>
          <div className="space-y-2">
            <Label>Max stops</Label>
            <Segmented size="sm" aria-label="Max stops" value={maxStops} onChange={(v) => setMaxStops(v as 0 | 1 | 2)} options={[{ value: 0, label: "Non-stop" }, { value: 1, label: "≤ 1" }, { value: 2, label: "≤ 2" }]} />
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
            <CompareTable rows={rows} />
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

type Row = { label: string; a: string; b: string; better?: boolean | null };

const savingsLabel = (it: Itinerary) => (it.savingsBasis === "valid-options" ? "Savings" : "Savings vs typical");

/** The saved itinerary and the preview, line by line; `better` colours a changed number. */
function compareRows(trip: Trip, orig: Itinerary, next: Itinerary, budget: number): Row[] {
  const flight = (f: Itinerary["outbound"] | null) => (f ? `${f.airline} ${f.flightNo} · ${formatTime(f.departure)}` : "None found");
  const errors = (it: Itinerary) => it.issues.filter((i) => i.severity === "error").length;
  const warnings = (it: Itinerary) => it.issues.filter((i) => i.severity === "warning").length;
  return [
    { label: "Outbound", a: flight(orig.outbound), b: flight(next.outbound) },
    ...(orig.return || next.return ? [{ label: "Return", a: flight(orig.return), b: flight(next.return) }] : []),
    { label: "Stay", a: orig.stay?.name ?? "—", b: next.stay?.name ?? "—" },
    { label: "Cabin", a: cabinLabel[orig.outbound.cabin], b: cabinLabel[next.outbound.cabin] },
    { label: "Budget", a: formatInr(trip.budget), b: formatInr(budget) },
    { label: "Total cost", a: formatInr(orig.totalCost), b: formatInr(next.totalCost), better: next.totalCost === orig.totalCost ? null : next.totalCost < orig.totalCost },
    { label: savingsLabel(next), a: formatInr(orig.savings ?? 0), b: formatInr(next.savings ?? 0), better: next.savings === orig.savings ? null : (next.savings ?? 0) > (orig.savings ?? 0) },
    { label: "Blocking issues", a: String(errors(orig)), b: String(errors(next)), better: errors(next) === errors(orig) ? null : errors(next) < errors(orig) },
    { label: "Warnings", a: String(warnings(orig)), b: String(warnings(next)) },
  ];
}

function CompareTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border" role="table" aria-label="Saved itinerary compared with the preview">
      <div role="row" className="grid grid-cols-[110px_1fr_24px_1fr] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[150px_1fr_24px_1fr]">
        <span role="columnheader" />
        <span role="columnheader">Saved itinerary</span>
        <span />
        <span role="columnheader">Preview</span>
      </div>
      {rows.map((r) => {
        const diff = r.a !== r.b;
        return (
          <div key={r.label} role="row" className={cn("grid grid-cols-[110px_1fr_24px_1fr] items-center gap-2 border-b px-3 py-2.5 text-sm last:border-0 sm:grid-cols-[150px_1fr_24px_1fr]", diff && "bg-primary/[0.04]")}>
            <span role="rowheader" className="text-xs text-muted-foreground">{r.label}</span>
            <span role="cell" className={cn("min-w-0 truncate", diff && "text-muted-foreground line-through decoration-muted-foreground/40")}>{r.a}</span>
            <ArrowRight aria-hidden className={cn("size-3.5", diff ? "text-primary" : "text-muted-foreground/30")} />
            <span
              role="cell"
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
  );
}

type StopsChoice = 0 | 1 | 2 | "any";
type RatingChoice = 0 | 3 | 3.5 | 4 | 4.5;

const ratingOptions: { value: RatingChoice; label: string }[] = [
  { value: 0, label: "Any" },
  { value: 3, label: "3+" },
  { value: 3.5, label: "3.5+" },
  { value: 4, label: "4+" },
  { value: 4.5, label: "4.5+" },
];

/**
 * PRD US-011 for real accounts: the server reruns the optimizer on the trip's saved search
 * (POST /trips/{id}/preview), so a preview compares real fares with real fares and saves nothing
 * until "Save this instead" (POST /trips/{id}/preview/apply).
 */
export function ServerWhatIf({ trip, editable }: { trip: Trip; editable: boolean }) {
  const startStops: StopsChoice = trip.filters.maxStops ?? "any";
  const startRating = (ratingOptions.find((o) => o.value === trip.filters.minHotelRating)?.value ?? 0) as RatingChoice;
  const [budget, setBudget] = useState(trip.budget);
  const [cabin, setCabin] = useState<CabinClass>(trip.filters.cabin);
  const [maxStops, setMaxStops] = useState<StopsChoice>(startStops);
  const [minRating, setMinRating] = useState<RatingChoice>(startRating);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [preview, setPreview] = useState<{ it: Itinerary; body: WhatIfBody } | { error: string } | null>(null);

  const body: WhatIfBody = {};
  if (budget !== trip.budget) body.budget = budget;
  if (cabin !== trip.filters.cabin) body.cabin_class = cabin;
  if (maxStops !== startStops) body.max_stops = maxStops === "any" ? null : maxStops;
  if (minRating !== startRating) body.min_hotel_rating = minRating === 0 ? null : minRating;
  const changed = Object.keys(body).length > 0;

  async function run() {
    setBusy("preview");
    try {
      const res = await actions.previewWhatIf(trip.id, body);
      setPreview(res.itinerary ? { it: res.itinerary, body } : { error: res.preview.reason ?? "No itinerary can be built with these inputs." });
    } catch (e) {
      setPreview({ error: (e as Error).message || "Preview failed." });
    } finally {
      setBusy(null);
    }
  }

  async function save(saved: WhatIfBody) {
    setBusy("save");
    try {
      const it = await actions.applyWhatIf(trip.id, saved);
      toast("Preview saved as the itinerary", { description: `New total ${formatInr(it?.totalCost ?? 0)}. Logged to the audit trail.` });
      setPreview(null);
    } catch (e) {
      toast("Couldn't save the preview", { description: (e as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setBudget(trip.budget);
    setCabin(trip.filters.cabin);
    setMaxStops(startStops);
    setMinRating(startRating);
    setPreview(null);
  }

  const orig = trip.itinerary!;
  const next = preview && "it" in preview ? preview.it : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          What-if simulator
        </CardTitle>
        <CardDescription>
          Change the budget or a preference and preview the result next to the saved itinerary. The preview reuses this trip&apos;s search, so it compares the same real fares and hotels. Nothing is saved until you choose “Save this instead”.
        </CardDescription>
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
            <Label>Cabin</Label>
            <Segmented size="sm" aria-label="Cabin" value={cabin} onChange={setCabin} options={(Object.keys(cabinLabel) as CabinClass[]).map((c) => ({ value: c, label: cabinLabel[c] }))} />
            <p className="text-[11px] text-muted-foreground">The fare source lists economy fares only, so other cabins find no flights.</p>
          </div>
          <div className="space-y-2">
            <Label>Max stops</Label>
            <Segmented size="sm" aria-label="Max stops" value={maxStops} onChange={setMaxStops} options={[{ value: 0 as StopsChoice, label: "Non-stop" }, { value: 1 as StopsChoice, label: "≤ 1" }, { value: 2 as StopsChoice, label: "≤ 2" }, { value: "any" as StopsChoice, label: "Any" }]} />
          </div>
          <div className="space-y-2">
            <Label>Hotel rating</Label>
            <Segmented size="sm" aria-label="Hotel rating" value={minRating} onChange={setMinRating} options={ratingOptions} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={run} disabled={!changed || busy !== null}>
            {busy === "preview" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
            Preview changes
          </Button>
          {(changed || preview) && (
            <Button variant="ghost" onClick={reset} disabled={busy !== null}>
              <RotateCcw />
              Reset
            </Button>
          )}
        </div>

        <div aria-live="polite">
          {preview && "error" in preview && (
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {preview.error}
            </div>
          )}

          {next && preview && "body" in preview && (
            <div className="space-y-4">
              <CompareTable rows={compareRows(trip, orig, next, preview.body.budget ?? trip.budget)} />
              {editable ? (
                <Button onClick={() => save(preview.body)} disabled={busy !== null}>
                  {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
                  Save this instead
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">This trip has been decided, so previews can&apos;t be saved.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
