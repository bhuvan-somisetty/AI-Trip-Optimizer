"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Check,
  Plane,
  Hotel,
  Wallet,
  Users,
  ClipboardCheck,
  MapPin,
  Search,
  UserPlus,
  Sparkles,
  Save,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipToggle, NativeSelect, Range, Segmented, Switch, Textarea } from "@/components/ui/fields";
import { PageHeader } from "@/components/app/common";
import { TravelerDialog } from "@/components/travelers/traveler-form";
import { actions, defaultFilters, useStore } from "@/lib/store";
import { airlines, amenityLabel, amenityOptions, cabinLabel, cities, cityByCode } from "@/lib/catalog";
import { OptimizationError, nightsBetween, optimize, optionsFor, priorityLabel, windowLabel } from "@/lib/optimizer";
import { addDays, formatDateRange, formatInr, initials, toIsoDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { CabinClass, Priority, TimeWindow, Trip, TripFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

const steps = [
  { id: "travelers", label: "Travelers", icon: Users },
  { id: "trip", label: "Trip details", icon: MapPin },
  { id: "flights", label: "Flight filters", icon: Plane },
  { id: "stay", label: "Stay filters", icon: Hotel },
  { id: "budget", label: "Budget & priority", icon: Wallet },
  { id: "review", label: "Review", icon: ClipboardCheck },
] as const;

const purposes = ["Client meeting", "Conference", "Internal", "Recruitment", "Vendor review", "Audit", "Training", "Marketing event", "Leadership offsite", "Investor relations", "Partnership"];

type Draft = Omit<Trip, "id" | "code" | "status" | "createdAt" | "createdBy">;

// The backend's mock flight and hotel data only covers these airports and dates.
const apiCityCodes = ["BLR", "DEL", "BOM"];
const apiDemoDates = { depart: "2026-11-01", return: "2026-11-05" };

export default function PlanningPage() {
  const s = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const editing = s.trips.find((t) => t.id === editId && (t.status === "DRAFT" || t.status === "OPTIMIZATION_FAILED" || t.status === "OPTIMIZED" || t.status === "UNDER_REVIEW"));

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [travelerOpen, setTravelerOpen] = useState(false);
  const [tSearch, setTSearch] = useState("");
  const [roundTripChoice, setRoundTrip] = useState(editing ? editing.returnDate !== null : true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // The API takes one traveler and a [start, end] date pair per trip.
  const apiMode = s.session?.mode === "api";
  const roundTrip = roundTripChoice || apiMode;
  const cityOptions = apiMode ? cities.filter((c) => apiCityCodes.includes(c.code)) : cities;
  const [d, setD] = useState<Draft>(() => {
    if (editing) {
      return {
        title: editing.title,
        travelerIds: editing.travelerIds,
        origin: editing.origin,
        destination: editing.destination,
        departDate: editing.departDate,
        returnDate: editing.returnDate ?? toIsoDate(addDays(new Date(`${editing.departDate}T00:00:00`), 2)),
        purpose: editing.purpose,
        budget: editing.budget,
        rooms: editing.rooms,
        filters: editing.filters,
        notes: editing.notes,
      };
    }
    if (apiMode) {
      return {
        title: "",
        travelerIds: [],
        origin: "BLR",
        destination: "DEL",
        departDate: apiDemoDates.depart,
        returnDate: apiDemoDates.return,
        purpose: "Client meeting",
        budget: 0,
        rooms: 1,
        filters: { ...defaultFilters },
        notes: "",
      };
    }
    const depart = addDays(new Date(), 21);
    return {
      title: "",
      travelerIds: [],
      origin: "BLR",
      destination: "DEL",
      departDate: toIsoDate(depart),
      returnDate: toIsoDate(addDays(depart, 3)),
      purpose: "Client meeting",
      budget: 0,
      rooms: 1,
      filters: { ...defaultFilters },
      notes: "",
    };
  });

  const up = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  const upF = (patch: Partial<TripFilters>) => setD((p) => ({ ...p, filters: { ...p.filters, ...patch } }));

  const selected = s.travelers.filter((t) => d.travelerIds.includes(t.id));
  const effective: Draft = { ...d, returnDate: roundTrip ? d.returnDate : null };

  // Live feasibility preview — runs the same optimizer the pipeline uses, with no budget ceiling.
  const effectiveKey = JSON.stringify(effective);
  const preview = useMemo(() => {
    const effective = JSON.parse(effectiveKey) as Draft;
    if (!effective.travelerIds.length || effective.origin === effective.destination) return null;
    const probe = { ...effective, id: "preview", code: "", status: "DRAFT", createdAt: "", createdBy: "", budget: 1e12 } as Trip;
    const pools = optionsFor(probe, s.policy);
    const counts = {
      out: [pools.outbound.filter((x) => !x.reject).length, pools.outbound.length],
      ret: [pools.return.filter((x) => !x.reject).length, pools.return.length],
      stay: [pools.stay.filter((x) => !x.reject).length, pools.stay.length],
    };
    try {
      const it = optimize(probe, s.policy);
      return { ok: true as const, cost: it.totalCost, counts };
    } catch (e) {
      return { ok: false as const, reason: e instanceof OptimizationError ? e.message : "No feasible options.", counts };
    }
  }, [effectiveKey, s.policy]);

  const suggestedBudget = preview?.ok ? Math.ceil((preview.cost * 1.12) / 1000) * 1000 : 0;

  function validate(i: number): string[] {
    const e: string[] = [];
    if (i === 0 && !d.travelerIds.length) e.push("Select at least one traveler.");
    if (i === 0 && apiMode && d.travelerIds.length > 1) e.push("Select one traveler — trips saved to the server have a single traveler.");
    if (i === 1) {
      if (apiMode && (!apiCityCodes.includes(d.origin) || !apiCityCodes.includes(d.destination))) e.push(`Choose ${apiCityCodes.join(", ")} — the server only has flight and hotel data for these cities.`);
      if (!d.title.trim()) e.push("Give the trip a title.");
      if (d.origin === d.destination) e.push("Origin and destination must differ.");
      if (!d.departDate) e.push("Choose a departure date.");
      if (roundTrip && (!d.returnDate || d.returnDate <= d.departDate)) e.push("Return date must be after departure.");
      if (d.rooms < 1) e.push("At least one room is required.");
    }
    if (i === 4 && (!d.budget || d.budget < 1000)) e.push("Set a budget of at least ₹1,000.");
    return e;
  }

  function go(to: number) {
    if (to > step) {
      for (let i = step; i < to; i++) {
        const e = validate(i);
        if (e.length) {
          setErrors(e);
          setDir(1);
          setStep(i);
          return;
        }
      }
    }
    setErrors([]);
    setDir(to > step ? 1 : -1);
    if (to === 4 && !d.budget && suggestedBudget) up({ budget: suggestedBudget });
    setStep(to);
  }

  async function submit(run: boolean) {
    if (saving) return;
    for (let i = 0; i < 5; i++) {
      const e = validate(i);
      if (e.length) {
        setErrors(e);
        setStep(i);
        return;
      }
    }
    if (editing) {
      actions.updateTrip(editing.id, effective);
      toast(`${editing.code} updated`, { description: run ? "Re-running the optimizer…" : "Saved as draft." });
      router.push(`/trips/${editing.id}${run ? "?run=1" : ""}`);
      return;
    }
    setSaving(true);
    try {
      const trip = await actions.createTrip(effective);
      toast(`${trip.code} created`, { description: run ? "Optimizer is composing your itinerary…" : "Saved as draft — run the optimizer when ready." });
      router.push(`/trips/${trip.id}${run ? "?run=1" : ""}`);
    } catch (e) {
      toast("Couldn't create trip", { description: (e as Error).message, variant: "error" });
      setSaving(false);
    }
  }

  const filteredTravelers = s.travelers.filter((t) => `${t.name} ${t.department} ${t.email}`.toLowerCase().includes(tSearch.toLowerCase()));
  const nights = roundTrip && d.returnDate ? nightsBetween(d.departDate, d.returnDate) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow={editing ? `Editing ${editing.code}` : "New trip request"}
        title={editing ? "Update trip request" : "Plan a trip"}
        description="Tell the optimizer who's travelling, where, and what matters. Every filter below becomes a rule in the Trade-off Ledger."
      />

      {/* Stepper */}
      <nav aria-label="Progress" className="scrollbar-thin -mx-1 overflow-x-auto px-1">
        <ol className="flex min-w-max items-center gap-2">
          {steps.map((st, i) => {
            const done = i < step;
            const current = i === step;
            const Icon = st.icon;
            return (
              <li key={st.id} className="flex items-center gap-2">
                <button
                  onClick={() => go(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                    current && "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25",
                    done && "border-primary/30 bg-primary/10 text-primary",
                    !current && !done && "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  {st.label}
                </button>
                {i < steps.length - 1 && <span className={cn("h-px w-6", i < step ? "bg-primary/40" : "bg-border")} />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {errors.length > 0 && (
            <div role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <ul className="space-y-0.5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {step === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Who is travelling?</CardTitle>
                    <CardDescription>
                      {apiMode ? "Select the traveler." : "Select one or more travelers."} Their airline preferences are applied automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={tSearch} onChange={(e) => setTSearch(e.target.value)} placeholder="Search travelers…" className="h-9 pl-9" />
                      </div>
                      <Button variant="outline" size="lg" onClick={() => setTravelerOpen(true)}>
                        <UserPlus />
                        New traveler
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {filteredTravelers.map((t) => {
                        const on = d.travelerIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              const ids = on ? d.travelerIds.filter((x) => x !== t.id) : apiMode ? [t.id] : [...d.travelerIds, t.id];
                              const prefAir = [...new Set(s.travelers.filter((x) => ids.includes(x.id)).flatMap((x) => x.preferences.preferredAirlines))];
                              const first = s.travelers.find((x) => x.id === ids[0]);
                              setD((p) => ({
                                ...p,
                                travelerIds: ids,
                                rooms: Math.max(1, ids.length),
                                origin: !on && ids.length === 1 && first && cityOptions.some((c) => c.code === first.homeCity) ? first.homeCity : p.origin,
                                filters: { ...p.filters, preferredAirlines: prefAir },
                              }));
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                              on ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-foreground/20 hover:bg-muted/40"
                            )}
                          >
                            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                              {on ? <Check className="size-4" /> : initials(t.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{t.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {t.department} · Home {t.homeCity}
                                {t.preferences.seat && t.preferences.seat !== "No preference" ? ` · ${t.preferences.seat}` : ""}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                      {!filteredTravelers.length && <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No travelers match “{tSearch}”.</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Trip details</CardTitle>
                    <CardDescription>Route, dates and why the trip is happening. The trip starts in DRAFT status.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="title">Trip title *</Label>
                        <Input id="title" value={d.title} onChange={(e) => up({ title: e.target.value })} placeholder="e.g. Q4 client review — Mumbai" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="purpose">Purpose</Label>
                        <NativeSelect id="purpose" value={d.purpose} onChange={(e) => up({ purpose: e.target.value })}>
                          {purposes.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </NativeSelect>
                      </div>
                      {!apiMode && (
                        <div className="space-y-2">
                          <Label>Trip type</Label>
                          <Segmented
                            value={roundTrip ? "round" : "oneway"}
                            onChange={(v) => setRoundTrip(v === "round")}
                            options={[
                              { value: "round", label: "Round trip" },
                              { value: "oneway", label: "One-way" },
                            ]}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                      <div className="space-y-2">
                        <Label htmlFor="origin">From</Label>
                        <NativeSelect id="origin" value={d.origin} onChange={(e) => up({ origin: e.target.value })}>
                          {cityOptions.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <Button variant="outline" size="icon-lg" type="button" aria-label="Swap origin and destination" onClick={() => up({ origin: d.destination, destination: d.origin })} className="mx-auto">
                        <ArrowLeftRight />
                      </Button>
                      <div className="space-y-2">
                        <Label htmlFor="destination">To</Label>
                        <NativeSelect id="destination" value={d.destination} onChange={(e) => up({ destination: e.target.value })}>
                          {cityOptions.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name} ({c.code}){c.international ? " · Intl" : ""}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="depart">Departure</Label>
                        <Input
                          id="depart"
                          type="date"
                          min={toIsoDate(new Date())}
                          value={d.departDate}
                          onChange={(e) => {
                            const v = e.target.value;
                            up({ departDate: v, returnDate: d.returnDate && d.returnDate <= v ? toIsoDate(addDays(new Date(`${v}T00:00:00`), 2)) : d.returnDate });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="return">Return</Label>
                        <Input id="return" type="date" disabled={!roundTrip} min={d.departDate} value={roundTrip ? d.returnDate ?? "" : ""} onChange={(e) => up({ returnDate: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rooms">Hotel rooms</Label>
                        <Input id="rooms" type="number" min={1} max={10} value={d.rooms} onChange={(e) => up({ rooms: Math.max(1, Number(e.target.value) || 1) })} />
                      </div>
                    </div>
                    {apiMode && <p className="-mt-2 text-xs text-muted-foreground">Demo data covers 1–5 Nov 2026.</p>}

                    {cityByCode[d.destination]?.international && (
                      <div className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                        <p>
                          International trip to {cityByCode[d.destination].country}. Check visa requirements in the{" "}
                          <a className="font-medium text-primary hover:underline" href={`/assistant?q=${encodeURIComponent(`Visa requirements for ${cityByCode[d.destination].name}`)}`} target="_blank" rel="noreferrer">
                            Knowledge Assistant
                          </a>
                          .
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes for the reviewer</Label>
                      <Textarea id="notes" value={d.notes} onChange={(e) => up({ notes: e.target.value })} placeholder="Context the approver should know — meeting agenda, flexibility, etc." />
                    </div>
                  </CardContent>
                </Card>
              )}

              {step === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Flight filters</CardTitle>
                    <CardDescription>Hard rules remove options; preferences explain why an option lost in the ledger.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Field label="Cabin class">
                      <Segmented
                        value={d.filters.cabin}
                        onChange={(v) => upF({ cabin: v as CabinClass })}
                        options={(Object.keys(cabinLabel) as CabinClass[]).map((c) => ({ value: c, label: cabinLabel[c] }))}
                      />
                    </Field>
                    <Field label="Maximum stops">
                      <Segmented
                        value={d.filters.maxStops}
                        onChange={(v) => upF({ maxStops: v as 0 | 1 | 2 })}
                        options={[
                          { value: 0, label: "Non-stop only" },
                          { value: 1, label: "Up to 1 stop" },
                          { value: 2, label: "Up to 2 stops" },
                        ]}
                      />
                    </Field>
                    <Field label="Preferred departure time">
                      <Segmented
                        size="sm"
                        value={d.filters.departureWindow}
                        onChange={(v) => upF({ departureWindow: v as TimeWindow })}
                        options={(Object.keys(windowLabel) as TimeWindow[]).map((w) => ({ value: w, label: windowLabel[w] }))}
                      />
                    </Field>
                    <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
                      <div>
                        <p className="text-sm font-medium">Avoid red-eye flights</p>
                        <p className="text-xs text-muted-foreground">Departures between 22:30 and 05:00 are excluded.</p>
                      </div>
                      <Switch checked={d.filters.avoidRedEye} onCheckedChange={(v) => upF({ avoidRedEye: v })} aria-label="Avoid red-eye flights" />
                    </div>
                    <Field label="Preferred airlines" hint="Scoring boost — not a hard rule.">
                      <ChipToggle
                        selected={d.filters.preferredAirlines}
                        onChange={(v) => upF({ preferredAirlines: v, excludedAirlines: d.filters.excludedAirlines.filter((x) => !v.includes(x)) })}
                        options={airlines.map((a) => ({ value: a, label: a }))}
                      />
                    </Field>
                    <Field label="Exclude airlines" hint="Hard rule — these carriers are never selected.">
                      <ChipToggle
                        selected={d.filters.excludedAirlines}
                        onChange={(v) => upF({ excludedAirlines: v, preferredAirlines: d.filters.preferredAirlines.filter((x) => !v.includes(x)) })}
                        options={airlines.map((a) => ({ value: a, label: a }))}
                      />
                    </Field>
                  </CardContent>
                </Card>
              )}

              {step === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Stay filters</CardTitle>
                    <CardDescription>
                      {nights} night{nights > 1 ? "s" : ""} × {d.rooms} room{d.rooms > 1 ? "s" : ""} in {cityByCode[d.destination]?.name}. Company cap:{" "}
                      {formatInr(cityByCode[d.destination]?.international ? s.policy.maxNightlyRateIntl : s.policy.maxNightlyRate)}/night.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Field label={`Minimum guest rating: ${d.filters.minHotelRating.toFixed(1)}+`}>
                      <Range min={3} max={4.8} step={0.1} value={d.filters.minHotelRating} onChange={(v) => upF({ minHotelRating: v })} aria-label="Minimum hotel rating" />
                    </Field>
                    <Field label={`Max distance from centre: ${d.filters.maxHotelDistanceKm} km`}>
                      <Range min={1} max={15} step={0.5} value={d.filters.maxHotelDistanceKm} onChange={(v) => upF({ maxHotelDistanceKm: v })} aria-label="Maximum distance" />
                    </Field>
                    <Field label="Nightly rate cap for this trip" hint="Leave empty to use the company policy cap.">
                      <div className="relative max-w-56">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                        <Input
                          inputMode="numeric"
                          className="pl-7"
                          placeholder="No extra cap"
                          value={d.filters.maxNightlyRate ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "");
                            upF({ maxNightlyRate: v ? Number(v) : null });
                          }}
                        />
                      </div>
                    </Field>
                    <Field label="Required amenities" hint="Hotels missing any of these are rejected with a Preference reason.">
                      <ChipToggle selected={d.filters.requiredAmenities} onChange={(v) => upF({ requiredAmenities: v })} options={amenityOptions.map((a) => ({ value: a.id, label: a.label }))} />
                    </Field>
                  </CardContent>
                </Card>
              )}

              {step === 4 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Budget & optimization priority</CardTitle>
                    <CardDescription>The optimizer only picks combinations inside this budget — or flags the overrun if none fit.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Field label="Approved budget (total, all travelers)">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="relative w-56">
                          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                          <Input
                            inputMode="numeric"
                            className="h-10 pl-7 text-base font-semibold"
                            value={d.budget ? d.budget.toLocaleString("en-IN") : ""}
                            onChange={(e) => up({ budget: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                            placeholder="0"
                          />
                        </div>
                        {suggestedBudget > 0 && d.budget !== suggestedBudget && (
                          <Button variant="outline" size="sm" onClick={() => up({ budget: suggestedBudget })}>
                            <Sparkles />
                            Use suggested {formatInr(suggestedBudget)}
                          </Button>
                        )}
                      </div>
                      {preview?.ok && d.budget > 0 && (
                        <p className={cn("mt-2 text-xs", d.budget < preview.cost ? "text-destructive" : "text-muted-foreground")}>
                          Best-scoring itinerary with these filters costs about {formatInr(preview.cost)}
                          {d.budget < preview.cost ? " — the optimizer will pick cheaper options or flag an overrun." : ` — ${formatInr(d.budget - preview.cost)} headroom.`}
                        </p>
                      )}
                    </Field>
                    <Field label="What should the optimizer prioritize?">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(Object.keys(priorityLabel) as Priority[]).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => upF({ priority: p })}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-all",
                              d.filters.priority === p ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-foreground/20"
                            )}
                          >
                            <p className="text-sm font-medium">{priorityLabel[p]}</p>
                            <p className="text-xs text-muted-foreground">
                              {
                                {
                                  cheapest: "Minimise spend; accept stops and less convenient times.",
                                  balanced: "Weigh cost, travel time and comfort evenly.",
                                  comfort: "Direct flights, better-rated hotels, refundable fares.",
                                  fastest: "Shortest door-to-door time; central hotels.",
                                }[p]
                              }
                            </p>
                          </button>
                        ))}
                      </div>
                    </Field>
                  </CardContent>
                </Card>
              )}

              {step === 5 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Review request</CardTitle>
                    <CardDescription>Check everything before the optimizer runs. You can still edit a draft later.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ReviewRow label="Title" value={d.title} onEdit={() => go(1)} />
                    <ReviewRow label="Travelers" value={selected.map((t) => t.name).join(", ")} onEdit={() => go(0)} />
                    <ReviewRow label="Route" value={`${cityByCode[d.origin]?.name} → ${cityByCode[d.destination]?.name}`} onEdit={() => go(1)} />
                    <ReviewRow label="Dates" value={formatDateRange(d.departDate, roundTrip ? d.returnDate : null)} onEdit={() => go(1)} />
                    <ReviewRow
                      label="Flights"
                      value={`${cabinLabel[d.filters.cabin]} · ${d.filters.maxStops === 0 ? "non-stop" : `≤ ${d.filters.maxStops} stop`} · ${windowLabel[d.filters.departureWindow]}${d.filters.avoidRedEye ? " · no red-eyes" : ""}${d.filters.excludedAirlines.length ? ` · excl. ${d.filters.excludedAirlines.join(", ")}` : ""}`}
                      onEdit={() => go(2)}
                    />
                    <ReviewRow
                      label="Stay"
                      value={`${d.rooms} room${d.rooms > 1 ? "s" : ""} · ${d.filters.minHotelRating.toFixed(1)}+ rating · ≤ ${d.filters.maxHotelDistanceKm} km${d.filters.requiredAmenities.length ? ` · ${d.filters.requiredAmenities.map((a) => amenityLabel[a]).join(", ")}` : ""}${d.filters.maxNightlyRate ? ` · cap ${formatInr(d.filters.maxNightlyRate)}/night` : ""}`}
                      onEdit={() => go(3)}
                    />
                    <ReviewRow label="Budget" value={`${formatInr(d.budget)} · ${priorityLabel[d.filters.priority]}`} onEdit={() => go(4)} />
                    {d.notes && <ReviewRow label="Notes" value={d.notes} onEdit={() => go(1)} />}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="lg" onClick={() => (step === 0 ? router.back() : go(step - 1))}>
              <ArrowLeft />
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <div className="flex gap-2">
              {step === steps.length - 1 ? (
                <>
                  <Button variant="outline" size="lg" onClick={() => submit(false)} disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" /> : <Save />}
                    Save draft
                  </Button>
                  <Button size="lg" onClick={() => submit(true)} disabled={saving} className="shadow-md shadow-primary/25">
                    {saving ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {editing ? "Save & re-optimize" : "Create & optimize"}
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={() => go(step + 1)}>
                  Continue
                  <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live summary */}
        <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <Card className="overflow-hidden py-0">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-5 text-white">
              <p className="text-xs tracking-wide text-white/60 uppercase">Trip summary</p>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{d.origin}</p>
                  <p className="text-xs text-white/60">{cityByCode[d.origin]?.name}</p>
                </div>
                <Plane className="size-5 rotate-45 text-sky-300" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{d.destination}</p>
                  <p className="text-xs text-white/60">{cityByCode[d.destination]?.name}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/80">{formatDateRange(d.departDate, roundTrip ? d.returnDate : null)}</p>
            </div>
            <CardContent className="space-y-3 p-5 text-sm">
              <SummaryLine label="Travelers" value={selected.length ? `${selected.length} · ${selected.map((t) => t.name.split(" ")[0]).join(", ")}` : "None selected"} />
              <SummaryLine label="Nights × rooms" value={`${nights} × ${d.rooms}`} />
              <SummaryLine label="Cabin" value={cabinLabel[d.filters.cabin]} />
              <SummaryLine label="Priority" value={priorityLabel[d.filters.priority]} />
              <SummaryLine label="Budget" value={d.budget ? formatInr(d.budget) : "Not set"} />
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="space-y-3 px-5">
              <p className="text-sm font-semibold">Live feasibility check</p>
              {!preview ? (
                <p className="text-sm text-muted-foreground">Select travelers and a route to preview matching options.</p>
              ) : (
                <>
                  <FeasRow label="Outbound flights" n={preview.counts.out} />
                  {roundTrip && <FeasRow label="Return flights" n={preview.counts.ret} />}
                  <FeasRow label="Hotels" n={preview.counts.stay} />
                  {preview.ok ? (
                    <div className="flex gap-2 rounded-lg bg-success/10 p-2.5 text-xs text-emerald-700 dark:text-success">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>
                        Feasible. Estimated optimized cost <b>{formatInr(preview.cost)}</b>.
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>{preview.reason}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <TravelerDialog
        open={travelerOpen}
        onOpenChange={setTravelerOpen}
        onCreated={(t) =>
          setD((p) => (apiMode ? { ...p, travelerIds: [t.id], rooms: Math.max(p.rooms, 1) } : { ...p, travelerIds: [...p.travelerIds, t.id], rooms: Math.max(p.rooms, p.travelerIds.length + 1) }))
        }
      />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value || "—"}</p>
      </div>
      <button onClick={onEdit} className="shrink-0 text-xs font-medium text-primary hover:underline">
        Edit
      </button>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

function FeasRow({ label, n }: { label: string; n: number[] }) {
  const [ok, total] = n;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium tabular-nums", ok === 0 && "text-destructive")}>
          {ok} of {total} match
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", ok === 0 ? "bg-destructive" : "bg-primary")} style={{ width: `${total ? (ok / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
