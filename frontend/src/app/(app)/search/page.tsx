"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Bus, Layers, Loader2, Plane, Route as RouteIcon, Search, Sparkles, TrainFront, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, Segmented } from "@/components/ui/fields";
import { EmptyState } from "@/components/app/common";
import { AirportPicker } from "@/components/trips/airport-picker";
import { JourneyCard, money } from "@/components/journeys/journey-card";
import * as api from "@/lib/api";
import type { JourneyMode, JourneyResponse, JourneysResponse } from "@/lib/api";
import { formatDate, toIsoDate, addDays } from "@/lib/format";
import { cityName, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type TabId = "all" | "flight" | "train" | "bus" | "cheaper";
const TABS: { id: TabId; label: string; icon: LucideIcon; modes: JourneyMode[] }[] = [
  { id: "all", label: "Compare all", icon: Layers, modes: ["flight", "train", "bus"] },
  { id: "flight", label: "Flights", icon: Plane, modes: ["flight"] },
  { id: "train", label: "Trains", icon: TrainFront, modes: ["train"] },
  { id: "bus", label: "Buses", icon: Bus, modes: ["bus"] },
  { id: "cheaper", label: "Cheaper routes", icon: Sparkles, modes: ["flight", "train", "bus"] },
];
type Sort = "price" | "duration" | "transfers";

const PICKS: { key: keyof JourneysResponse["recommendations"]; label: string }[] = [
  { key: "cheapest_direct", label: "Cheapest direct" },
  { key: "cheapest_connecting", label: "Cheapest connecting" },
  { key: "fastest", label: "Fastest" },
  { key: "best_value", label: "Best value" },
];

/**
 * Flights, trains and buses between two cities (GET /journeys), with a "Cheaper routes" tab that
 * also tries going through other cities. Every search is live and spends SerpApi quota, so the
 * cheaper-routes search only runs when the user presses its button.
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
  };
  const askedMode = params.get("mode");
  const [tab, setTab] = useState<TabId>(askedMode === "flight" || askedMode === "train" || askedMode === "bus" ? askedMode : "all");
  const [form, setForm] = useState(q);
  const [sort, setSort] = useState<Sort>("price");
  const [maxTransfers, setMaxTransfers] = useState<number | null>(null);
  const [maxHours, setMaxHours] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, { data?: JourneysResponse; error?: string }>>({});

  const ready = /^[A-Z]{3}$/.test(q.from) && /^[A-Z]{3}$/.test(q.to) && q.from !== q.to && q.date >= today;
  const tabDef = TABS.find((t) => t.id === tab)!;
  const key = `${tab}|${q.from}|${q.to}|${q.date}|${q.back}|${q.travellers}`;
  const current = results[key];
  // Direct searches run when the search is submitted; the cheaper-routes one waits for its button.
  const [cheaperAsked, setCheaperAsked] = useState<string | null>(null);
  const shouldRun = ready && !!token && (tab !== "cheaper" || cheaperAsked === key);

  useEffect(() => {
    if (!shouldRun || results[key] || !token) return;
    let live = true;
    api
      .searchJourneys(token, {
        origin: q.from,
        destination: q.to,
        date: q.date,
        returnDate: q.back || null,
        modes: tabDef.modes,
        vias: tab === "cheaper" ? 2 : 0,
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
    const next = new URLSearchParams({ from: form.from, to: form.to, date: form.date, travellers: String(form.travellers), mode: tab === "cheaper" ? "all" : tab });
    if (form.back) next.set("return", form.back);
    router.replace(`/search?${next}`);
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
        <p className="text-sm text-muted-foreground">Live schedules and fares. A fare is shown only when the provider publishes one.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto_1fr_10rem_10rem_6rem_auto] md:items-end">
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
            <Button type="submit" disabled={!form.from || !form.to || form.from === form.to}>
              <Search />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

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

      {!ready ? (
        <Card>
          <EmptyState icon={Search} title="Pick where and when" description="Choose two different cities and a departure date from today on, then press Search." />
        </Card>
      ) : tab === "cheaper" && cheaperAsked !== key ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title={`Is it cheaper to go through another city?`}
            description={`Tries ${cityName(q.from)} → ${cityName(q.to)} through nearby hub cities on ${formatDate(q.date)}, with real flights, trains and buses, and checks every connection against the timetable. It runs about ten live searches and can take up to a minute.`}
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
          <EmptyState icon={Loader2} className="[&_svg]:animate-spin" title="Searching live schedules…" description="This can take up to 30 seconds (a minute for cheaper routes)." />
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
            controls={<Controls sort={sort} setSort={setSort} maxTransfers={maxTransfers} setMaxTransfers={setMaxTransfers} maxHours={maxHours} setMaxHours={setMaxHours} />}
            showPicks={tab === "cheaper" || tab === "all"}
            showVias={tab === "cheaper"}
          />
          {current.data.return && (
            <Results
              title={`Return: ${current.data.return.origin.name} → ${current.data.return.destination.name}, ${formatDate(current.data.return.date)}`}
              data={current.data.return}
              sort={sort}
              maxTransfers={maxTransfers}
              maxHours={maxHours}
              showPicks={tab === "cheaper" || tab === "all"}
              showVias={tab === "cheaper"}
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/planning?from=${q.from}&to=${q.to}&date=${q.date}${q.back ? `&return=${q.back}` : ""}`}
              className={cn(buttonVariants())}
            >
              <RouteIcon />
              Plan this trip
            </Link>
            <Link href={`/destinations/${q.to}`} className={cn(buttonVariants({ variant: "outline" }))}>
              Explore {cityName(q.to)}
            </Link>
          </div>
        </div>
      )}
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
      </NativeSelect>
      <NativeSelect aria-label="Longest journey" value={String(p.maxHours ?? "")} onChange={(e) => p.setMaxHours(e.target.value === "" ? null : Number(e.target.value))} className="w-40">
        <option value="">Any length</option>
        <option value="4">Up to 4 h</option>
        <option value="8">Up to 8 h</option>
        <option value="12">Up to 12 h</option>
        <option value="24">Up to 24 h</option>
      </NativeSelect>
    </div>
  );
}

/** Sorted and filtered journeys; a journey without a fare goes after every priced one when sorting by price. */
function arrange(list: JourneyResponse[], sort: Sort, maxTransfers: number | null, maxHours: number | null) {
  const kept = list.filter((j) => (maxTransfers === null || j.transfers <= maxTransfers) && (maxHours === null || j.duration_minutes <= maxHours * 60));
  const fare = (j: JourneyResponse) => j.fare ?? Number.POSITIVE_INFINITY;
  const by: Record<Sort, (a: JourneyResponse, b: JourneyResponse) => number> = {
    price: (a, b) => fare(a) - fare(b) || a.duration_minutes - b.duration_minutes,
    duration: (a, b) => a.duration_minutes - b.duration_minutes || fare(a) - fare(b),
    transfers: (a, b) => a.transfers - b.transfers || fare(a) - fare(b),
  };
  return [...kept].sort(by[sort]);
}

function Results({ title, data, sort, maxTransfers, maxHours, controls, showPicks, showVias }: {
  title: string;
  data: JourneysResponse;
  sort: Sort;
  maxTransfers: number | null;
  maxHours: number | null;
  controls?: React.ReactNode;
  showPicks: boolean;
  showVias: boolean;
}) {
  const byId = useMemo(() => new Map(data.journeys.map((j) => [j.id, j])), [data]);
  const list = useMemo(() => arrange(data.journeys, sort, maxTransfers, maxHours), [data, sort, maxTransfers, maxHours]);
  const picked = new Map<string, string>();
  if (showPicks) PICKS.forEach((p) => data.recommendations[p.key] && !picked.has(data.recommendations[p.key]!.journey) && picked.set(data.recommendations[p.key]!.journey, p.label));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {controls}
      </div>

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
            <JourneyCard key={j.id} journey={j} badge={picked.get(j.id)} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No journey matches these filters.</p>
      )}

      <p className="text-xs text-muted-foreground">{data.method} Searched: {data.searched.map((s) => `${s.from}→${s.to} ${s.mode} (${s.error ? "failed" : s.found})`).join(", ")}.</p>
    </section>
  );
}
