"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserPlus, Search, Pencil, Trash2, Plane, Mail, MapPin, Utensils, Armchair, Users, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/fields";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/app/common";
import { TravelerDialog } from "@/components/travelers/traveler-form";
import { actions, useStore } from "@/lib/store";
import { cityByCode } from "@/lib/catalog";
import { formatCompactInr, initials } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { Traveler } from "@/lib/types";
import { cn } from "@/lib/utils";

const avatarColors = ["bg-sky-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-600", "bg-indigo-500"];

export default function TravelersPage() {
  const s = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<Traveler | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Traveler | null>(null);
  const focus = params.get("focus");

  useEffect(() => {
    if (focus) document.getElementById(`trv-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  const stats = useMemo(() => {
    const m: Record<string, { trips: number; spend: number }> = {};
    for (const t of s.trips)
      for (const id of t.travelerIds) {
        m[id] ??= { trips: 0, spend: 0 };
        m[id].trips += 1;
        if (t.status === "DECIDED" && t.outcome === "APPROVED" && t.itinerary) m[id].spend += t.itinerary.totalCost / t.travelerIds.length;
      }
    return m;
  }, [s.trips]);

  const depts = [...new Set(s.travelers.map((t) => t.department))].sort();
  const list = s.travelers.filter(
    (t) => (!dept || t.department === dept) && `${t.name} ${t.email} ${t.department} ${t.preferences.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Travelers"
        description="People your team books travel for. Preferences here are applied automatically when they're added to a trip."
        actions={
          <Button size="lg" onClick={() => { setEditing(null); setOpen(true); }} className="shadow-md shadow-primary/20">
            <UserPlus />
            Add traveler
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, department or tag…" className="h-9 pl-9" />
        </div>
        <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-48" aria-label="Department">
          <option value="">All departments</option>
          {depts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </NativeSelect>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title={s.travelers.length ? "No travelers match" : "No travelers yet"} description="Add the people you book travel for — you'll pick them when creating a trip." action={<Button onClick={() => setOpen(true)}><UserPlus />Add traveler</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t, i) => {
            const st = stats[t.id] ?? { trips: 0, spend: 0 };
            return (
              <Card key={t.id} id={`trv-${t.id}`} className={cn("gap-4 py-5 transition-all hover:shadow-lg", focus === t.id && "ring-2 ring-primary")}>
                <CardContent className="space-y-4 px-5">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white", avatarColors[i % avatarColors.length])}>{initials(t.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Mail className="size-3" />{t.email || "No email"}</p>
                    </div>
                    <Badge variant="secondary">{t.department}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{cityByCode[t.homeCity]?.name ?? t.homeCity}</span>
                    <span className="flex items-center gap-1.5"><Armchair className="size-3.5" />{t.preferences.seat || "No preference"}</span>
                    <span className="col-span-2 flex items-center gap-1.5"><Utensils className="size-3.5" />{t.preferences.dietary || "No dietary notes"}</span>
                  </div>
                  {(t.preferences.preferredAirlines.length > 0 || t.preferences.tags.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {t.preferences.preferredAirlines.map((a) => (
                        <Badge key={a} variant="outline" className="gap-1 border-primary/30 text-primary"><Plane className="size-3" />{a}</Badge>
                      ))}
                      {t.preferences.tags.map((tag) => (
                        <Badge key={tag} variant="outline">#{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="flex gap-4 text-xs">
                      <span><span className="font-semibold text-foreground">{st.trips}</span> <span className="text-muted-foreground">trips</span></span>
                      <span><span className="font-semibold text-foreground">{formatCompactInr(st.spend)}</span> <span className="text-muted-foreground">approved</span></span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Plan trip" title="Plan a trip" onClick={() => router.push("/planning")}>
                        <Plane />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => { setEditing(t); setOpen(true); }}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(t)}>
                        {st.trips > 0 ? <Lock /> : <Trash2 />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TravelerDialog open={open} onOpenChange={setOpen} traveler={editing} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          {deleting && (stats[deleting.id]?.trips ?? 0) > 0 ? (
            <>
              <DialogHeader>
                <DialogTitle>Can&apos;t delete {deleting.name}</DialogTitle>
                <DialogDescription>
                  {deleting.name} is on {stats[deleting.id].trips} trip{stats[deleting.id].trips > 1 ? "s" : ""}. Travelers with existing trips are kept so the audit history stays complete.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose className={buttonVariants({ size: "lg" })}>Got it</DialogClose>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Delete {deleting?.name}?</DialogTitle>
                <DialogDescription>This traveler has no trips and will be removed permanently.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</DialogClose>
                <Button
                  size="lg"
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => {
                    try {
                      actions.deleteTraveler(deleting!.id);
                      toast("Traveler deleted");
                    } catch (e) {
                      toast("Can't delete", { description: (e as Error).message, variant: "error" });
                    }
                    setDeleting(null);
                  }}
                >
                  <Trash2 />
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
