"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RecentTripsTable } from "@/components/dashboard/recent-trips-table";
import { TripsByStatusChart } from "@/components/dashboard/trips-by-status-chart";
import { SpendChart, monthlySpend } from "@/components/dashboard/spend-chart";
import { DashboardHero } from "@/components/dashboard/hero";
import { KpiBand } from "@/components/dashboard/kpi-band";
import { Reveal } from "@/components/motion/reveal";
import { AuditTimeline } from "@/components/app/audit-timeline";
import { TripSearch } from "@/components/dashboard/trip-search";
import { PopularDestinations } from "@/components/dashboard/popular-destinations";
import { TripStatusBadge } from "@/components/app/common";
import { routeLabel, useStore } from "@/lib/store";
import { formatCompactInr, formatDateRange, formatInr } from "@/lib/format";

const MONTHS = 6;

/** A section heading: a small uppercase eyebrow, a serif title and an optional link. */
function SectionHead({ eyebrow, title, href, link }: { eyebrow: string; title: string; href?: string; link?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[10.5px] font-medium tracking-[0.26em] text-muted-foreground uppercase">{eyebrow}</p>
        <h2 className="mt-1.5 text-2xl font-normal tracking-tight">{title}</h2>
      </div>
      {href && link && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
          {link}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
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
    const today = new Date(now).toISOString().slice(0, 10);
    const upcoming = approved.filter((t) => t.departDate >= today).sort((a, b) => a.departDate.localeCompare(b.departDate));
    // The last MONTHS calendar months, oldest first, for the thin trend lines.
    const months = monthlySpend(s.trips, MONTHS);
    const created = months.map((_, i) => {
      const d = new Date(new Date(now).getFullYear(), new Date(now).getMonth() - (MONTHS - 1 - i), 1);
      return s.trips.filter((t) => {
        const c = new Date(t.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      }).length;
    });
    return {
      total: s.trips.length,
      pending,
      spend,
      savings,
      savingsPct: spend + savings > 0 ? Math.round((savings / (spend + savings)) * 100) : 0,
      spendTrend: pct(cur, prev),
      tripTrend: pct(tripsCur, tripsPrev),
      upcoming,
      series: { created, spend: months.map((x) => x.spend), savings: months.map((x) => x.savings) },
    };
  }, [s.trips, now]);

  const first = s.session?.name.split(" ")[0] ?? "there";
  const api = s.session?.mode === "api";
  // The audit trail is admin-only on the server; in demo mode everything is local and visible.
  const showActivity = !api || s.session?.role === "admin";

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <Reveal>
        <DashboardHero name={first} now={now} pending={m.pending.length} next={m.upcoming[0]} />
      </Reveal>

      <Reveal delay={0.05}>
        <KpiBand
          items={[
            { label: "Trips", value: String(m.total), trend: { pct: m.tripTrend, goodWhenUp: true }, note: "vs previous 30 days", series: m.series.created },
            { label: "Awaiting review", value: String(m.pending.length), note: m.pending.length ? "Optimized, ready to decide" : "Nothing waiting" },
            { label: "Approved spend", value: formatCompactInr(m.spend), trend: { pct: m.spendTrend, goodWhenUp: false }, note: "vs previous 30 days", series: m.series.spend },
            {
              label: "Optimizer savings",
              value: formatCompactInr(m.savings),
              note: `${m.savingsPct}% below ${api ? "typical options that met every rule" : "typical market cost"}`,
              series: m.series.savings,
            },
          ]}
        />
      </Reveal>

      {api && (
        <Reveal delay={0.08} className="space-y-4">
          <SectionHead eyebrow="Search" title="Where to next?" href="/search" link="Open search" />
          <TripSearch />
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0.1} className="min-w-0 space-y-4 lg:col-span-2">
          <SectionHead eyebrow="Decisions" title="Review queue" href="/trips" link="All trips" />
          {m.pending.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-4 py-2">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-success/12 text-success">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <p className="font-medium">All caught up</p>
                  <p className="text-sm text-muted-foreground">New itineraries appear here as soon as the optimizer finishes.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="gap-0 py-0">
              <ul className="divide-y divide-border">
                {m.pending.slice(0, 5).map((t) => {
                  const it = t.itinerary;
                  const used = it ? Math.min(100, Math.round((it.totalCost / Math.max(t.budget, 1)) * 100)) : 0;
                  return (
                    <li key={t.id}>
                      <Link href={`/trips/${t.id}`} className="group flex items-center gap-3 px-4 py-4 transition-colors duration-300 hover:bg-foreground/[0.03] sm:gap-5 sm:px-5">
                        <div className="flex shrink-0 items-center gap-1.5 font-editorial text-xl leading-none sm:w-28 sm:gap-2 sm:text-2xl">
                          {t.origin}
                          <ArrowRight className="size-3.5 text-primary" />
                          {t.destination}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.code} · {formatDateRange(t.departDate, t.returnDate)}
                          </p>
                        </div>
                        <div className="hidden w-44 shrink-0 sm:block">
                          <div className="flex justify-between text-xs">
                            <span className="tabular-nums">{it ? formatInr(it.totalCost) : "-"}</span>
                            <span className="text-muted-foreground tabular-nums">of {formatInr(t.budget)}</span>
                          </div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${used}%` }} />
                          </div>
                        </div>
                        <span className="hidden shrink-0 sm:block">
                          <TripStatusBadge trip={t} />
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </Reveal>

        <Reveal delay={0.14} className="min-w-0 space-y-4">
          <SectionHead eyebrow="Calendar" title="Upcoming departures" />
          <Card className="gap-0 py-0">
            {m.upcoming.length === 0 ? (
              <CardContent className="flex items-center gap-4 py-6">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-foreground/[0.06] text-muted-foreground">
                  <CalendarClock className="size-5" />
                </span>
                <p className="text-sm text-muted-foreground">No approved trips coming up.</p>
              </CardContent>
            ) : (
              <ul className="divide-y divide-border">
                {m.upcoming.slice(0, 4).map((t) => {
                  const d = new Date(`${t.departDate}T00:00:00`);
                  return (
                    <li key={t.id}>
                      <Link href={`/trips/${t.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors duration-300 hover:bg-foreground/[0.03]">
                        <div className="flex w-12 shrink-0 flex-col items-center">
                          <span className="text-[10px] font-medium tracking-[0.2em] text-primary uppercase">{d.toLocaleString("en-IN", { month: "short" })}</span>
                          <span className="font-editorial text-3xl leading-none">{d.getDate()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{routeLabel(t)}</p>
                          <p className="truncate text-xs text-muted-foreground">{formatDateRange(t.departDate, t.returnDate)}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0.18} className="min-w-0 space-y-4 lg:col-span-2">
          <SectionHead eyebrow="Money" title="Approved spend and savings" href="/analytics" link="Analytics" />
          <Card>
            <CardContent>
              <SpendChart trips={s.trips} months={MONTHS} />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal delay={0.22} className="min-w-0 space-y-4">
          <SectionHead eyebrow="Pipeline" title="Trips by status" />
          <Card>
            <CardContent>
              <TripsByStatusChart trips={s.trips} />
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.26} className="space-y-4">
        <SectionHead eyebrow="History" title="Recent trips" href="/trips" link="View all" />
        <Card>
          <CardContent className="overflow-x-auto">
            <RecentTripsTable trips={s.trips.slice(0, 6)} />
          </CardContent>
        </Card>
      </Reveal>

      {api && (
        <Reveal delay={0.3}>
          <PopularDestinations />
        </Reveal>
      )}

      {showActivity && (
        <Reveal delay={0.34} className="space-y-4">
          <SectionHead eyebrow="Audit" title="Recent activity" href={s.session?.role === "admin" ? "/audit" : undefined} link="Full audit trail" />
          <Card>
            <CardContent>
              <AuditTimeline events={s.audit.slice(0, 6)} />
            </CardContent>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
