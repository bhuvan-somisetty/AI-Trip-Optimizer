"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { cities as popular, type City } from "@/lib/catalog";
import { toCity } from "@/lib/mappers";
import { actions, cityOf } from "@/lib/store";
import { cn } from "@/lib/utils";

/** One row in the list: the city plus, for search results, the airport's own name. */
type Option = City & { airport?: string };

const DEBOUNCE_MS = 250;

const label = (c: City | undefined, code: string) => (c ? `${c.name} (${c.code})` : code);

/**
 * Origin / destination search over every airport the backend knows (GET /airports, OurAirports).
 * Before anything is typed it lists the built-in popular cities. Picking a row saves the airport
 * code, and the city is remembered so its name shows everywhere else in the app.
 */
export function AirportPicker({
  id,
  value,
  onChange,
  exclude,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  /** a code that can't be picked here (the other end of the trip) */
  exclude?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const q = query.trim();
  useEffect(() => {
    if (!q) return;
    let stale = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await api.searchAirports(q, 10);
        if (stale) return;
        setResults(found.airports.map((a) => ({ ...toCity(a), airport: a.airport })));
        setError(null);
      } catch {
        if (stale) return;
        setResults([]);
        setError("Airport search isn't available right now. Pick a popular city or try again.");
      } finally {
        if (!stale) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q]);

  // Close when focus or a click goes anywhere outside the box.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("focusin", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("focusin", away);
    };
  }, [open]);

  const shown: Option[] = (q ? results ?? [] : popular).filter((c) => c.code !== exclude);

  function pick(c: Option) {
    actions.rememberCities([c]);
    onChange(c.code);
    setQuery("");
    setResults(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!shown.length) return;
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % shown.length : (i - 1 + shown.length) % shown.length));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const selected = cityOf(value);
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <div ref={box} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
        autoComplete="off"
        placeholder={open ? label(selected, value) : "City, airport or code"}
        value={open ? query : label(selected, value)}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className="h-9"
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {!q && <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Popular</p>}
          {shown.map((c, i) => (
            <div
              key={c.code}
              id={optionId(i)}
              role="option"
              aria-selected={c.code === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                i === active && "bg-accent text-accent-foreground"
              )}
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="font-medium">
                  {c.name} ({c.code})
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.airport ? `${c.airport}, ${c.country}` : c.country}
                </span>
              </span>
            </div>
          ))}
          {q && loading && (
            <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Searching airports...
            </p>
          )}
          {q && !loading && error && <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>}
          {q && !loading && !error && results && !shown.length && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No airport matches &quot;{q}&quot;.</p>
          )}
          {q && <p className="px-2 pt-1 text-[10px] text-muted-foreground">Airports: OurAirports (public domain)</p>}
        </div>
      )}
    </div>
  );
}
