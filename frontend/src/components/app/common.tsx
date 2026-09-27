"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { statusClass, statusLabel } from "@/lib/format";
import { dismiss, useToasts } from "@/lib/toast";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function TripStatusBadge({ trip, className }: { trip: Pick<Trip, "status" | "outcome">; className?: string }) {
  const key = trip.status === "DECIDED" && trip.outcome ? trip.outcome : trip.status;
  const label = trip.status === "DECIDED" && trip.outcome ? (trip.outcome === "APPROVED" ? "Approved" : "Rejected") : statusLabel[trip.status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", statusClass[key], className)}>
      <span className={cn("size-1.5 rounded-full bg-current", trip.status === "OPTIMIZING" && "animate-pulse")} />
      {label}
    </Badge>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(92vw,24rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = t.variant === "error" ? XCircle : t.variant === "info" ? Info : CheckCircle2;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.22 }}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-xl"
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4.5 shrink-0",
                  t.variant === "error" ? "text-destructive" : t.variant === "info" ? "text-primary" : "text-success"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
