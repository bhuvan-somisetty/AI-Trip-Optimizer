"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, ScrollText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/fields";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/app/common";
import { eventMeta } from "@/components/app/audit-timeline";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { AuditEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 25;

export default function AuditPage() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [actor, setActor] = useState("");
  const [trip, setTrip] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const actors = useMemo(() => [...new Set(s.audit.map((a) => a.actor))].sort(), [s.audit]);
  const tripCode = (id: string | null) => (id ? s.trips.find((t) => t.id === id)?.code : undefined);

  const list = useMemo(
    () =>
      s.audit.filter((a) => {
        if (type && a.type !== type) return false;
        if (actor && a.actor !== actor) return false;
        if (trip && a.tripId !== trip) return false;
        if (from && a.createdAt.slice(0, 10) < from) return false;
        if (to && a.createdAt.slice(0, 10) > to) return false;
        if (q && !`${a.summary} ${a.actor} ${tripCode(a.tripId) ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [s.audit, type, actor, trip, from, to, q] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shown = list.slice(0, page * PAGE);
  const active = [q, type, actor, trip, from, to].filter(Boolean).length;

  function exportCsv() {
    const rows = [["Timestamp", "Event", "Actor", "Trip", "Summary"], ...list.map((a) => [a.createdAt, a.type, a.actor, tripCode(a.tripId) ?? "", a.summary])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Audit trail exported", { description: `${list.length} events` });
  }

  function clear() {
    setQ(""); setType(""); setActor(""); setTrip(""); setFrom(""); setTo(""); setPage(1);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Audit trail"
        description="Append-only history of every pipeline run, edit, decision and knowledge-base change. Independent of dashboard aggregation."
        actions={
          <Button variant="outline" size="lg" onClick={exportCsv} disabled={!list.length}>
            <Download />
            Export CSV
          </Button>
        }
      />

      <Card className="py-4">
        <CardContent className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search events…" className="pl-9" />
          </div>
          <NativeSelect value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Event type">
            <option value="">All events</option>
            {(Object.keys(eventMeta) as AuditEvent["type"][]).map((t) => (
              <option key={t} value={t}>{eventMeta[t].label}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} aria-label="Actor">
            <option value="">All people</option>
            {actors.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </NativeSelect>
          <NativeSelect value={trip} onChange={(e) => { setTrip(e.target.value); setPage(1); }} aria-label="Trip">
            <option value="">All trips</option>
            {s.trips.map((t) => (
              <option key={t.id} value={t.id}>{t.code}</option>
            ))}
          </NativeSelect>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To" />
          </div>
          {active > 0 && (
            <div className="sm:col-span-2 lg:col-span-6">
              <Button variant="ghost" size="sm" onClick={clear}><X />Clear {active} filter{active > 1 ? "s" : ""}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{list.length} events</p>

      {list.length === 0 ? (
        <Card><EmptyState icon={ScrollText} title="No events match" description="Try widening the filters." /></Card>
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Trip</TableHead>
                  <TableHead className="pr-4">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => {
                  const m = eventMeta[a.type];
                  const Icon = m.icon;
                  const code = tripCode(a.tripId);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-4 whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatDate(a.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", m.className)}>
                          <Icon className="size-3.5" />
                          {m.label}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{a.actor}</TableCell>
                      <TableCell>{code ? <Link href={`/trips/${a.tripId}`} className="font-medium text-primary hover:underline">{code}</Link> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-xl pr-4 whitespace-normal text-muted-foreground">{a.summary}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {shown.length < list.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Load more ({list.length - shown.length} remaining)</Button>
        </div>
      )}
    </div>
  );
}
