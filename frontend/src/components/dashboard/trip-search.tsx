"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Bus, Layers, Plane, Search, TrainFront, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/fields";
import { AirportPicker } from "@/components/trips/airport-picker";
import { addDays, toIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Mode = "flight" | "train" | "bus" | "all";
const MODES: { id: Mode; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "flight", label: "Flights", icon: Plane, hint: "Direct and connecting flights with live fares" },
  { id: "train", label: "Trains", icon: TrainFront, hint: "Real train schedules from Google Maps" },
  { id: "bus", label: "Buses", icon: Bus, hint: "Intercity buses with their timings" },
  { id: "all", label: "Compare all", icon: Layers, hint: "Flights, trains and buses side by side" },
];

/**
 * The dashboard's trip search: pick how to travel, from, to, dates and travellers, then open the
 * results page (/search). Nothing is searched until the user presses Search.
 */
export function TripSearch() {
  const router = useRouter();
  const today = toIsoDate(new Date());
  const [mode, setMode] = useState<Mode>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(toIsoDate(addDays(new Date(), 14)));
  const [back, setBack] = useState("");
  const [travellers, setTravellers] = useState(1);
  const ok = !!from && !!to && from !== to && date >= today && (!back || back >= date);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const params = new URLSearchParams({ from, to, date, travellers: String(travellers), mode });
    if (back) params.set("return", back);
    router.push(`/search?${params}`);
  }

  return (
    <Card className="py-0">
      <CardContent className="space-y-4 p-5">
        <div role="tablist" aria-label="Travel by" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                mode === m.id ? "border-primary/50 bg-primary/5" : "hover:bg-accent"
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", mode === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <m.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="hidden text-[11px] leading-tight text-muted-foreground md:block">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <form onSubmit={search} className="grid gap-3 md:grid-cols-[1fr_auto_1fr_9.5rem_9.5rem_5.5rem_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="dash-from">From</Label>
            <AirportPicker id="dash-from" value={from} exclude={to} onChange={setFrom} />
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Swap" className="mx-auto" onClick={() => { setFrom(to); setTo(from); }}>
            <ArrowLeftRight />
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="dash-to">To</Label>
            <AirportPicker id="dash-to" value={to} exclude={from} onChange={setTo} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-date">Departure</Label>
            <Input id="dash-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-return">Return (optional)</Label>
            <Input id="dash-return" type="date" min={date} value={back} onChange={(e) => setBack(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dash-travellers">Travellers</Label>
            <NativeSelect id="dash-travellers" value={String(travellers)} onChange={(e) => setTravellers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={!ok} className="h-9">
            <Search />
            Search
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
