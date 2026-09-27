"use client";

import {
  FilePlus2,
  Sparkles,
  AlertOctagon,
  Pencil,
  Eye,
  Gavel,
  Upload,
  Trash2,
  UserPlus,
  UserCog,
  UserMinus,
  MessageSquare,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { AuditEvent } from "@/lib/types";
import { formatDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const eventMeta: Record<AuditEvent["type"], { icon: LucideIcon; label: string; className: string }> = {
  TRIP_CREATED: { icon: FilePlus2, label: "Trip created", className: "bg-muted text-foreground" },
  TRIP_DELETED: { icon: Trash2, label: "Trip deleted", className: "bg-destructive/10 text-destructive" },
  PIPELINE_RUN: { icon: Sparkles, label: "Pipeline run", className: "bg-primary/10 text-primary" },
  PIPELINE_FAILED: { icon: AlertOctagon, label: "Pipeline failed", className: "bg-destructive/10 text-destructive" },
  ITINERARY_EDITED: { icon: Pencil, label: "Itinerary edited", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  REVIEW_STARTED: { icon: Eye, label: "Review started", className: "bg-warning/15 text-amber-700 dark:text-warning" },
  DECISION: { icon: Gavel, label: "Decision", className: "bg-success/15 text-emerald-700 dark:text-success" },
  DOCUMENT_UPLOAD: { icon: Upload, label: "Document uploaded", className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" },
  DOCUMENT_DELETED: { icon: Trash2, label: "Document removed", className: "bg-destructive/10 text-destructive" },
  TRAVELER_CREATED: { icon: UserPlus, label: "Traveler added", className: "bg-muted text-foreground" },
  TRAVELER_UPDATED: { icon: UserCog, label: "Traveler updated", className: "bg-muted text-foreground" },
  TRAVELER_DELETED: { icon: UserMinus, label: "Traveler deleted", className: "bg-destructive/10 text-destructive" },
  ASSISTANT_QUERY: { icon: MessageSquare, label: "Assistant query", className: "bg-muted text-foreground" },
  POLICY_UPDATED: { icon: ShieldCheck, label: "Policy updated", className: "bg-primary/10 text-primary" },
};

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <p className="py-6 text-center text-sm text-muted-foreground">No events recorded yet.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border">
      {events.map((e) => {
        const m = eventMeta[e.type];
        const Icon = m.icon;
        return (
          <li key={e.id} className="relative flex gap-4">
            <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background", m.className)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm">
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground"> · {e.actor}</span>
              </p>
              <p className="text-sm text-muted-foreground">{e.summary}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/80" title={new Date(e.createdAt).toLocaleString("en-IN")}>
                {formatDate(e.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {timeAgo(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
