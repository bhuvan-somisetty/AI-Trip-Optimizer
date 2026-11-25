"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bus, Loader2, MapPin, Plane, TrainFront } from "lucide-react";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { cities as popular, type City } from "@/lib/catalog";
import { toCity } from "@/lib/mappers";
import { actions, cityOf } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { TravelChoice } from "./mode-picker";

/** One row in the list: the place plus, for an airport, its own name and the town it was found by. */
type Option = City & { airport_name?: string; forPlace?: string | null };

const DEBOUNCE_MS = 250;

const NONE: Record<TravelChoice, string> = {
  flight: "No airport matches",
  train: "No place with a railway station matches",
  bus: "No place with a bus station matches",
  all: "No city or town matches",
};
const SOURCE: Record<TravelChoice, string> = {
  flight: "Airports: OurAirports (public domain)",
  train: "Stations: OpenStreetMap contributors (ODbL)",
  bus: "Bus stations: OpenStreetMap contributors (ODbL)",
  all: "Places: OpenStreetMap contributors (ODbL); airports: OurAirports",
};

function label(c: City | undefined, code: string) {
  if (!c) return code;
  return c.state ? `${c.name}, ${c.state}` : `${c.name} (${c.code})`;
}

/**
 * Origin / destination search for the way of travel the trip uses (GET /locations): airports for
 * Flights, places with a railway station for Trains or a bus station for Buses, and every Indian
 * city and town plus airports abroad for Compare all. Each Indian place shows its nearest airport,
 * railway station and bus station with their distances. Before anything is typed it lists the
 * built-in popular cities. Picking a row saves its code, and the place is remembered so its name
 * shows everywhere else in the app.
 */
export function AirportPicker({
  id,
  value,
  onChange,
  exclude,
  mode = "all",
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  /** a code that can't be picked here (the other end of the trip) */
  exclude?: string;
  /** the way of travel picked at the top of the form */
  mode?: TravelChoice;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // The list floats above the page (a portal), so a narrow form card never cuts it off.
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);

  const q = query.trim();
  useEffect(() => {
    if (!q) return;
    let stale = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await api.searchLocations(q, mode, 10);
        if (stale) return;
        setResults(found.locations.map((a) => ({ ...toCity(a), airport_name: a.kind === "airport" ? (a.airport ?? undefined) : undefined, forPlace: a.for_place })));
        setError(null);
      } catch {
        if (stale) return;
        setResults([]);
        setError("Place search isn't available right now. Pick a popular city or try again.");
      } finally {
        if (!stale) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, mode]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, 320), window.innerWidth - 16);
      setAt({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Close when focus or a click goes anywhere outside the box and its list.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (box.current && !box.current.contains(t) && !list.current?.contains(t)) setOpen(false);
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
        placeholder={open ? label(selected, value) : mode === "flight" ? "City, airport or code" : "City or town"}
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
      {!open && selected && <ReachNote city={selected} mode={mode} />}
      {open && at && createPortal(
        <div
          ref={list}
          id={listId}
          role="listbox"
          style={{ top: at.top, left: at.left, width: at.width }}
          className="fixed z-50 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
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
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.state ? c.name : `${c.name} (${c.code})`}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.state
                    ? `${c.state}, ${c.country}`
                    : c.forPlace
                      ? `Airport for ${c.forPlace}: ${c.airport_name ?? ""}`
                      : c.airport_name
                        ? `${c.airport_name}, ${c.country}`
                        : c.country}
                </span>
                {c.serves && <Access city={c} />}
              </span>
            </div>
          ))}
          {q && loading && (
            <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Searching...
            </p>
          )}
          {q && !loading && error && <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>}
          {q && !loading && !error && results && !shown.length && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {NONE[mode]} &quot;{q}&quot;.{mode !== "all" && " Pick Compare all to see every town."}
            </p>
          )}
          {q && <p className="px-2 pt-1 text-[10px] text-muted-foreground">{SOURCE[mode]}</p>}
        </div>,
        document.body
      )}
    </div>
  );
}

const km = (n: number) => (n < 1 ? "under 1 km" : `${n} km`);

/** The nearest airport, railway station and bus station of an Indian place; the ones that serve it are bright. */
function Access({ city }: { city: City }) {
  const serves = city.serves ?? [];
  const rows = [
    city.airport && {
      key: "flight",
      icon: Plane,
      text: serves.includes("flight") ? `${city.airport.code} airport, ${km(city.airport.km)}` : `No airport; nearest ${city.airport.code}, ${km(city.airport.km)}`,
    },
    city.station && {
      key: "train",
      icon: TrainFront,
      text: `${city.station.name}${city.station.code ? ` (${city.station.code})` : ""}, ${km(city.station.km)}`,
    },
    city.busStation && { key: "bus", icon: Bus, text: `${city.busStation.name}, ${km(city.busStation.km)}` },
  ].filter(Boolean) as { key: "flight" | "train" | "bus"; icon: typeof Plane; text: string }[];
  if (!rows.length) return null;
  return (
    <span className="mt-1 flex flex-col gap-0.5">
      {rows.map(({ key, icon: Icon, text }) => (
        <span key={key} className={cn("flex items-center gap-1.5 truncate text-[11px]", serves.includes(key) ? "text-foreground/80" : "text-muted-foreground/70")}>
          <Icon className={cn("size-3 shrink-0", serves.includes(key) ? "text-primary" : "")} />
          <span className="truncate">{text}</span>
        </span>
      ))}
    </span>
  );
}

/** Under a picked town: what this way of travel means for it (no station of its own, the airport flights use). */
function ReachNote({ city, mode }: { city: City; mode: TravelChoice }) {
  if (!city.serves) return null;
  const s = city.serves;
  let note: string | null = null;
  if ((mode === "flight" || mode === "all") && !s.includes("flight") && city.airport)
    note = `No airport: flights use ${city.airport.code}, ${km(city.airport.km)} away.`;
  else if (mode === "train" && !s.includes("train"))
    note = city.station ? `No station of its own: nearest is ${city.station.name}, ${km(city.station.km)} away.` : "No railway station nearby.";
  else if (mode === "bus" && !s.includes("bus"))
    note = city.busStation ? `No bus station of its own: nearest is ${city.busStation.name}, ${km(city.busStation.km)} away.` : "No bus station nearby.";
  return note ? <p className="mt-1 text-[11px] text-muted-foreground">{note}</p> : null;
}
