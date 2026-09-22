"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type TravelerFormValues = {
  name: string;
  preferences: Record<string, string>;
};

export function TravelerForm({
  onSubmit,
}: {
  onSubmit?: (values: TravelerFormValues) => void;
}) {
  const [name, setName] = useState("");
  const [seatPreference, setSeatPreference] = useState("");
  const [dietary, setDietary] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const value = tagInput.trim();
    if (value && !tags.includes(value)) {
      setTags((prev) => [...prev, value]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const preferences: Record<string, string> = {};
    if (seatPreference) preferences.seat = seatPreference;
    if (dietary) preferences.dietary = dietary;
    if (notes) preferences.notes = notes;
    if (tags.length) preferences.tags = tags.join(", ");

    onSubmit?.({ name, preferences });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a traveler</CardTitle>
        <CardDescription>
          Name is required; preferences are free-form and used later when composing itineraries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="traveler-name">Full name</Label>
            <Input
              id="traveler-name"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="traveler-seat">Seat preference</Label>
              <Input
                id="traveler-seat"
                placeholder="Aisle, window, no preference..."
                value={seatPreference}
                onChange={(e) => setSeatPreference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="traveler-dietary">Dietary restrictions</Label>
              <Input
                id="traveler-dietary"
                placeholder="Vegetarian, halal, none..."
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="traveler-tags">Structured tags</Label>
            <Input
              id="traveler-tags"
              placeholder="Type a tag and press Enter..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag}`}
                      className="rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="traveler-notes">Notes</Label>
            <Input
              id="traveler-notes"
              placeholder="Anything else worth knowing for this traveler..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full sm:w-auto">
            <UserPlus className="size-4" />
            Add traveler
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
