"use client";

import { useState } from "react";
import { Save, ShieldCheck, User, Bell, Palette, Database, RotateCcw, Monitor, Moon, Sun, Server } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChipToggle, Segmented, Switch } from "@/components/ui/fields";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/app/common";
import { actions, defaultPolicy, useStore } from "@/lib/store";
import { airlines } from "@/lib/catalog";
import { API_URL } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Policy } from "@/lib/types";

export default function SettingsPage() {
  const s = useStore();
  const [name, setName] = useState(s.session?.name ?? "");
  const [email, setEmail] = useState(s.session?.email ?? "");
  const [policy, setPolicy] = useState<Policy>(s.policy);
  const [resetOpen, setResetOpen] = useState(false);
  const dirtyPolicy = JSON.stringify(policy) !== JSON.stringify(s.policy);

  const num = (k: keyof Policy) => (e: React.ChangeEvent<HTMLInputElement>) => setPolicy((p) => ({ ...p, [k]: Number(e.target.value.replace(/\D/g, "")) || 0 }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Your profile, the company travel policy the optimizer enforces, and workspace preferences." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="size-4" />Profile</CardTitle>
          <CardDescription>Shown on decisions and in the audit trail.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              actions.updateProfile({ name: name.trim(), email: email.trim() });
              toast("Profile saved");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="p-name">Full name</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground capitalize">Role: {s.session?.role}</p>
              <Button type="submit" disabled={name === s.session?.name && email === s.session?.email}>
                <Save />
                Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" />Travel policy</CardTitle>
          <CardDescription>Rules the constraint check enforces on every itinerary. Changes apply to the next optimizer run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <PolicyField label="Manager approval for flights over" prefix="₹" value={policy.managerApprovalFlightOver} onChange={num("managerApprovalFlightOver")} />
            <PolicyField label="Advance booking (days)" value={policy.advanceBookingDays} onChange={num("advanceBookingDays")} />
            <PolicyField label="Hotel cap — domestic (per night)" prefix="₹" value={policy.maxNightlyRate} onChange={num("maxNightlyRate")} />
            <PolicyField label="Hotel cap — international (per night)" prefix="₹" value={policy.maxNightlyRateIntl} onChange={num("maxNightlyRateIntl")} />
            <PolicyField label="Business class minimum flight length (hours)" value={policy.businessClassMinHours} onChange={num("businessClassMinHours")} />
          </div>
          <div className="space-y-2">
            <Label>Preferred-vendor airlines</Label>
            <ChipToggle selected={policy.preferredAirlines} onChange={(v) => setPolicy((p) => ({ ...p, preferredAirlines: v }))} options={airlines.map((a) => ({ value: a, label: a }))} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setPolicy(defaultPolicy)}>
              <RotateCcw />
              Restore defaults
            </Button>
            <Button
              disabled={!dirtyPolicy}
              onClick={() => {
                actions.updatePolicy(policy);
                toast("Travel policy updated", { description: "Re-run the optimizer on open trips to apply it." });
              }}
            >
              <Save />
              Save policy
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="size-4" />Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <Segmented
              value={s.settings.theme}
              onChange={(v) => actions.updateSettings({ theme: v })}
              options={[
                { value: "light", label: <span className="flex items-center gap-1.5"><Sun className="size-4" />Light</span> },
                { value: "dark", label: <span className="flex items-center gap-1.5"><Moon className="size-4" />Dark</span> },
                { value: "system", label: <span className="flex items-center gap-1.5"><Monitor className="size-4" />System</span> },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="size-4" />Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle label="Decisions" hint="When an itinerary is approved or rejected" checked={s.settings.notifyDecisions} onChange={(v) => actions.updateSettings({ notifyDecisions: v })} />
            <Toggle label="Pipeline runs" hint="When the optimizer finishes or fails" checked={s.settings.notifyPipeline} onChange={(v) => actions.updateSettings({ notifyPipeline: v })} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="size-4" />Workspace data</CardTitle>
          <CardDescription>
            {s.session?.mode === "api" ? (
              <>Signed in via the API at <code className="rounded bg-muted px-1 text-xs">{API_URL}</code>.</>
            ) : (
              <>Workspace data is stored in this browser. Start the backend (<code className="rounded bg-muted px-1 text-xs">docker compose up</code>) to sign in against the API at <code className="rounded bg-muted px-1 text-xs">{API_URL}</code>.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="size-4" />
            {s.trips.length} trips · {s.travelers.length} travelers · {s.docs.length} documents · {s.audit.length} audit events
          </div>
          <Button variant="destructive" onClick={() => setResetOpen(true)}>
            <RotateCcw />
            Reset sample data
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset workspace?</DialogTitle>
            <DialogDescription>All trips, travelers, documents, chats and audit events are replaced with the sample dataset. You stay signed in.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</DialogClose>
            <Button
              size="lg"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                actions.resetWorkspace();
                setPolicy(defaultPolicy);
                setResetOpen(false);
                toast("Workspace reset");
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PolicyField({ label, value, onChange, prefix }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; prefix?: string }) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <Input id={id} inputMode="numeric" value={value.toLocaleString("en-IN")} onChange={onChange} className={prefix ? "pl-7" : undefined} />
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
