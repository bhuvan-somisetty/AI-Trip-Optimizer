"use client";

import { Bus, Layers, Plane, TrainFront, type LucideIcon } from "lucide-react";
import type { TransportMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TravelChoice = "flight" | "train" | "bus" | "all";

export const TRAVEL_CHOICES: { id: TravelChoice; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "flight", label: "Flights", icon: Plane, hint: "Direct and connecting flights with live fares" },
  { id: "train", label: "Trains", icon: TrainFront, hint: "Real train schedules from Google Maps" },
  { id: "bus", label: "Buses", icon: Bus, hint: "Intercity buses with their timings" },
  { id: "all", label: "Compare all", icon: Layers, hint: "Flights, trains and buses side by side" },
];

/** The trip's transport modes for a card, and the card for a trip's modes (anything mixed is "all"). */
export function modesOf(choice: TravelChoice): TransportMode[] {
  return choice === "all" ? ["flight", "train", "bus"] : [choice];
}

export function choiceOf(modes: TransportMode[] | undefined): TravelChoice {
  return modes?.length === 1 ? modes[0] : "all";
}

export function isTravelChoice(value: string | null): value is TravelChoice {
  return value === "flight" || value === "train" || value === "bus" || value === "all";
}

/** Flights, Trains, Buses or Compare all, as four cards (dashboard search and the trip form). */
export function ModePicker({ value, onChange, className }: { value: TravelChoice; onChange: (v: TravelChoice) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Travel by" className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {TRAVEL_CHOICES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={value === m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
            value === m.id ? "border-primary/50 bg-primary/5" : "hover:bg-accent"
          )}
        >
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", value === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            <m.icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{m.label}</span>
            <span className="hidden text-[11px] leading-tight text-muted-foreground md:block">{m.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
