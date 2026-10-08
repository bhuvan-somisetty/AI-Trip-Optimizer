"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Download,
  MoreHorizontal,
  Copy,
  Trash2,
  Sparkles,
  Eye,
  X,
  Plane,
  CalendarDays,
  Users,
  Loader2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, Segmented } from "@/components/ui/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader, TripStatusBadge } from "@/components/app/common";
import { actions, routeLabel, travelerNames, useStore } from "@/lib/store";
import { cities, cityByCode } from "@/lib/catalog";
import { formatDateRange, formatInr, timeAgo } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "all" | "draft" | "review" | "approved" | "rejected" | "failed";
const tabs: { value: Tab; label: string; match: (t: Trip) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "draft", label: "Drafts", match: (t) => t.status === "DRAFT" || t.status === "OPTIMIZING" },
  { value: "review", label: "Needs review", match: (t) => t.status === "OPTIMIZED" || t.status === "UNDER_REVIEW" },
  { value: "approved", label: "Approved", match: (t) => t.outcome === "APPROVED" && t.status === "DECIDED" },
  { value: "rejected", label: "Rejected", match: (t) => t.outcome === "REJECTED" && t.status === "DECIDED" },
  { value: "failed", label: "Failed", match: (t) => t.status === "OPTIMIZATION_FAILED" },
];

type Sort = "newest" | "departure" | "cost_desc" | "cost_asc" | "budget_desc";

const blank = {
  q: "",
  traveler: "",
  destination: "",
  purpose: "",
  from: "",
  to: "",
  minBudget: "",
  maxBudget: "",
  overBudget: false,
  timeframe: "all" as "all" | "upcoming" | "past",
};

