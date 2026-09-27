"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IndianRupee, PiggyBank, Timer, BadgeCheck, Download, Users, ScrollText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/common";
import { StatCard } from "@/components/dashboard/stat-card";
import { SpendChart } from "@/components/dashboard/spend-chart";
import { routeLabel, useStore } from "@/lib/store";
import { cityByCode } from "@/lib/catalog";
import { formatCompactInr, formatInr } from "@/lib/format";
import { toast } from "@/lib/toast";

type Period = "30" | "90" | "180" | "365" | "all";
const periodLabel: Record<Period, string> = { "30": "30 days", "90": "90 days", "180": "6 months", "365": "12 months", all: "All time" };
const palette = ["var(--color-chart-4)", "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-5)", "oklch(0.65 0.15 200)", "oklch(0.6 0.18 300)", "var(--color-chart-3)"];

const tooltipStyle = { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 };

export default function AnalyticsPage() {
  const s = useStore();
  const [period, setPeriod] = useState<Period>("180");
  const [now] = useState(() => Date.now());

  const d = useMemo(() => {
    const since = period === "all" ? 0 : now - Number(period) * 86400000;
    const decided = s.trips.filter((t) => t.status === "DECIDED" && t.decidedAt && new Date(t.decidedAt).getTime() >= since);
    const approved = decided.filter((t) => t.outcome === "APPROVED" && t.itinerary);
    const spend = approved.reduce((a, t) => a + t.itinerary!.totalCost, 0);
    const savings = approved.reduce((a, t) => a + t.itinerary!.savings, 0);
    const turnaround = decided.map((t) => (new Date(t.decidedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000);
    const avgTurn = turnaround.length ? turnaround.reduce((a, b) => a + b, 0) / turnaround.length : 0;
    const pax = approved.reduce((a, t) => a + t.travelerIds.length, 0);

    const byDest = Object.values(
      approved.reduce<Record<string, { name: string; spend: number; trips: number }>>((acc, t) => {
        const k = t.destination;
        acc[k] ??= { name: cityByCode[k]?.name ?? k, spend: 0, trips: 0 };
        acc[k].spend += t.itinerary!.totalCost;
        acc[k].trips += 1;
        return acc;
      }, {})
    ).sort((a, b) => b.spend - a.spend);

    const byDept = Object.entries(
      approved.reduce<Record<string, number>>((acc, t) => {
        const share = t.itinerary!.totalCost / t.travelerIds.length;
        for (const id of t.travelerIds) {
          const dep = s.travelers.find((x) => x.id === id)?.department ?? "Other";
          acc[dep] = (acc[dep] ?? 0) + share;
        }
        return acc;
      }, {})
    )
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

    return {
      decided,
      approved,
      spend,
      savings,
      savingsPct: spend + savings ? Math.round((savings / (spend + savings)) * 100) : 0,
      avgSavings: approved.length ? savings / approved.length : 0,
      avgTurn,
      approvalRate: decided.length ? Math.round((approved.length / decided.length) * 100) : 0,
      perTraveler: pax ? spend / pax : 0,
      byDest,
      byDept,
    };
  }, [s.trips, s.travelers, period, now]);

  const months = period === "30" ? 2 : period === "90" ? 3 : period === "180" ? 6 : 12;

  function exportCsv() {
    const rows = [
      ["Trip", "Route", "Outcome", "Decided at", "Turnaround (h)", "Total cost", "Savings", "Budget"],
      ...d.decided.map((t) => [
        t.code,
        routeLabel(t),
        t.outcome,
        t.decidedAt,
        ((new Date(t.decidedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000).toFixed(1),
        t.itinerary?.totalCost ?? "",
        t.itinerary?.savings ?? "",
        t.budget,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Report exported", { description: `${d.decided.length} decisions · ${periodLabel[period]}` });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Analytics"
        description="Spend, savings and decision turnaround for the selected period. Full event history lives in the audit trail."
        actions={
          <>
            <Link href="/audit" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <ScrollText />
              Audit trail
            </Link>
            <Button variant="outline" size="lg" onClick={exportCsv} disabled={!d.decided.length}>
              <Download />
              Export
            </Button>
          </>
        }
      />

      <Segmented value={period} onChange={setPeriod} options={(Object.keys(periodLabel) as Period[]).map((p) => ({ value: p, label: periodLabel[p] }))} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total approved spend" value={formatCompactInr(d.spend)} icon={IndianRupee} hint={`${d.approved.length} approved trips · ${formatInr(d.perTraveler)}/traveler`} />
        <StatCard label="Average savings" value={formatInr(d.avgSavings)} icon={PiggyBank} iconClassName="bg-success/15 text-success" hint={`${formatCompactInr(d.savings)} total · ${d.savingsPct}% below typical`} />
        <StatCard label="Avg. turnaround" value={d.avgTurn >= 24 ? `${(d.avgTurn / 24).toFixed(1)} days` : `${d.avgTurn.toFixed(1)} h`} icon={Timer} iconClassName="bg-warning/15 text-amber-600 dark:text-warning" hint="Request created → decision" />
        <StatCard label="Approval rate" value={`${d.approvalRate}%`} icon={BadgeCheck} iconClassName="bg-sky-500/10 text-sky-600" hint={`${d.decided.length} decisions in period`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly spend & savings</CardTitle>
            <CardDescription>Approved itineraries by decision month</CardDescription>
          </CardHeader>
          <CardContent>
            <SpendChart trips={s.trips} months={months} height={280} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-4" />Spend by department</CardTitle>
            <CardDescription>Split evenly across travelers on each trip</CardDescription>
          </CardHeader>
          <CardContent>
            {d.byDept.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No approved spend in this period.</p>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={d.byDept} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
                        {d.byDept.map((x, i) => (
                          <Cell key={x.name} fill={palette[i % palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatInr(Number(v))} contentStyle={tooltipStyle} itemStyle={{ color: "var(--color-popover-foreground)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {d.byDept.map((x, i) => (
                    <li key={x.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="size-2.5 rounded-full" style={{ background: palette[i % palette.length] }} />
                        {x.name}
                      </span>
                      <span className="font-medium tabular-nums">{formatCompactInr(x.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend by destination</CardTitle>
          </CardHeader>
          <CardContent>
            {d.byDest.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No approved spend in this period.</p>
            ) : (
              <div style={{ height: Math.max(160, d.byDest.length * 44) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.byDest} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                    <XAxis type="number" tickFormatter={(v) => formatCompactInr(v)} fontSize={12} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={96} fontSize={12} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => formatInr(Number(v))} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} contentStyle={tooltipStyle} labelStyle={{ color: "var(--color-popover-foreground)" }} />
                    <Bar dataKey="spend" name="Spend" fill="var(--color-primary)" radius={[0, 6, 6, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Decisions in period</CardTitle>
            <CardDescription>Turnaround and savings per decided trip</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Trip</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Turnaround</TableHead>
                  <TableHead className="pr-6 text-right">Savings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.decided.map((t) => {
                  const h = (new Date(t.decidedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6">
                        <Link href={`/trips/${t.id}`} className="font-medium text-primary hover:underline">{t.code}</Link>
                        <p className="text-xs text-muted-foreground">{routeLabel(t)}</p>
                      </TableCell>
                      <TableCell className={t.outcome === "APPROVED" ? "text-emerald-600 dark:text-success" : "text-destructive"}>{t.outcome === "APPROVED" ? "Approved" : "Rejected"}</TableCell>
                      <TableCell className="text-right tabular-nums">{h >= 24 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{t.outcome === "APPROVED" && t.itinerary ? formatInr(t.itinerary.savings) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {!d.decided.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No decisions in this period.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
