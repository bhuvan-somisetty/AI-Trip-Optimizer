"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUp, BookOpen, Bot, FileText, Route, ShieldQuestion, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";
import { actions, useStore } from "@/lib/store";
import { answerFromItinerary, answerFromKnowledge } from "@/lib/knowledge";
import { uid } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Chat({
  mode,
  tripId,
  suggestions,
  initialQuestion,
  className,
}: {
  mode: "knowledge" | "itinerary";
  tripId?: string;
  suggestions: string[];
  initialQuestion?: string | null;
  className?: string;
}) {
  const s = useStore();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const askedInitial = useRef(false);

  const messages = useMemo(
    () => s.chat.filter((m) => m.mode === mode && (mode === "knowledge" || m.tripId === tripId)),
    [s.chat, mode, tripId]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, thinking]);

  function ask(q: string) {
    const question = q.trim();
    if (!question || thinking) return;
    const userMsg: ChatMessage = { id: uid("m_"), role: "user", content: question, mode, tripId, createdAt: new Date().toISOString() };
    actions.addMessages(userMsg);
    actions.logQuery(question, mode === "knowledge" ? "knowledge base" : "itinerary", tripId);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      let reply: ChatMessage;
      if (mode === "knowledge") {
        const a = answerFromKnowledge(question, s.docs);
        reply = { id: uid("m_"), role: "assistant", content: a.content, citations: a.citations, covered: a.covered, mode, createdAt: new Date().toISOString() };
      } else {
        const trip = s.trips.find((t) => t.id === tripId)!;
        const a = answerFromItinerary(question, trip);
        reply = { id: uid("m_"), role: "assistant", content: a.content, covered: a.covered, mode, tripId, createdAt: new Date().toISOString() };
      }
      actions.addMessages(reply);
      setThinking(false);
    }, 650 + Math.random() * 500);
  }

  useEffect(() => {
    if (initialQuestion && !askedInitial.current) {
      askedInitial.current = true;
      ask(initialQuestion);
    }
  });

  const SourceIcon = mode === "knowledge" ? BookOpen : Route;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
              mode === "knowledge" ? "bg-primary/10 text-primary" : "bg-violet-500/10 text-violet-700 dark:text-violet-400"
            )}
          >
            <SourceIcon className="size-3.5" />
            {mode === "knowledge" ? `Source: knowledge base · ${s.docs.length} docs` : "Source: this itinerary & its audit trail"}
          </span>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => actions.clearChat(mode, tripId)}>
            <Trash2 />
            Clear
          </Button>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {messages.length === 0 && !thinking && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-500 text-white shadow-lg shadow-primary/25">
              <Bot className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">{mode === "knowledge" ? "Ask anything about travel policy, visas or expenses" : "Ask why this itinerary looks the way it does"}</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                {mode === "knowledge"
                  ? "Every answer cites the document it came from. If nothing covers your question, I'll say so instead of guessing."
                  : "Answers come only from this trip's itinerary, Trade-off Ledger and constraint check — never from general knowledge."}
              </p>
            </div>
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {suggestions.map((q) => (
                <button key={q} onClick={() => ask(q)} className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                m.role === "user" ? "bg-muted text-foreground" : "bg-gradient-to-br from-primary to-cyan-500 text-white"
              )}
            >
              {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
            </div>
            <div className={cn("max-w-[85%] space-y-2", m.role === "user" && "items-end text-right")}>
              {m.role === "assistant" && m.covered === false && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-warning">
                  <ShieldQuestion className="size-3" />
                  Not covered by the {mode === "knowledge" ? "knowledge base" : "itinerary data"}
                </span>
              )}
              <div
                className={cn(
                  "inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed whitespace-pre-line",
                  m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm border bg-card"
                )}
              >
                {m.content}
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sources</p>
                  {m.citations.map((c, i) => (
                    <Link
                      key={`${c.docId}-${c.chunk}`}
                      href={`/documents?doc=${c.docId}`}
                      className="flex gap-2 rounded-lg border bg-muted/40 p-2 text-left text-xs transition-colors hover:border-primary/40"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 font-medium">
                          <FileText className="size-3" />
                          {c.docTitle} · chunk {c.chunk}
                        </span>
                        <span className="line-clamp-2 text-muted-foreground">{c.excerpt}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {thinking && (
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-cyan-500 text-white">
              <Bot className="size-4" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border bg-card px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="size-1.5 rounded-full bg-muted-foreground" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{mode === "knowledge" ? "Retrieving from documents…" : "Reading the ledger…"}</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={1}
            placeholder={mode === "knowledge" ? "Ask about policy, visas, baggage, expenses…" : "e.g. Why not the earlier flight?"}
            className="max-h-32 min-h-11 resize-none py-3 pr-12"
            aria-label="Your question"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || thinking} className="absolute right-2 bottom-2" aria-label="Send">
            <ArrowUp />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
      </form>
    </div>
  );
}
