"use client";

import { useState } from "react";
import { Loader2, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import type { JourneyMode, JourneyResponse, JourneysResponse } from "@/lib/api";
import { bestWithinBudget, modeSummary } from "@/lib/budget";
import { formatDuration, formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

const MODE_WORD: Record<JourneyMode, string> = { flight: "flight", train: "train", bus: "bus", ferry: "ferry" };

/** "Bus", "Flight then bus via Kadapa", with the time it takes. */
export function describe(j: JourneyResponse): string {
  const chain = j.legs.map((l) => MODE_WORD[l.mode as JourneyMode] ?? l.mode).join(" then ");
  const via = j.via.length ? ` via ${j.via.map((v) => v.name).join(", ")}` : "";
  return `${chain.charAt(0).toUpperCase()}${chain.slice(1)}${via}, ${formatDuration(j.duration_minutes)}`;
}

type Pick = { out: JourneyResponse | null; back: JourneyResponse | null; total: number | null; fits: boolean };

/** The best value way there (and back) whose fares together fit the budget; else the cheapest pair. */
export function pickForBudget(data: JourneysResponse, budget: number, valueOfTime = 300): Pick | null {
  const outs = data.journeys;
  const backs = data.return?.journeys ?? [];
  const priced = (list: JourneyResponse[]) => list.filter((j) => j.fare !== null && (!j.currency || j.currency === "INR"));
  if (!priced(outs).length) return null;
  const roundTrip = !!data.return;
  if (roundTrip && !priced(backs).length) return null;
  const score = (j: JourneyResponse) => (j.fare as number) + (valueOfTime * j.duration_minutes) / 60;
  let best: Pick | null = null;
  for (const o of priced(outs)) {
    for (const b of roundTrip ? priced(backs) : [null]) {
      const total = (o.fare as number) + (b ? (b.fare as number) : 0);
      if (total > budget) continue;
      const s = score(o) + (b ? score(b) : 0);
      const current = best && best.out ? score(best.out) + (best.back ? score(best.back) : 0) : Infinity;
      if (s < current) best = { out: o, back: b, total, fits: true };
    }
  }
  if (best) return best;
  const out = bestWithinBudget(outs, null, valueOfTime).cheapest;
  const back = roundTrip ? bestWithinBudget(backs, null, valueOfTime).cheapest : null;
  return out ? { out, back, total: (out.fare as number) + (back ? (back.fare as number) : 0), fits: false } : null;
}

/**
 * On the trip form's budget step: searches real departures (flights, trains and buses, as the trip
 * allows) once the traveller asks, and highlights the best way that fits the budget, with what it
 * leaves for the hotel. Only real fares count; nothing is estimated.
 */
export function BudgetAdvice({ token, origin, destination, date, returnDate, modes, budget, travellers }: {
  token: string;
  origin: string;
  destination: string;
  date: string;
  returnDate?: string | null;
  modes: JourneyMode[];
  budget: number;
  travellers: number;
}) {
  const key = [origin, destination, date, returnDate, modes.join(","), travellers].join("|");
  const [state, setState] = useState<{ key: string; loading?: boolean; data?: JourneysResponse; error?: string }>();
  const current = state?.key === key ? state : undefined;

  async function run() {
    setState({ key, loading: true });
    try {
      const data = await api.searchJourneys(token, { origin, destination, date, returnDate: returnDate || undefined, modes, vias: 0, travellers });
      setState({ key, data });
    } catch (e) {
      setState({ key, error: (e as Error).message });
    }
  }

  if (!budget || !origin || !destination || origin === destination) return null;
  const pick = current?.data ? pickForBudget(current.data, budget) : null;

  return (
    <div className="space-y-3">
      {!current?.data && (
        <Button type="button" variant="outline" onClick={run} disabled={current?.loading}>
          {current?.loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {current?.loading ? "Searching real fares..." : `Find the best way within ${formatInr(budget)}`}
        </Button>
      )}
      {current?.error && <p className="text-sm text-destructive">{current.error}</p>}
      {current?.data && !pick && (
        <div role="note" aria-label="Your budget" className="flex items-start gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          <Wallet className="mt-0.5 size-5 shrink-0" />
          No published fares for these routes on these days, so none can be checked against {formatInr(budget)} yet. Trains and buses often
          sell on the operator&apos;s site; the trip&apos;s Transport tab links them.
        </div>
      )}
      {pick && pick.out && (
        <div
          role="note"
          aria-label="Best for your budget"
          className={cn(
            "rounded-2xl border-2 p-4",
            pick.fits ? "border-primary/60 bg-gradient-to-br from-primary/[0.14] to-primary/[0.03]" : "border-warning/50 bg-warning/10"
          )}
        >
          <div className="flex items-start gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", pick.fits ? "bg-primary text-primary-foreground" : "bg-warning/25 text-amber-700 dark:text-warning")}>
              <Wallet className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">{pick.fits ? "Best for your budget" : "Over budget"}</p>
              <p className="text-base font-semibold">
                {describe(pick.out)} · {formatInr(pick.out.fare as number)}
              </p>
              {pick.back && (
                <p className="text-sm">
                  Back: {describe(pick.back)} · {formatInr(pick.back.fare as number)}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {pick.fits
                  ? `Your budget is ${formatInr(budget)}. This costs ${formatInr(pick.total as number)}${pick.back ? " there and back" : ""} for ${travellers === 1 ? "one traveller" : `${travellers} travellers`}, leaving ${formatInr(budget - (pick.total as number))} for the hotel and the rest.`
                  : `Your budget is ${formatInr(budget)}. Even the cheapest way costs ${formatInr(pick.total as number)}, ${formatInr((pick.total as number) - budget)} over: raise the budget or try other dates.`}
              </p>
              <p className="text-xs text-muted-foreground">Real fares for these days. The optimizer still checks the hotel and every rule when you run it.</p>
            </div>
          </div>
        </div>
      )}
      {current?.data && <Comparison data={current.data} modes={modes} budget={budget} />}
    </div>
  );
}

const MODE_LABEL: Record<JourneyMode, string> = { flight: "Flight", train: "Train", bus: "Bus", ferry: "Ferry" };

/** Each way of travel side by side: how many departures, how many fit the budget, and from what fare. */
function Comparison({ data, modes, budget }: { data: JourneysResponse; modes: JourneyMode[]; budget: number }) {
  const rows = modeSummary(data.journeys, modes, budget);
  const all = modeSummary(data.journeys, modes, null);
  return (
    <section aria-label="Compare every way" className="overflow-hidden rounded-xl border">
      <p className="border-b px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Compare every way (one way)</p>
      <ul className="divide-y">
        {rows.map((r, i) => {
          const cheapestAny = all[i].cheapestFare;
          return (
            <li key={r.mode} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{MODE_LABEL[r.mode]}</span>
              <span className="text-muted-foreground">
                {r.count === 0
                  ? "None found that day"
                  : r.cheapestFare !== null
                    ? `${r.fitting} of ${r.count} fit, from ${formatInr(r.cheapestFare)}`
                    : cheapestAny !== null
                      ? `${r.count} found, from ${formatInr(cheapestAny)}: over the budget`
                      : `${r.count} found, fare not published`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
