"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plane, Clock, IndianRupee, Plus, PiggyBank, ArrowRight, AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecentTripsTable } from "@/components/dashboard/recent-trips-table";
import { TripsByStatusChart } from "@/components/dashboard/trips-by-status-chart";
import { SpendChart } from "@/components/dashboard/spend-chart";
import { Reveal } from "@/components/motion/reveal";
import { AuditTimeline } from "@/components/app/audit-timeline";
import { MiniWindow } from "@/components/app/mini-window";
import { TripStatusBadge } from "@/components/app/common";
import { routeLabel, useStore } from "@/lib/store";
import { formatCompactInr, formatDateRange, formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const s = useStore();
  const [now] = useState(() => Date.now());

  const m = useMemo(() => {
    const d30 = now - 30 * 86400000;
    const d60 = now - 60 * 86400000;
    const inRange = (iso: string | undefined, a: number, b: number) => !!iso && new Date(iso).getTime() >= a && new Date(iso).getTime() < b;
    const approved = s.trips.filter((t) => t.status === "DECIDED" && t.outcome === "APPROVED");
    const pending = s.trips.filter((t) => t.status === "OPTIMIZED" || t.status === "UNDER_REVIEW");
    const spend = approved.reduce((a, t) => a + (t.itinerary?.totalCost ?? 0), 0);
    const savings = approved.reduce((a, t) => a + (t.itinerary?.savings ?? 0), 0);
    const cur = approved.filter((t) => inRange(t.decidedAt, d30, now + 1)).reduce((a, t) => a + (t.itinerary?.totalCost ?? 0), 0);
    const prev = approved.filter((t) => inRange(t.decidedAt, d60, d30)).reduce((a, t) => a + (t.itinerary?.totalCost ?? 0), 0);
    const tripsCur = s.trips.filter((t) => inRange(t.createdAt, d30, now + 1)).length;
    const tripsPrev = s.trips.filter((t) => inRange(t.createdAt, d60, d30)).length;
    const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));
    const upcoming = s.trips
      .filter((t) => t.status === "DECIDED" && t.outcome === "APPROVED" && t.departDate >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => a.departDate.localeCompare(b.departDate))
      .slice(0, 3);
    return {
      total: s.trips.length,
      pending,
      approved: approved.length,
      spend,
      savings,
      savingsPct: spend + savings > 0 ? Math.round((savings / (spend + savings)) * 100) : 0,
      spendTrend: pct(cur, prev),
      tripTrend: pct(tripsCur, tripsPrev),
      upcoming,
    };
  }, [s.trips, now]);

  const first = s.session?.name.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Reveal>
        <section className="grain relative isolate overflow-hidden rounded-[1.75rem] bg-[radial-gradient(120%_120%_at_85%_10%,#c99d71_0%,#7d5539_30%,#2b1a10_62%,#120a06_100%)] p-6 text-[#f6efe3] shadow-[0_30px_60px_-30px_rgba(20,10,4,0.6)] sm:p-9">
          <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-[#ff693d]/20 blur-3xl" />
          <div className="relative z-10 grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[11px] font-medium tracking-[0.28em] text-[#f6efe3]/60 uppercase">
                {new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="mt-3 text-4xl leading-[1.02] font-normal text-[#f6efe3] sm:text-6xl">
                {greeting()},
                <br />
                <em className="text-[#ffb08f]">{first}.</em>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#f6efe3]/70">
                {m.pending.length > 0 ? `${m.pending.length} itinerar${m.pending.length === 1 ? "y is" : "ies are"} waiting for your review.` : "Everything is reviewed, nice work."}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/planning"
                  className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-5 shadow-[0_14px_30px_-12px_rgba(255,105,61,0.8)] active:scale-[0.98]")}
                >
                  <Plus />
                  Create New Trip
                </Link>
                {m.pending.length > 0 && (
                  <Link href="/trips" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/10">
                    Open review queue
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            </div>
            <div className="hidden md:block">
              <MiniWindow className="w-40">
                {m.upcoming[0] ? (
                  <>
                    <span className="text-[9px] tracking-[0.25em] uppercase opacity-80">Next trip</span>
                    <span className="mt-1 font-heading text-lg leading-tight [text-shadow:0_1px_8px_rgba(20,40,80,0.4)]">{routeLabel(m.upcoming[0])}</span>
                    <span className="mt-1 text-[10px] opacity-90">{formatDateRange(m.upcoming[0].departDate, m.upcoming[0].returnDate)}</span>
                  </>
                ) : (
                  <span className="text-[9px] tracking-[0.25em] uppercase opacity-90">Clear skies</span>
                )}
              </MiniWindow>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal delay={0.05}>
          <StatCard label="Total Trips" value={String(m.total)} icon={Plane} trend={{ value: `${Math.abs(m.tripTrend)}%`, direction: m.tripTrend >= 0 ? "up" : "down" }} />
        </Reveal>
        <Reveal delay={0.1}>
          <StatCard label="Awaiting Review" value={String(m.pending.length)} icon={Clock} iconClassName="bg-[#172c45]/8 text-[#172c45] dark:bg-white/10 dark:text-[#e9f0f5]" hint="Optimized or under review" />
        </Reveal>
        <Reveal delay={0.15}>
          <StatCard label="Approved Spend" value={formatCompactInr(m.spend)} icon={IndianRupee} trend={{ value: `${Math.abs(m.spendTrend)}%`, direction: m.spendTrend >= 0 ? "up" : "down", positive: m.spendTrend <= 0 }} />
        </Reveal>
        <Reveal delay={0.2}>
          <StatCard label="Optimizer Savings" value={formatCompactInr(m.savings)} icon={PiggyBank} iconClassName="bg-[#9caf88]/20 text-[#4f6b3c] dark:text-[#b9cba6]" hint={`${m.savingsPct}% below ${s.session?.mode === "api" ? "a typical option that met every rule" : "typical market cost"}`} />
        </Reveal>
      </div>

      {m.pending.length > 0 && (
        <Reveal delay={0.22}>
          <Card className="border-warning/40 bg-gradient-to-r from-warning/[0.08] to-transparent py-4">
            <CardContent className="space-y-3 px-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-warning" />
                  Review queue
                </p>
                <Link href="/trips" className="text-sm font-medium text-primary hover:underline">Open all</Link>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {m.pending.slice(0, 4).map((t) => (
                  <Link key={t.id} href={`/trips/${t.id}`} className="group flex items-center gap-3 rounded-xl border bg-background p-3 transition-all hover:border-primary/40 hover:shadow-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.code} · {t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{routeLabel(t)} · {t.itinerary ? formatInr(t.itinerary.totalCost) : "-"} of {formatInr(t.budget)}</p>
                    </div>
                    <TripStatusBadge trip={t} />
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal delay={0.25} className="lg:col-span-2">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Approved spend vs savings</CardTitle>
                <CardDescription>Last 6 months, by decision date</CardDescription>
              </div>
              <Link href="/analytics" className="text-sm font-medium text-primary hover:underline">Analytics</Link>
            </CardHeader>
            <CardContent>
              <SpendChart trips={s.trips} months={6} />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={0.3}>
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Trips by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <TripsByStatusChart trips={s.trips} />
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal delay={0.35} className="lg:col-span-2">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Trips</CardTitle>
              <Link href="/trips" className="text-sm font-medium text-primary hover:underline">View All</Link>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <RecentTripsTable trips={s.trips.slice(0, 6)} />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={0.4} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming approved travel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {m.upcoming.length === 0 && <p className="text-sm text-muted-foreground">No approved trips coming up.</p>}
              {m.upcoming.map((t) => (
                <Link key={t.id} href={`/trips/${t.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-muted/60">
                  <div className="flex size-10 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="text-[10px] leading-none font-medium uppercase">{new Date(`${t.departDate}T00:00:00`).toLocaleString("en-IN", { month: "short" })}</span>
                    <span className="text-sm leading-none font-bold">{new Date(`${t.departDate}T00:00:00`).getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{routeLabel(t)}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDateRange(t.departDate, t.returnDate)}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.45}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            {s.session?.role === "admin" && (
              <Link href="/audit" className="text-sm font-medium text-primary hover:underline">Full audit trail</Link>
            )}
          </CardHeader>
          <CardContent>
            <AuditTimeline events={s.audit.slice(0, 6)} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
