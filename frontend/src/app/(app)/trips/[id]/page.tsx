"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Sparkles,
  Pencil,
  Trash2,
  Copy,
  Printer,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  RefreshCw,
  Eye,
  Target,
  Check,
  Plane,
  Wallet,
  Briefcase,
  Loader2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/fields";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, TripStatusBadge } from "@/components/app/common";
import { AuditTimeline } from "@/components/app/audit-timeline";
import { PipelineProgress } from "@/components/trips/pipeline";
import { ConstraintFlags, CostSummary, FlightCard, Rationale, StayCard } from "@/components/trips/itinerary";
import { TradeoffLedger } from "@/components/trips/ledger";
import { WhatIf } from "@/components/trips/whatif";
import { Chat } from "@/components/assistant/chat";
import { actions, getState, routeLabel, travelerNames, useStore } from "@/lib/store";
import { amenityLabel, cabinLabel } from "@/lib/catalog";
import { priorityLabel, windowLabel } from "@/lib/optimizer";
import { formatDate, formatDateRange, formatInr, statusLabel, timeAgo } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { LedgerEntry, TripStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "itinerary" | "ledger" | "ask" | "whatif" | "activity" | "request";

const flow: TripStatus[] = ["DRAFT", "OPTIMIZING", "OPTIMIZED", "UNDER_REVIEW", "DECIDED"];

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const s = useStore();
  const trip = s.trips.find((t) => t.id === id);
  const [tab, setTab] = useState<Tab>("itinerary");
  const [ledgerKind, setLedgerKind] = useState<LedgerEntry["kind"]>("outbound");
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  // The backend has no delete-trip endpoint yet.
  const canDelete = s.session?.mode !== "api";
  const autoRan = useRef(false);

  useEffect(() => {
    if (!trip || autoRan.current || params.get("run") !== "1") return;
    autoRan.current = true;
    router.replace(`/trips/${trip.id}`);
    if (trip.status === "DRAFT" || trip.status === "OPTIMIZATION_FAILED") void run();
  });

  if (!trip) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState
          icon={Plane}
          title="Trip not found"
          description="It may have been deleted, or the link is wrong."
          action={<Link href="/trips" className={buttonVariants()}>Back to trips</Link>}
        />
      </Card>
    );
  }
  const t = trip;
  const it = t.itinerary;
  const decided = t.status === "DECIDED";
  const editable = !decided && !!it && t.status !== "OPTIMIZING";
  const blocking = it?.issues.filter((i) => i.severity === "error") ?? [];
  const events = s.audit.filter((a) => a.tripId === t.id);
  const names = travelerNames(t, s.travelers);

  async function run() {
    toast("Optimizer started", { description: `${t.code}: searching flights and stays…`, variant: "info" });
    setTab("itinerary");
    await actions.runOptimization(t.id);
    const after = getState().trips.find((x) => x.id === t.id);
    if (after?.status === "OPTIMIZED" && after.itinerary) {
      toast("Itinerary ready", { description: `${formatInr(after.itinerary.totalCost)} · ${after.itinerary.issues.length} flag${after.itinerary.issues.length === 1 ? "" : "s"} to review.` });
    } else if (after?.status === "OPTIMIZATION_FAILED") {
      toast("Optimization failed", { description: "No feasible combination — adjust the filters.", variant: "error" });
    }
  }

  function swapOption(kind: LedgerEntry["kind"], optionId: string, label: string) {
    const before = it!.totalCost;
    actions.editLineItem(t.id, kind, optionId);
    const after = getState().trips.find((x) => x.id === t.id)?.itinerary?.totalCost ?? before;
    toast(`Swapped to ${label}`, { description: `Total ${formatInr(before)} → ${formatInr(after)}. Logged to the audit trail.` });
  }

  function submitDecision() {
    if (!decision) return;
    if (decision === "REJECTED" && !reason.trim()) {
      setReasonError(true);
      return;
    }
    actions.decide(t.id, decision, reason);
    toast(decision === "APPROVED" ? `${t.code} approved` : `${t.code} rejected`, {
      description: decision === "APPROVED" ? "Decision recorded. Ready for booking by the travel desk." : "Reason stored with the decision.",
      variant: decision === "APPROVED" ? "success" : "info",
    });
    setDecision(null);
    setReason("");
  }

  const tabs: { value: Tab; label: string; disabled?: boolean; count?: number }[] = [
    { value: "itinerary", label: "Itinerary" },
    { value: "ledger", label: "Trade-off Ledger", disabled: !it, count: it?.ledger.length },
    { value: "ask", label: "Ask this itinerary", disabled: !it },
    { value: "whatif", label: "What-if", disabled: !it },
    { value: "activity", label: "Activity", count: events.length },
    { value: "request", label: "Request details" },
  ];

  const stepIndex = t.status === "OPTIMIZATION_FAILED" ? 1 : flow.indexOf(t.status);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/trips" className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All trips
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-primary">{t.code}</span>
            <TripStatusBadge trip={t} />
            {it?.edited && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-400">Edited by reviewer</span>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Plane className="size-3.5" />{routeLabel(t)}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatDateRange(t.departDate, t.returnDate)}</span>
            <span className="flex items-center gap-1.5"><Users className="size-3.5" />{names.join(", ")}</span>
            <span className="flex items-center gap-1.5"><Briefcase className="size-3.5" />{t.purpose}</span>
            <span className="flex items-center gap-1.5"><Wallet className="size-3.5" />Budget {formatInr(t.budget)}</span>
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          {(t.status === "DRAFT" || t.status === "OPTIMIZATION_FAILED") && (
            <>
              <Link href={`/planning?edit=${t.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                <Pencil />
                Edit request
              </Link>
              <Button size="lg" onClick={run} className="shadow-md shadow-primary/25">
                <Sparkles />
                {t.status === "DRAFT" ? "Run optimizer" : "Retry optimizer"}
              </Button>
            </>
          )}
          {(t.status === "OPTIMIZED" || t.status === "UNDER_REVIEW") && (
            <>
              <Button variant="outline" size="lg" onClick={run}>
                <RefreshCw />
                Re-run
              </Button>
              {t.status === "OPTIMIZED" && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    actions.startReview(t.id);
                    toast("Moved to review");
                  }}
                >
                  <Eye />
                  Start review
                </Button>
              )}
              <Button variant="destructive" size="lg" onClick={() => setDecision("REJECTED")}>
                <XCircle />
                Reject
              </Button>
              <Button size="lg" onClick={() => setDecision("APPROVED")} className="bg-success text-white shadow-md shadow-success/25 hover:bg-success/90">
                <CheckCircle2 />
                Approve
              </Button>
            </>
          )}
          {decided && (
            <>
              <Button variant="outline" size="lg" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={duplicating}
                onClick={async () => {
                  setDuplicating(true);
                  try {
                    const copy = await actions.duplicateTrip(t.id);
                    toast(`Duplicated as ${copy.code}`);
                    router.push(`/trips/${copy.id}`);
                  } catch (e) {
                    toast("Couldn't duplicate trip", { description: (e as Error).message, variant: "error" });
                    setDuplicating(false);
                  }
                }}
              >
                {duplicating ? <Loader2 className="animate-spin" /> : <Copy />}
                Duplicate
              </Button>
            </>
          )}
          {canDelete && !decided && t.status !== "OPTIMIZING" && (
            <Button variant="ghost" size="icon-lg" aria-label="Delete trip" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      {/* Status flow */}
      <Card className="py-4">
        <CardContent className="px-4">
          <ol className="flex items-center">
            {flow.map((st, i) => {
              const failed = t.status === "OPTIMIZATION_FAILED" && i === 1;
              const done = i < stepIndex || (decided && i === 4);
              const current = i === stepIndex && !decided;
              const label = st === "DECIDED" && t.outcome ? (t.outcome === "APPROVED" ? "Approved" : "Rejected") : failed ? "Failed" : statusLabel[st];
              return (
                <li key={st} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                        failed && "border-destructive bg-destructive text-white",
                        !failed && done && (st === "DECIDED" && t.outcome === "REJECTED" ? "border-destructive bg-destructive text-white" : "border-success bg-success text-white"),
                        !failed && current && "border-primary bg-primary/10 text-primary",
                        !failed && !done && !current && "border-border text-muted-foreground"
                      )}
                    >
                      {failed ? <AlertOctagon className="size-4" /> : done ? (st === "DECIDED" && t.outcome === "REJECTED" ? <XCircle className="size-4" /> : <Check className="size-4" />) : i + 1}
                    </span>
                    <span className={cn("hidden text-xs font-medium sm:block", current || failed ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                  </div>
                  {i < flow.length - 1 && <span className={cn("mx-2 h-0.5 flex-1 rounded-full sm:mb-5", i < stepIndex ? "bg-success" : "bg-border")} />}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {decided && (
        <div
          className={cn(
            "flex gap-3 rounded-xl border p-4",
            t.outcome === "APPROVED" ? "border-success/30 bg-success/[0.07]" : "border-destructive/30 bg-destructive/[0.06]"
          )}
        >
          {t.outcome === "APPROVED" ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <XCircle className="mt-0.5 size-5 text-destructive" />}
          <div className="text-sm">
            <p className="font-semibold">{t.outcome === "APPROVED" ? "Approved" : "Rejected"} {t.decidedAt && `· ${formatDate(t.decidedAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}</p>
            <p className="text-muted-foreground">
              {(() => {
                const ev = events.find((e) => e.type === "DECISION");
                const r = ev?.payload?.reason as string | null | undefined;
                return `${ev?.actor ?? "Reviewer"} recorded this decision${r ? `: “${r}”` : "."} Approved itineraries are final — duplicate the trip to request changes.`;
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="no-print scrollbar-thin -mx-1 overflow-x-auto border-b px-1">
        <div className="flex min-w-max gap-1">
          {tabs.map((x) => (
            <button
              key={x.value}
              disabled={x.disabled}
              onClick={() => setTab(x.value)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                tab === x.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {x.label}
              {x.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{x.count}</span>}
              {tab === x.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>

      {tab === "itinerary" && (
        <div className="space-y-6">
          {t.status === "OPTIMIZING" && <PipelineProgress />}

          {t.status === "DRAFT" && (
            <Card>
              <EmptyState
                icon={Target}
                title="Ready to optimize"
                description="This request is a draft. Run the optimizer to search flights and stays, check budget & policy, and compose an explainable itinerary."
                action={
                  <Button size="lg" onClick={run}>
                    <Sparkles />
                    Run optimizer
                  </Button>
                }
              />
            </Card>
          )}

          {t.status === "OPTIMIZATION_FAILED" && (
            <Card className="border-destructive/30">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertOctagon className="size-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-semibold">Optimization failed</p>
                  <p className="text-sm text-muted-foreground">{t.failureReason}</p>
                  <p className="text-sm text-muted-foreground">Nothing was guessed or partially booked. Adjust the filters and try again.</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/planning?edit=${t.id}`} className={buttonVariants({ variant: "outline" })}>
                    <Pencil />
                    Adjust filters
                  </Link>
                  <Button onClick={run}>
                    <RefreshCw />
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {it && t.status !== "OPTIMIZING" && (
            <>
              <CostSummary trip={t} it={it} />
              <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                <div className="space-y-4">
                  <FlightCard flight={it.outbound} label="Outbound" pax={it.travelers} editable={editable} onChange={() => { setLedgerKind("outbound"); setTab("ledger"); }} />
                  {it.return && <FlightCard flight={it.return} label="Return" pax={it.travelers} editable={editable} onChange={() => { setLedgerKind("return"); setTab("ledger"); }} />}
                  {it.stay && <StayCard hotel={it.stay} nights={it.nights} rooms={it.rooms} editable={editable} onChange={() => { setLedgerKind("stay"); setTab("ledger"); }} />}
                  <Rationale it={it} />
                </div>
                <div className="space-y-4">
                  <ConstraintFlags it={it} />
                  <Card className="no-print">
                    <CardHeader>
                      <CardTitle>Why this and not that?</CardTitle>
                      <CardDescription>{it.ledger.filter((l) => !l.won).length} alternatives were rejected with a specific reason.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setTab("ledger")}>Open Trade-off Ledger</Button>
                      <Button variant="outline" onClick={() => setTab("ask")}>Ask this itinerary</Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "ledger" && it && <TradeoffLedger key={ledgerKind} it={it} editable={editable} onUse={swapOption} initialKind={ledgerKind} />}

      {tab === "ask" && it && (
        <Card className="h-[min(70dvh,640px)] gap-0 overflow-hidden py-0">
          <Chat
            mode="itinerary"
            tripId={t.id}
            className="h-full"
            suggestions={["Why this outbound flight?", "Why not a cheaper flight?", "Why not an earlier flight?", "Why this hotel?", "What are the policy issues?", "How much does it cost?", "How much did we save?"]}
          />
        </Card>
      )}

      {tab === "whatif" && it && <WhatIf trip={t} editable={!decided} />}

      {tab === "activity" && (
        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Every pipeline run, edit and decision for this trip — append-only.</CardDescription>
          </CardHeader>
          <CardContent>
            <AuditTimeline events={events} />
          </CardContent>
        </Card>
      )}

      {tab === "request" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Trip request</CardTitle>
              <CardDescription>Created by {t.createdBy} · {timeAgo(t.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Travelers" value={names.join(", ")} />
              <Detail label="Route" value={routeLabel(t)} />
              <Detail label="Dates" value={formatDateRange(t.departDate, t.returnDate)} />
              <Detail label="Purpose" value={t.purpose} />
              <Detail label="Rooms" value={String(t.rooms)} />
              <Detail label="Budget" value={formatInr(t.budget)} />
              {t.notes && <Detail label="Notes" value={t.notes} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Optimizer filters</CardTitle>
              <CardDescription>Rules applied when screening options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Priority" value={priorityLabel[t.filters.priority]} />
              <Detail label="Cabin" value={cabinLabel[t.filters.cabin]} />
              <Detail label="Max stops" value={t.filters.maxStops === 0 ? "Non-stop only" : `Up to ${t.filters.maxStops}`} />
              <Detail label="Departure window" value={windowLabel[t.filters.departureWindow]} />
              <Detail label="Red-eyes" value={t.filters.avoidRedEye ? "Avoid" : "Allowed"} />
              <Detail label="Preferred airlines" value={t.filters.preferredAirlines.join(", ") || "None"} />
              <Detail label="Excluded airlines" value={t.filters.excludedAirlines.join(", ") || "None"} />
              <Detail label="Hotel rating" value={`${t.filters.minHotelRating.toFixed(1)}+`} />
              <Detail label="Hotel distance" value={`≤ ${t.filters.maxHotelDistanceKm} km`} />
              <Detail label="Nightly cap" value={t.filters.maxNightlyRate ? formatInr(t.filters.maxNightlyRate) : "Company policy"} />
              <Detail label="Amenities" value={t.filters.requiredAmenities.map((a) => amenityLabel[a]).join(", ") || "None"} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Decision dialog */}
      <Dialog open={decision !== null} onOpenChange={(o) => { if (!o) { setDecision(null); setReasonError(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === "APPROVED" ? `Approve ${t.code}?` : `Reject ${t.code}?`}</DialogTitle>
            <DialogDescription>
              {decision === "APPROVED"
                ? `Total ${it ? formatInr(it.totalCost) : ""} against a ${formatInr(t.budget)} budget. The trip moves to DECIDED and the decision is recorded in the audit trail.`
                : "A reason is required and will be stored with the decision."}
            </DialogDescription>
          </DialogHeader>
          {decision === "APPROVED" && blocking.length > 0 && (
            <div className="mb-4 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertOctagon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{blocking.length} blocking issue{blocking.length > 1 ? "s" : ""}</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                  {blocking.map((b) => (
                    <li key={b.id}>{b.rule} — {b.lineItem}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">Approving records an explicit override — add a justification below.</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="reason">{decision === "REJECTED" ? "Reason for rejection *" : "Note (optional)"}</Label>
            <Textarea
              id="reason"
              value={reason}
              aria-invalid={reasonError}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(false);
              }}
              placeholder={decision === "REJECTED" ? "e.g. Trip no longer needed; meeting moved online." : "e.g. Approved per VP sign-off."}
            />
            {reasonError && <p className="text-xs text-destructive">Please enter a reason — rejections must be explained.</p>}
            {decision === "REJECTED" && (
              <div className="flex flex-wrap gap-1.5">
                {["Over budget", "Trip no longer required", "Choose a different date", "Policy violation", "Meeting moved online"].map((r) => (
                  <button key={r} type="button" onClick={() => { setReason(r); setReasonError(false); }} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground">
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</DialogClose>
            <Button
              size="lg"
              onClick={submitDecision}
              className={decision === "APPROVED" ? "bg-success text-white hover:bg-success/90" : "bg-destructive text-white hover:bg-destructive/90"}
            >
              {decision === "APPROVED" ? <CheckCircle2 /> : <XCircle />}
              {decision === "APPROVED" ? "Approve itinerary" : "Reject itinerary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {t.code}?</DialogTitle>
            <DialogDescription>The trip is removed from the workspace. Its audit history is kept.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</DialogClose>
            <Button
              size="lg"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                actions.deleteTrip(t.id);
                toast(`${t.code} deleted`);
                router.push("/trips");
              }}
            >
              <Trash2 />
              Delete trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2.5 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
