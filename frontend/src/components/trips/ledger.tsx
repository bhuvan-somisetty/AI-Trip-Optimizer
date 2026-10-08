"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ArrowRightLeft, Plane, Hotel, PlaneLanding } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipToggle, NativeSelect, Segmented } from "@/components/ui/fields";
import { formatInr, reasonMeta } from "@/lib/format";
import type { Itinerary, LedgerEntry, ReasonCode } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = LedgerEntry["kind"];

export function TradeoffLedger({
  it,
  editable,
  onUse,
  initialKind = "outbound",
  swapUnavailable,
}: {
  it: Itinerary;
  editable: boolean;
  onUse: (kind: Kind, optionId: string, label: string) => void;
  initialKind?: Kind;
  /** When set, "Use this" is shown disabled with this text as its tooltip. */
  swapUnavailable?: string;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [codes, setCodes] = useState<string[]>([]);
  const [sort, setSort] = useState<"price" | "score">("price");
  // Backend results carry no option scores, so skip the score bar and sort there.
  const scored = it.ledger.some((l) => l.score > 0);

  const kinds: { value: Kind; label: React.ReactNode }[] = [
    { value: "outbound", label: <span className="flex items-center gap-1.5"><Plane className="size-3.5" />Outbound</span> },
    ...(it.return ? [{ value: "return" as Kind, label: <span className="flex items-center gap-1.5"><PlaneLanding className="size-3.5" />Return</span> }] : []),
    ...(it.ledger.some((l) => l.kind === "stay") ? [{ value: "stay" as Kind, label: <span className="flex items-center gap-1.5"><Hotel className="size-3.5" />Stay</span> }] : []),
  ];

  const rows = useMemo(() => {
    const list = it.ledger.filter((l) => l.kind === kind && (!codes.length || codes.includes(l.reasonCode)));
    return [...list].sort((a, b) => (sort === "price" ? a.price - b.price : b.score - a.score));
  }, [it.ledger, kind, codes, sort]);

  const counts = it.ledger
    .filter((l) => l.kind === kind)
    .reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.reasonCode]: (acc[l.reasonCode] ?? 0) + 1 }), {});
  const minPrice = Math.min(...it.ledger.filter((l) => l.kind === kind).map((l) => l.price));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade-off Ledger</CardTitle>
        <CardDescription>
          Every alternative the optimizer considered, its price, and the structured reason it won or lost.
          {editable && !swapUnavailable && " Swap any feasible option in — totals and flags recalculate instantly."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented value={kind} onChange={(v) => { setKind(v); setCodes([]); }} options={kinds} />
          <div className="flex flex-wrap items-center gap-2">
            <ChipToggle
              selected={codes}
              onChange={setCodes}
              options={(Object.keys(reasonMeta) as ReasonCode[])
                .filter((c) => counts[c])
                .map((c) => ({ value: c, label: `${reasonMeta[c].label} · ${counts[c]}` }))}
            />
            {scored && (
              <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as "price" | "score")} className="w-36" aria-label="Sort ledger">
                <option value="price">Sort: price</option>
                <option value="score">Sort: score</option>
              </NativeSelect>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((l) => (
            <div
              key={l.id}
              className={cn(
                "grid gap-3 rounded-xl border p-3 transition-colors sm:grid-cols-[auto_1fr_auto] sm:items-center",
                l.won ? "border-success/40 bg-success/[0.06]" : !l.feasible && "bg-muted/30"
              )}
            >
              <div className="hidden sm:block">
                {l.won ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className={cn("size-5", l.feasible ? "text-muted-foreground/60" : "text-destructive/60")} />}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn("font-medium", !l.feasible && "text-muted-foreground")}>{l.label}</p>
                  <Badge variant="outline" className={reasonMeta[l.reasonCode].className}>
                    {reasonMeta[l.reasonCode].label}
                  </Badge>
                  {!l.feasible && <span className="text-[11px] text-muted-foreground">screened out</span>}
                </div>
                {l.detail !== l.reason && <p className="text-xs text-muted-foreground">{l.detail}</p>}
                <p className="text-sm">{l.reason}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center sm:gap-1.5">
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatInr(l.price)}
                    <span className="text-xs font-normal text-muted-foreground">{l.kind === "stay" ? "/night" : "/pax"}</span>
                  </p>
                  {l.price === minPrice && <p className="text-[11px] font-medium text-emerald-600 dark:text-success">Lowest price</p>}
                </div>
                {scored && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" title={`Score ${l.score}/100`}>
                      <div className={cn("h-full rounded-full", l.won ? "bg-success" : "bg-primary/60")} style={{ width: `${l.score}%` }} />
                    </div>
                    <span className="w-7 text-right text-xs text-muted-foreground tabular-nums">{l.score}</span>
                  </div>
                )}
                {editable && !l.won && l.feasible && (
                  <span title={swapUnavailable}>
                    <Button variant="outline" size="xs" disabled={!!swapUnavailable} onClick={() => onUse(l.kind, l.optionId, l.label)}>
                      <ArrowRightLeft />
                      Use this
                    </Button>
                  </span>
                )}
              </div>
            </div>
          ))}
          {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">No options with the selected reasons.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
