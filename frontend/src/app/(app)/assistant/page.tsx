"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, Route, FileText, ShieldCheck, Quote, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, Segmented } from "@/components/ui/fields";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/app/common";
import { Chat } from "@/components/assistant/chat";
import { routeLabel, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AssistantPage() {
  const s = useStore();
  const params = useSearchParams();
  const withItinerary = s.trips.filter((t) => t.itinerary);
  const [mode, setMode] = useState<"knowledge" | "itinerary">(params.get("trip") ? "itinerary" : "knowledge");
  const [tripId, setTripId] = useState(params.get("trip") ?? withItinerary[0]?.id ?? "");

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Knowledge Assistant"
        description="Cited answers from your company's travel documents — or explanations grounded in a single itinerary. Each answer is clear about its source."
      />

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="flex min-h-[560px] flex-col gap-0 overflow-hidden py-0 lg:h-[calc(100dvh-15rem)]">
          <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "knowledge", label: <span className="flex items-center gap-1.5"><BookOpen className="size-4" />Knowledge base</span> },
                { value: "itinerary", label: <span className="flex items-center gap-1.5"><Route className="size-4" />Ask an itinerary</span> },
              ]}
            />
            {mode === "itinerary" && (
              <NativeSelect value={tripId} onChange={(e) => setTripId(e.target.value)} className="sm:w-80" aria-label="Itinerary">
                {withItinerary.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {routeLabel(t)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
          {mode === "knowledge" ? (
            <Chat
              key="kb"
              mode="knowledge"
              className="min-h-0 flex-1"
              initialQuestion={params.get("q")}
              suggestions={[
                "Do flights over ₹25,000 need approval?",
                "What is the hotel cap for international trips?",
                "Do I need a visa for Singapore?",
                "How much baggage is included in economy?",
                "When should I submit expenses?",
                "Which airlines are preferred vendors?",
              ]}
            />
          ) : tripId ? (
            <Chat
              key={tripId}
              mode="itinerary"
              tripId={tripId}
              className="min-h-0 flex-1"
              suggestions={["Why this outbound flight?", "Why not a cheaper flight?", "Why this hotel?", "What are the policy issues?", "How much does it cost?"]}
            />
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">No optimized itineraries yet.</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" />
                How answers work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="flex gap-2"><Quote className="mt-0.5 size-4 shrink-0 text-primary" />Knowledge answers cite the exact document and chunk they came from.</p>
              <p className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />If no document covers a question, the assistant says so — it never guesses.</p>
              <p className="flex gap-2"><Route className="mt-0.5 size-4 shrink-0 text-violet-500" />Itinerary answers use only that trip&apos;s ledger, flags and audit data.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Knowledge base</CardTitle>
              <CardDescription>{s.docs.length} documents indexed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {s.docs.map((d) => (
                <Link key={d.id} href={`/documents?doc=${d.id}`} className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-muted/60">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{d.title}</span>
                </Link>
              ))}
              <Link href="/documents?upload=1" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}>
                <Upload />
                Upload a document
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
