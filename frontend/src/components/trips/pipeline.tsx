"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Plane, Hotel, ShieldCheck, Layers, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const stages = [
  { icon: Plane, label: "Searching flights", sub: "Querying mock supplier inventory for outbound and return legs" },
  { icon: Hotel, label: "Searching stays", sub: "Pulling hotel inventory for the destination city" },
  { icon: ShieldCheck, label: "Screening constraints", sub: "Applying stops, time-window, rating and policy rules" },
  { icon: Layers, label: "Optimizing combinations", sub: "Scoring every feasible flight + stay combination under budget" },
  { icon: FileText, label: "Composing itinerary", sub: "Building the Trade-off Ledger and rationale" },
];

export function PipelineProgress() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, stages.length - 1)), 520);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Loader2 className="size-5 animate-spin" />
          </div>
          <div>
            <p className="font-semibold">Optimizer pipeline running</p>
            <p className="text-sm text-muted-foreground">Status: OPTIMIZING — results appear here in a few seconds.</p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500" initial={{ width: "4%" }} animate={{ width: `${((i + 1) / stages.length) * 100}%` }} transition={{ duration: 0.45 }} />
        </div>
        <ol className="space-y-3">
          {stages.map((st, idx) => {
            const done = idx < i;
            const active = idx === i;
            const Icon = st.icon;
            return (
              <li key={st.label} className={cn("flex items-start gap-3 transition-opacity", idx > i && "opacity-40")}>
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                    done && "border-success bg-success text-white",
                    active && "border-primary bg-primary/10 text-primary"
                  )}
                >
                  {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
                </span>
                <div>
                  <p className="text-sm font-medium">{st.label}</p>
                  <p className="text-xs text-muted-foreground">{st.sub}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
