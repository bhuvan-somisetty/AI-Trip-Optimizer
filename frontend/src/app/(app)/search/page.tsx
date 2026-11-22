"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Bus, CalendarHeart, Layers, Loader2, PiggyBank, Plane, Route as RouteIcon, Search, Sparkles, TrainFront, Wallet, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, Segmented, Switch } from "@/components/ui/fields";
import { EmptyState } from "@/components/app/common";
import { AirportPicker } from "@/components/trips/airport-picker";
import { JourneyCard, MODE_ICON, MODE_LABEL, money } from "@/components/journeys/journey-card";
import * as api from "@/lib/api";
import type { JourneyMode, JourneyResponse, JourneysResponse } from "@/lib/api";
import { bestWithinBudget, budgetFit, fitsBudget, modeSummary, sortCost } from "@/lib/budget";
import { festivalDuring, festivalOn, type Festival } from "@/lib/festivals";
import { formatDate, formatInr, toIsoDate, addDays } from "@/lib/format";
import { minutesLabel } from "@/lib/geo";
import { cityName, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type TabId = "all" | "flight" | "train" | "bus" | "cheaper";
const GROUND: JourneyMode[] = ["flight", "train", "bus"];
const TABS: { id: TabId; label: string; icon: LucideIcon; modes: JourneyMode[] }[] = [
  { id: "all", label: "Compare all", icon: Layers, modes: GROUND },
  { id: "flight", label: "Flights", icon: Plane, modes: ["flight"] },
  { id: "train", label: "Trains", icon: TrainFront, modes: ["train"] },
  { id: "bus", label: "Buses", icon: Bus, modes: ["bus"] },
  { id: "cheaper", label: "Cheaper routes", icon: Sparkles, modes: GROUND },
];
type Sort = "price" | "duration" | "transfers";
type CheaperBy = "flight" | "all";
type Stops = 1 | 2;

const PICKS: { key: keyof JourneysResponse["recommendations"]; label: string }[] = [
  { key: "cheapest_direct", label: "Cheapest direct" },
  { key: "cheapest_connecting", label: "Cheapest connecting" },
  { key: "fastest", label: "Fastest" },
  { key: "best_value", label: "Best value" },
];

/** Via-cities tried for each choice: with two stopovers, every pair of them is tried in a row too. */
const CHEAPER_SEARCH: Record<Stops, { vias: number; viaDepth: 1 | 2; searches: number }> = {
  1: { vias: 3, viaDepth: 1, searches: 7 },
  2: { vias: 4, viaDepth: 2, searches: 15 },
};

/**
 * Flights, trains and buses between two cities (GET /journeys), with a "Cheaper routes" tab that
 * also tries going through one or two other cities, flights only by default (Bengaluru -> Goa ->
 * Delhi -> Jaipur on separate tickets can beat a festival-time direct fare). An optional budget
 * marks every option within or over it, cheapest first. Every search is live and spends SerpApi
 * quota, so the cheaper-routes search only runs when the user presses its button.
 */
export default function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = useStore().session?.token;
  const today = toIsoDate(new Date());

  const q = {
    from: (params.get("from") ?? "").toUpperCase(),
    to: (params.get("to") ?? "").toUpperCase(),
    date: params.get("date") ?? toIsoDate(addDays(new Date(), 14)),
    back: params.get("return") ?? "",
    travellers: Math.min(9, Math.max(1, Number(params.get("travellers")) || 1)),
    budget: Math.max(0, Number(params.get("budget")) || 0) || null,
  };
  const askedMode = params.get("mode");
  const rush = festivalDuring(q.date) ?? (q.back ? festivalOn(q.back) : null);
  const [tab, setTab] = useState<TabId>(askedMode === "flight" || askedMode === "train" || askedMode === "bus" || askedMode === "cheaper" ? askedMode : "all");
  const [form, setForm] = useState({ ...q, budget: q.budget ? String(q.budget) : "" });
  const [sort, setSort] = useState<Sort>("price");
  const [maxTransfers, setMaxTransfers] = useState<number | null>(null);
  const [maxHours, setMaxHours] = useState<number | null>(null);
  const [onlyBudget, setOnlyBudget] = useState(false);
  const [cheaperBy, setCheaperBy] = useState<CheaperBy>("flight");
  const [stops, setStops] = useState<Stops>(rush ? 2 : 1);
  // Cities the traveller wants to go through, in order (e.g. Goa then Bhubaneswar); empty = pick hubs.
  const [ownVias, setOwnVias] = useState<string[]>(["", ""]);
  const via = ownVias.filter((c) => /^[A-Z]{3}$/.test(c) && c !== q.from && c !== q.to);
  const [results, setResults] = useState<Record<string, { data?: JourneysResponse; error?: string }>>({});

  const ready = /^[A-Z]{3}$/.test(q.from) && /^[A-Z]{3}$/.test(q.to) && q.from !== q.to && q.date >= today;
  const tabDef = TABS.find((t) => t.id === tab)!;
  const cheaper = tab === "cheaper";
  const modes = cheaper && cheaperBy === "flight" ? (["flight"] as JourneyMode[]) : tabDef.modes;
  const key = `${tab}|${q.from}|${q.to}|${q.date}|${q.back}|${q.travellers}${cheaper ? `|${cheaperBy}|${via.length ? via.join(">") : stops}` : ""}`;
  const current = results[key];
  // Direct searches run when the search is submitted; the cheaper-routes one waits for its button.
  const [cheaperAsked, setCheaperAsked] = useState<string | null>(null);
  const shouldRun = ready && !!token && (!cheaper || cheaperAsked === key);

  useEffect(() => {
    if (!shouldRun || results[key] || !token) return;
    let live = true;
    api
      .searchJourneys(token, {
        origin: q.from,
        destination: q.to,
        date: q.date,
        returnDate: q.back || null,
        modes,
        vias: cheaper ? CHEAPER_SEARCH[stops].vias : 0,
        viaDepth: cheaper ? CHEAPER_SEARCH[stops].viaDepth : 1,
        via: cheaper && via.length ? via : undefined,
        travellers: q.travellers,
      })
      .then(
        (data) => live && setResults((r) => ({ ...r, [key]: { data } })),
        (e) => live && setResults((r) => ({ ...r, [key]: { error: (e as Error).message } }))
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input of the search
  }, [shouldRun, key, token]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams({ from: form.from, to: form.to, date: form.date, travellers: String(form.travellers), mode: tab });
    if (form.back) next.set("return", form.back);
    const budget = Math.round(Number(form.budget));
    if (budget > 0) next.set("budget", String(budget));
    router.replace(`/search?${next}`);
  }

  function cheaperFlights() {
    setTab("cheaper");
    setCheaperBy("flight");
    setStops(2);
  }

  if (!token) {
    return (
      <Card className="mx-auto max-w-3xl">
        <EmptyState icon={Search} title="Search needs the server" description="Live flights, trains and buses come from the API. Sign in with your account to search." />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Flights, trains and buses</h1>
        <p className="text-sm text-muted-foreground">
          Live schedules and fares, cheapest first. Add a budget to see what fits it. A fare is shown only when the provider publishes one; trains and buses without one get a
          typical range, marked as an estimate.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto_1fr_9.5rem_9.5rem_5rem_8rem_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="search-from">From</Label>
              <AirportPicker id="search-from" value={form.from} exclude={form.to} onChange={(code) => setForm((f) => ({ ...f, from: code }))} />
            </div>
            <Button type="button" variant="outline" size="icon" aria-label="Swap" className="mx-auto" onClick={() => setForm((f) => ({ ...f, from: f.to, to: f.from }))}>
              <ArrowLeftRight />
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="search-to">To</Label>
              <AirportPicker id="search-to" value={form.to} exclude={form.from} onChange={(code) => setForm((f) => ({ ...f, to: code }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search-date">Departure</Label>
              <Input id="search-date" type="date" min={today} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search-return">Return (optional)</Label>
              <Input id="search-return" type="date" min={form.date} value={form.back} onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search-travellers">Travellers</Label>
              <NativeSelect id="search-travellers" value={String(form.travellers)} onChange={(e) => setForm((f) => ({ ...f, travellers: Number(e.target.value) }))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search-budget">Budget (₹, optional)</Label>
              <Input
                id="search-budget"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                placeholder="Any"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                className="h-9"
              />
            </div>
            <Button type="submit" disabled={!form.from || !form.to || form.from === form.to}>
              <Search />
              Search
            </Button>
          </form>
          {q.budget && (
            <p className="mt-3 text-xs text-muted-foreground">
              Budget {formatInr(q.budget)} for {q.travellers === 1 ? "one traveller" : `all ${q.travellers} travellers`}
              {q.back ? ", each way" : ""}.
            </p>
          )}
        </CardContent>
      </Card>

      {ready && rush && <FestivalNotice festival={rush} onCheaper={cheaperFlights} showButton={!(cheaper && cheaperBy === "flight" && stops === 2)} />}

      <div className="scrollbar-thin -mx-1 overflow-x-auto border-b px-1">
        <div className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium", tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <t.icon className="size-4" />
              {t.label}
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>

      {cheaper && ready && (
        <CheaperOptions by={cheaperBy} setBy={setCheaperBy} stops={stops} setStops={setStops} ownVias={ownVias} setOwnVias={setOwnVias} from={q.from} to={q.to} />
      )}

      {!ready ? (
        <Card>
          <EmptyState icon={Search} title="Pick where and when" description="Choose two different cities and a departure date from today on, then press Search." />
        </Card>
      ) : cheaper && cheaperAsked !== key ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Is it cheaper to go through other cities?"
            description={
              via.length
                ? `Tries ${[cityName(q.from), ...via.map(cityName), cityName(q.to)].join(" → ")} on ${formatDate(q.date)} (and each of your cities on its own), with real ${cheaperBy === "flight" ? "flights" : "flights, trains and buses"} booked as separate tickets, against going direct. Every connection is checked against the timetable. It runs about ${1 + 2 * via.length + (via.length * (via.length - 1)) / 2} live searches${cheaperBy === "flight" ? "" : " of each kind"}.`
                : `Tries ${cityName(q.from)} → ${cityName(q.to)} on ${formatDate(q.date)} through ${stops === 2 ? "one or two" : "one"} of the big hub cities near the way, with real ${cheaperBy === "flight" ? "flights" : "flights, trains and buses"} booked as separate tickets, and checks every connection against the timetable. It runs about ${CHEAPER_SEARCH[stops].searches * (cheaperBy === "flight" ? 1 : 2)} live searches and can take up to a minute.`
            }
            action={
              <Button onClick={() => setCheaperAsked(key)}>
                <Sparkles />
                Find cheaper routes
              </Button>
            }
          />
        </Card>
      ) : !current ? (
        <Card>
          <EmptyState icon={Loader2} className="[&_svg]:animate-spin" title="Searching live schedules…" description="This can take up to 30 seconds (a minute or two for cheaper routes)." />
        </Card>
      ) : current.error || !current.data ? (
        <Card>
          <EmptyState icon={Search} title="The search didn't work" description={current.error} />
        </Card>
      ) : (
        <div className="space-y-8">
          <Results
            title={`${current.data.origin.name} → ${current.data.destination.name}, ${formatDate(current.data.date)}`}
            data={current.data}
            sort={sort}
            maxTransfers={maxTransfers}
            maxHours={maxHours}
            budget={q.budget}
            onlyBudget={onlyBudget}
            modes={modes}
            controls={
              <Controls
                sort={sort}
                setSort={setSort}
                maxTransfers={maxTransfers}
                setMaxTransfers={setMaxTransfers}
                maxHours={maxHours}
                setMaxHours={setMaxHours}
                budget={q.budget}
                onlyBudget={onlyBudget}
                setOnlyBudget={setOnlyBudget}
              />
            }
            showPicks={cheaper || tab === "all"}
            showVias={cheaper}
          />
          {current.data.return && (
            <Results
              title={`Return: ${current.data.return.origin.name} → ${current.data.return.destination.name}, ${formatDate(current.data.return.date)}`}
              data={current.data.return}
              sort={sort}
              maxTransfers={maxTransfers}
              maxHours={maxHours}
              budget={q.budget}
              onlyBudget={onlyBudget}
              modes={modes}
              showPicks={cheaper || tab === "all"}
              showVias={cheaper}
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/planning?from=${q.from}&to=${q.to}&date=${q.date}${q.back ? `&return=${q.back}` : ""}&mode=${tab === "cheaper" ? "flight" : tab}`}
              className={cn(buttonVariants())}
            >
              <RouteIcon />
              Plan this trip
            </Link>
            <Link href={`/destinations/${q.to}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Explore {cityName(q.to)}: places, forts, food and day trips
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FestivalNotice({ festival: f, onCheaper, showButton }: { festival: Festival; onCheaper: () => void; showButton: boolean }) {
  return (
    <div role="note" className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
      <CalendarHeart className="size-5 shrink-0 text-amber-700 dark:text-warning" />
      <div className="min-w-0 flex-1 space-y-0.5 text-sm">
        <p className="font-semibold">
          {f.name} rush: {formatDate(f.from, { day: "numeric", month: "short" })} to {formatDate(f.to, { day: "numeric", month: "short" })}
        </p>
        <p className="text-muted-foreground">
          Direct flights usually cost much more around now{f.region ? `, most of all to and from ${f.region}` : ""}. Flying through one or two other cities on separate
          tickets is often cheaper, and so is leaving a few days before or after the rush.
        </p>
      </div>
      {showButton && (
        <Button size="sm" onClick={onCheaper} className="shrink-0">
          <Sparkles />
          Find cheaper flight routes
        </Button>
      )}
    </div>
  );
}

function CheaperOptions(p: {
  by: CheaperBy;
  setBy: (v: CheaperBy) => void;
  stops: Stops;
  setStops: (v: Stops) => void;
  ownVias: string[];
  setOwnVias: (v: string[]) => void;
  from: string;
  to: string;
}) {
  const own = p.ownVias.some(Boolean);
  const setVia = (i: number, code: string) => p.setOwnVias(p.ownVias.map((c, j) => (j === i ? code : c)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<CheaperBy>
          size="sm"
          aria-label="Travel by"
          value={p.by}
          onChange={p.setBy}
          options={[
            { value: "flight", label: "Flights only" },
            { value: "all", label: "Flights, trains and buses" },
          ]}
        />
        {!own && (
          <Segmented<Stops>
            size="sm"
            aria-label="Stopover cities"
            value={p.stops}
            onChange={p.setStops}
            options={[
              { value: 1, label: "Through 1 city" },
              { value: 2, label: "Through up to 2 cities" },
            ]}
          />
        )}
      </div>
      <div className="rounded-xl border p-3">
        <p className="text-sm font-medium">Or go through cities you choose</p>
        <p className="mb-2 text-xs text-muted-foreground">
          In order, for example Goa then Bhubaneswar. Left empty, the big hub cities on the way are tried instead.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          {p.ownVias.map((code, i) => (
            <div key={i} className="space-y-1">
              <Label htmlFor={`via-${i}`} className="text-xs">
                {i === 0 ? "First stop" : "Then (optional)"}
              </Label>
              <AirportPicker id={`via-${i}`} value={code} exclude={p.from} onChange={(c) => setVia(i, c === p.to ? "" : c)} />
            </div>
          ))}
          {own && (
            <Button type="button" variant="ghost" size="sm" className="sm:mt-5" onClick={() => p.setOwnVias(["", ""])}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Controls(p: {
  sort: Sort;
  setSort: (s: Sort) => void;
  maxTransfers: number | null;
  setMaxTransfers: (n: number | null) => void;
  maxHours: number | null;
  setMaxHours: (n: number | null) => void;
  budget: number | null;
  onlyBudget: boolean;
  setOnlyBudget: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segmented<Sort>
        size="sm"
        aria-label="Sort by"
        value={p.sort}
        onChange={p.setSort}
        options={[
          { value: "price", label: "Cheapest" },
          { value: "duration", label: "Fastest" },
          { value: "transfers", label: "Fewest changes" },
        ]}
      />
      <NativeSelect aria-label="Changes" value={String(p.maxTransfers ?? "")} onChange={(e) => p.setMaxTransfers(e.target.value === "" ? null : Number(e.target.value))} className="w-40">
        <option value="">Any changes</option>
        <option value="0">Direct only</option>
        <option value="1">Up to 1 change</option>
        <option value="2">Up to 2 changes</option>
        <option value="3">Up to 3 changes</option>
      </NativeSelect>
      <NativeSelect aria-label="Longest journey" value={String(p.maxHours ?? "")} onChange={(e) => p.setMaxHours(e.target.value === "" ? null : Number(e.target.value))} className="w-40">
        <option value="">Any length</option>
        <option value="4">Up to 4 h</option>
        <option value="8">Up to 8 h</option>
        <option value="12">Up to 12 h</option>
        <option value="24">Up to 24 h</option>
      </NativeSelect>
      {p.budget && (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={p.onlyBudget} onCheckedChange={p.setOnlyBudget} aria-label="Only within budget" />
          Only within budget
        </label>
      )}
    </div>
  );
}

/**
 * Sorted and filtered journeys. "Cheapest" sorts by the fare, or by the low end of the typical
 * range for a train or bus without one; a journey with neither goes last.
 */
function arrange(list: JourneyResponse[], sort: Sort, maxTransfers: number | null, maxHours: number | null, budget: number | null = null, onlyBudget = false) {
  const kept = list.filter(
    (j) => (maxTransfers === null || j.transfers <= maxTransfers) && (maxHours === null || j.duration_minutes <= maxHours * 60) && (!onlyBudget || fitsBudget(j, budget))
  );
  const by: Record<Sort, (a: JourneyResponse, b: JourneyResponse) => number> = {
    price: (a, b) => sortCost(a) - sortCost(b) || a.duration_minutes - b.duration_minutes,
    duration: (a, b) => a.duration_minutes - b.duration_minutes || sortCost(a) - sortCost(b),
    transfers: (a, b) => a.transfers - b.transfers || sortCost(a) - sortCost(b),
  };
  return [...kept].sort(by[sort]);
}

/** ", but 8h 00m longer" for a slower cheaper route, ", and no slower" otherwise. */
function timeNote(extraMinutes: number) {
  return extraMinutes > 0 ? `, but ${minutesLabel(extraMinutes)} longer` : ", and no slower";
}

function routeOf(j: JourneyResponse) {
  return [j.legs[0].from.name, ...j.via.map((v) => v.name), j.legs[j.legs.length - 1].to.name].join(" → ");
}

function Results({ title, data, sort, maxTransfers, maxHours, budget, onlyBudget, modes, controls, showPicks, showVias }: {
  title: string;
  data: JourneysResponse;
  sort: Sort;
  maxTransfers: number | null;
  maxHours: number | null;
  budget: number | null;
  onlyBudget: boolean;
  modes: JourneyMode[];
  controls?: React.ReactNode;
  showPicks: boolean;
  showVias: boolean;
}) {
  const byId = useMemo(() => new Map(data.journeys.map((j) => [j.id, j])), [data]);
  const list = useMemo(() => arrange(data.journeys, sort, maxTransfers, maxHours, budget, onlyBudget), [data, sort, maxTransfers, maxHours, budget, onlyBudget]);
  const picked = new Map<string, string>();
  if (showPicks) PICKS.forEach((p) => data.recommendations[p.key] && !picked.has(data.recommendations[p.key]!.journey) && picked.set(data.recommendations[p.key]!.journey, p.label));

  // The headline of a cheaper-routes search: what going through other cities saves over going direct.
  const direct = data.recommendations.cheapest_direct ? byId.get(data.recommendations.cheapest_direct.journey) : undefined;
  const connecting = data.recommendations.cheapest_connecting ? byId.get(data.recommendations.cheapest_connecting.journey) : undefined;
  const saving = direct?.fare != null && connecting?.fare != null && direct.currency === connecting.currency ? direct.fare - connecting.fare : null;
  const extra = direct && connecting ? connecting.duration_minutes - direct.duration_minutes : 0;
  const withinBudget = budget ? bestWithinBudget(data.journeys, budget, data.value_of_time) : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {controls}
      </div>

      {showVias && connecting && saving !== null && (
        <Card className={cn("gap-1 py-4", saving > 0 ? "border-success/40 bg-success/5" : "")}>
          <CardHeader className="px-4">
            <CardDescription className="flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
              <PiggyBank className="size-3.5" />
              {saving > 0 ? "Cheaper than going direct" : "Going direct is cheaper on this day"}
            </CardDescription>
            <CardTitle className="text-lg">
              {saving > 0
                ? `Save ${money(saving, connecting.currency)} compared with the direct ${direct!.modes.includes("flight") ? "flight" : "option"}${timeNote(extra)}`
                : `${money(direct!.fare!, direct!.currency)} direct, ${money(-saving, connecting.currency)} less than the cheapest route through another city`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-4 text-sm text-muted-foreground">
            {saving > 0 ? (
              <>
                <p className="font-medium text-foreground">
                  {routeOf(connecting)}: {money(connecting.fare!, connecting.currency)} instead of {money(direct!.fare!, direct!.currency)}
                </p>
                <p>
                  {minutesLabel(connecting.duration_minutes)} door to door instead of {minutesLabel(direct!.duration_minutes)}
                  {connecting.transfer_waits.length ? `, changing in ${connecting.transfer_waits.map((w) => `${w.city.name} (${minutesLabel(w.minutes)})`).join(" and ")}` : ""}.{" "}
                  {connecting.legs.length} separate tickets, so leave enough time between them and pack light.
                </p>
              </>
            ) : (
              <p>Try another day, other cities, or the trains and buses.</p>
            )}
          </CardContent>
        </Card>
      )}

      {budget && (
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Your budget: {formatInr(budget)}
            </CardTitle>
            <CardDescription>
              {withinBudget?.cheapest
                ? `Cheapest within it: ${routeOf(withinBudget.cheapest)}, ${money(withinBudget.cheapest.fare!, withinBudget.cheapest.currency)} (${formatInr(budget - withinBudget.cheapest.fare!)} left).`
                : "No option with a published fare fits this budget on this day."}
              {withinBudget?.bestValue && withinBudget.bestValue.id !== withinBudget.cheapest?.id
                ? ` Best value within it: ${routeOf(withinBudget.bestValue)}, ${money(withinBudget.bestValue.fare!, withinBudget.bestValue.currency)}.`
                : ""}
            </CardDescription>
          </CardHeader>
          {modes.length > 1 && (
            <CardContent className="grid gap-2 px-4 text-sm sm:grid-cols-3">
              {modeSummary(data.journeys, modes, budget).map((m) => {
                const Icon = MODE_ICON[m.mode];
                return (
                  <div key={m.mode} className="flex items-start gap-2 rounded-lg border p-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{MODE_LABEL[m.mode]}s</p>
                      <p className="text-xs text-muted-foreground">
                        {m.count === 0
                          ? "None found on this day"
                          : `${m.fitting} of ${m.count} within budget${m.cheapestFare !== null ? `, from ${formatInr(m.cheapestFare)}` : ""}${
                              m.estimate ? `${m.cheapestFare !== null ? ";" : ","} typically ${formatInr(m.estimate.low)} – ${formatInr(m.estimate.high)} (estimate)` : ""
                            }`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      )}

      {showPicks && (
        <div className="grid gap-3 md:grid-cols-2">
          {PICKS.map((p) => {
            const rec = data.recommendations[p.key];
            const j = rec ? byId.get(rec.journey) : undefined;
            return (
              <Card key={p.key} className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardDescription className="text-xs font-medium tracking-wide uppercase">{p.label}</CardDescription>
                  <CardTitle className="text-base">{j ? (j.fare !== null ? money(j.fare, j.currency) : j.fare_label) : "Nothing found"}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 text-sm text-muted-foreground">{rec ? rec.reason : "No journey qualifies on this day."}</CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showVias && data.via_summary.length > 0 && (
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Through other cities</CardTitle>
            <CardDescription>Cheapest way through each city, booked as separate tickets, compared with going direct.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 px-4 text-sm">
            {data.via_summary.map((v) => (
              <p key={v.city.code}>
                <span className="font-medium">Via {v.city.name}:</span> <span className="text-muted-foreground">{v.note}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {data.notice && !data.journeys.length ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{data.notice}</p>
      ) : list.length ? (
        <div className="space-y-3">
          {list.map((j) => (
            <JourneyCard key={j.id} journey={j} badge={picked.get(j.id)} fit={budgetFit(j, budget)} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {onlyBudget ? "Nothing on this day fits the budget with these filters. Try Cheaper routes, another day, or a train or bus." : "No journey matches these filters."}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{data.method} Searched: {data.searched.map((s) => `${s.from}→${s.to} ${s.mode} (${s.error ? "failed" : s.found})`).join(", ")}.</p>
    </section>
  );
}
