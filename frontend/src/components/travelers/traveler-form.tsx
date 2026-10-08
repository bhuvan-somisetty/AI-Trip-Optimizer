"use client";

import { useState } from "react";
import { UserPlus, X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChipToggle, NativeSelect } from "@/components/ui/fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { airlines, cities } from "@/lib/catalog";
import { actions } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Traveler } from "@/lib/types";

export type TravelerFormValues = Omit<Traveler, "id" | "createdAt">;

const departments = ["Sales", "Engineering", "Leadership", "Marketing", "Operations", "Finance", "HR", "Product"];

export function TravelerForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Partial<TravelerFormValues>;
  onSubmit: (values: TravelerFormValues) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "Sales");
  const [homeCity, setHomeCity] = useState(initial?.homeCity ?? "BLR");
  const [seat, setSeat] = useState(initial?.preferences?.seat ?? "No preference");
  const [dietary, setDietary] = useState(initial?.preferences?.dietary ?? "");
  const [notes, setNotes] = useState(initial?.preferences?.notes ?? "");
  const [preferredAirlines, setPreferredAirlines] = useState<string[]>(initial?.preferences?.preferredAirlines ?? []);
  const [tags, setTags] = useState<string[]>(initial?.preferences?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const value = tagInput.trim().toLowerCase();
    if (value && !tags.includes(value)) setTags((prev) => [...prev, value]);
    setTagInput("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        department,
        homeCity,
        preferences: {
          seat: seat || undefined,
          dietary: dietary || undefined,
          notes: notes || undefined,
          tags,
          preferredAirlines,
        },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="traveler-name">Full name *</Label>
          <Input id="traveler-name" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="traveler-email">Work email</Label>
          <Input id="traveler-email" type="email" placeholder="jane@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="traveler-dept">Department</Label>
          <NativeSelect id="traveler-dept" value={department} onChange={(e) => setDepartment(e.target.value)}>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="traveler-city">Home city</Label>
          <NativeSelect id="traveler-city" value={homeCity} onChange={(e) => setHomeCity(e.target.value)}>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="traveler-seat">Seat preference</Label>
          <NativeSelect id="traveler-seat" value={seat} onChange={(e) => setSeat(e.target.value)}>
            {["No preference", "Aisle", "Window", "Extra legroom"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="traveler-dietary">Dietary requirements</Label>
          <Input id="traveler-dietary" placeholder="Vegetarian, halal, none…" value={dietary} onChange={(e) => setDietary(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preferred airlines</Label>
        <ChipToggle selected={preferredAirlines} onChange={setPreferredAirlines} options={airlines.map((a) => ({ value: a, label: a }))} />
        <p className="text-xs text-muted-foreground">Used as a scoring boost when this traveler is on a trip.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="traveler-tags">Tags</Label>
        <Input id="traveler-tags" placeholder="Type a tag and press Enter…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag} />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="gap-1 pr-1">
                {tag}
                <button type="button" onClick={() => setTags((p) => p.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="rounded-full p-0.5 hover:bg-muted">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="traveler-notes">Notes</Label>
        <Input id="traveler-notes" placeholder="Anything else worth knowing for this traveler…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <DialogFooter className="mt-2">
        {onCancel && (
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={!name.trim() || saving}>
          {saving ? <Loader2 className="animate-spin" /> : initial?.name ? <Save /> : <UserPlus />}
          {submitLabel ?? (initial?.name ? "Save changes" : "Add traveler")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TravelerDialog({
  open,
  onOpenChange,
  traveler,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  traveler?: Traveler | null;
  onCreated?: (t: Traveler) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{traveler ? `Edit ${traveler.name}` : "Add a traveler"}</DialogTitle>
          <DialogDescription>Name is required. Preferences feed straight into itinerary scoring.</DialogDescription>
        </DialogHeader>
        <TravelerForm
          key={traveler?.id ?? "new"}
          initial={traveler ?? undefined}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (values) => {
            try {
              if (traveler) {
                await actions.updateTraveler(traveler.id, values);
                toast("Traveler updated", { description: values.name });
              } else {
                const t = await actions.addTraveler(values);
                toast("Traveler added", { description: `${t.name} can now be selected on trips.` });
                onCreated?.(t);
              }
              onOpenChange(false);
            } catch (e) {
              toast(traveler ? "Couldn't update traveler" : "Couldn't add traveler", { description: (e as Error).message, variant: "error" });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
