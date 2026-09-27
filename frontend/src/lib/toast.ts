"use client";

import { useSyncExternalStore } from "react";

export type Toast = { id: number; title: string; description?: string; variant: "success" | "error" | "info" };

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(title: string, opts: { description?: string; variant?: Toast["variant"] } = {}) {
  const t: Toast = { id: ++seq, title, description: opts.description, variant: opts.variant ?? "success" };
  toasts = [...toasts, t].slice(-4);
  emit();
  setTimeout(() => dismiss(t.id), 4200);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const noToasts: Toast[] = [];

export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => noToasts
  );
}