export default function TripsPage() {
  const s = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [f, setF] = useState(blank);
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"table" | "grid">("table");
  const [showFilters, setShowFilters] = useState(true);
  // The backend has no delete-trip endpoint yet.
  const canDelete = s.session?.mode !== "api";

  const purposes = useMemo(() => [...new Set(s.trips.map((t) => t.purpose))].sort(), [s.trips]);
  const activeFilters = Object.entries(f).filter(([k, v]) => (k === "timeframe" ? v !== "all" : Boolean(v))).length;

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const list = s.trips.filter((t) => {
      if (!tabs.find((x) => x.value === tab)!.match(t)) return false;
      if (q) {
        const hay = [t.code, t.title, t.purpose, routeLabel(t), ...travelerNames(t, s.travelers)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.traveler && !t.travelerIds.includes(f.traveler)) return false;
      if (f.destination && t.destination !== f.destination) return false;
      if (f.purpose && t.purpose !== f.purpose) return false;
      if (f.from && t.departDate < f.from) return false;
      if (f.to && t.departDate > f.to) return false;
      if (f.minBudget && t.budget < Number(f.minBudget)) return false;
      if (f.maxBudget && t.budget > Number(f.maxBudget)) return false;
      if (f.overBudget && !(t.itinerary && t.itinerary.totalCost > t.budget)) return false;
      if (f.timeframe === "upcoming" && t.departDate < today) return false;
      if (f.timeframe === "past" && t.departDate >= today) return false;
      return true;
    });
    const cost = (t: Trip) => t.itinerary?.totalCost ?? 0;
    return [...list].sort((a, b) => {
      switch (sort) {
        case "departure":
          return a.departDate.localeCompare(b.departDate);
        case "cost_desc":
          return cost(b) - cost(a);
        case "cost_asc":
          return cost(a) - cost(b);
        case "budget_desc":
          return b.budget - a.budget;
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [s.trips, s.travelers, tab, f, sort]);

  function exportCsv() {
    const rows = [
      ["Trip", "Title", "Route", "Depart", "Return", "Travelers", "Purpose", "Budget", "Total cost", "Savings", "Status"],
      ...filtered.map((t) => [
        t.code,
        t.title,
        routeLabel(t),
        t.departDate,
        t.returnDate ?? "",
        travelerNames(t, s.travelers).join("; "),
        t.purpose,
        t.budget,
        t.itinerary?.totalCost ?? "",
        t.itinerary?.savings ?? "",
        t.status === "DECIDED" ? t.outcome : t.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trips-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Export ready", { description: `${filtered.length} trips exported to CSV.` });
  }

  function remove(t: Trip) {
    try {
      actions.deleteTrip(t.id);
      toast(`${t.code} deleted`);
    } catch (e) {
      toast("Can't delete trip", { description: (e as Error).message, variant: "error" });
    }
  }

  function optimizeNow(t: Trip) {
    router.push(`/trips/${t.id}?run=1`);
  }

  const upd = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Trips"
        description="Every trip request, its optimized itinerary, and where it sits in the review workflow."
        actions={
          <>
            <Button variant="outline" size="lg" onClick={exportCsv} disabled={!filtered.length}>
              <Download />
              Export
            </Button>
            <Link href="/planning" className={cn(buttonVariants({ size: "lg" }), "shadow-md shadow-primary/20")}>
              <Plus />
              New trip
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
          <Segmented
            value={tab}
            onChange={setTab}
            options={tabs.map((t) => ({
              value: t.value,
              label: (
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  {t.label}
                  <span className="rounded-full bg-foreground/5 px-1.5 text-[11px] tabular-nums">{s.trips.filter(t.match).length}</span>
                </span>
              ),
            }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={f.q} onChange={(e) => upd("q", e.target.value)} placeholder="Search code, title, traveler…" className="h-9 pl-9" />
          </div>
          <Button variant={showFilters ? "secondary" : "outline"} size="lg" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal />
            Filters
            {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeFilters}</span>}
          </Button>
          <div className="hidden rounded-lg border p-0.5 sm:flex">
            <button onClick={() => setView("table")} aria-label="Table view" className={cn("rounded-md p-1.5", view === "table" ? "bg-muted text-foreground" : "text-muted-foreground")}>
              <List className="size-4" />
            </button>
            <button onClick={() => setView("grid")} aria-label="Card view" className={cn("rounded-md p-1.5", view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground")}>
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <Card className="py-4">
          <CardContent className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label className="text-xs">Traveler</Label>
              <NativeSelect value={f.traveler} onChange={(e) => upd("traveler", e.target.value)}>
                <option value="">All travelers</option>
                {s.travelers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Destination</Label>
              <NativeSelect value={f.destination} onChange={(e) => upd("destination", e.target.value)}>
                <option value="">Anywhere</option>
                {cities.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Purpose</Label>
              <NativeSelect value={f.purpose} onChange={(e) => upd("purpose", e.target.value)}>
                <option value="">Any purpose</option>
                {purposes.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Departing between</Label>
              <div className="flex items-center gap-1.5">
                <Input type="date" value={f.from} onChange={(e) => upd("from", e.target.value)} aria-label="From date" />
                <Input type="date" value={f.to} onChange={(e) => upd("to", e.target.value)} aria-label="To date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Budget (₹)</Label>
              <div className="flex items-center gap-1.5">
                <Input inputMode="numeric" placeholder="Min" value={f.minBudget} onChange={(e) => upd("minBudget", e.target.value.replace(/\D/g, ""))} />
                <Input inputMode="numeric" placeholder="Max" value={f.maxBudget} onChange={(e) => upd("maxBudget", e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sort by</Label>
              <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="newest">Newest first</option>
                <option value="departure">Departure date</option>
                <option value="cost_desc">Cost: high to low</option>
                <option value="cost_asc">Cost: low to high</option>
                <option value="budget_desc">Budget: high to low</option>
              </NativeSelect>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4 xl:col-span-6">
              <Segmented
                size="sm"
                value={f.timeframe}
                onChange={(v) => upd("timeframe", v)}
                options={[
                  { value: "all", label: "Any time" },
                  { value: "upcoming", label: "Upcoming" },
                  { value: "past", label: "Past" },
                ]}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={f.overBudget} onChange={(e) => upd("overBudget", e.target.checked)} />
                Over budget only
              </label>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setF(blank)} className="ml-auto">
                  <X />
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{filtered.length}</span> of {s.trips.length} trips
      </p>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Plane}
            title="No trips match these filters"
            description="Try widening the date range or clearing filters — or plan a new trip."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setF(blank); setTab("all"); }}>
                  Clear filters
                </Button>
                <Link href="/planning" className={buttonVariants()}>
                  <Plus />
                  Plan a trip
                </Link>
              </div>
            }
          />
        </Card>
      ) : view === "table" ? (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Trip</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Travelers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Itinerary cost</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const over = t.itinerary && t.itinerary.totalCost > t.budget;
                  return (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/trips/${t.id}`)}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-primary">{t.code}</div>
                        <div className="max-w-56 truncate text-xs text-muted-foreground">{t.title}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{routeLabel(t)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateRange(t.departDate, t.returnDate)}</TableCell>
                      <TableCell className="max-w-44 truncate text-muted-foreground">{travelerNames(t, s.travelers).join(", ")}</TableCell>
                      <TableCell>
                        <TripStatusBadge trip={t} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatInr(t.budget)}</TableCell>
                      <TableCell className={cn("text-right font-medium tabular-nums", over && "text-destructive")}>
                        {t.itinerary ? formatInr(t.itinerary.totalCost) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RowMenu trip={t} onOptimize={() => optimizeNow(t)} onRemove={canDelete ? () => remove(t) : undefined} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const it = t.itinerary;
            const pct = it ? Math.min(100, Math.round((it.totalCost / t.budget) * 100)) : 0;
            return (
              <Card
                key={t.id}
                className="group cursor-pointer gap-4 py-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => router.push(`/trips/${t.id}`)}
              >
                <CardContent className="space-y-4 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary">{t.code}</p>
                      <p className="truncate font-semibold">{t.title}</p>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                      <TripStatusBadge trip={t} />
                      <RowMenu trip={t} onOptimize={() => optimizeNow(t)} onRemove={canDelete ? () => remove(t) : undefined} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                    <div className="text-center">
                      <p className="text-lg font-bold">{t.origin}</p>
                      <p className="text-[11px] text-muted-foreground">{cityByCode[t.origin]?.name}</p>
                    </div>
                    <div className="relative flex-1 border-t border-dashed border-muted-foreground/40">
                      <Plane className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 bg-transparent text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{t.destination}</p>
                      <p className="text-[11px] text-muted-foreground">{cityByCode[t.destination]?.name}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-3.5" />
                      {formatDateRange(t.departDate, t.returnDate)}
                    </p>
                    <p className="flex items-center gap-2 truncate">
                      <Users className="size-3.5" />
                      {travelerNames(t, s.travelers).join(", ")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{it ? `${formatInr(it.totalCost)} of ${formatInr(t.budget)}` : `Budget ${formatInr(t.budget)}`}</span>
                      <span className="text-muted-foreground">{timeAgo(t.createdAt)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", it && it.totalCost > t.budget ? "bg-destructive" : pct > 90 ? "bg-warning" : "bg-primary")}
                        style={{ width: `${it ? pct : 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RowMenu({ trip, onOptimize, onRemove }: { trip: Trip; onOptimize: () => void; onRemove?: () => void }) {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent" aria-label="Trip actions">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push(`/trips/${trip.id}`)}>
          <Eye />
          Open
        </DropdownMenuItem>
        {(trip.status === "DRAFT" || trip.status === "OPTIMIZATION_FAILED") && (
          <DropdownMenuItem onClick={onOptimize}>
            <Sparkles />
            Run optimizer
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={duplicating}
          onClick={async () => {
            setDuplicating(true);
            try {
              const copy = await actions.duplicateTrip(trip.id);
              toast(`Duplicated as ${copy.code}`);
              router.push(`/trips/${copy.id}`);
            } catch (e) {
              toast("Couldn't duplicate trip", { description: (e as Error).message, variant: "error" });
            }
            setDuplicating(false);
          }}
        >
          {duplicating ? <Loader2 className="animate-spin" /> : <Copy />}
          Duplicate
        </DropdownMenuItem>
        {trip.status !== "DECIDED" && onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
