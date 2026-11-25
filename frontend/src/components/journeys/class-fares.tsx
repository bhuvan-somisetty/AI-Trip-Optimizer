import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Indian Railways class codes, cheapest first, as the backend sends them (app/rail_fares.py). */
const ORDER = ["2S", "SL", "CC", "3E", "3A", "FC", "2A", "1A"] as const;
export const CLASS_NAMES: Record<string, string> = {
  "2S": "Second sitting",
  SL: "Sleeper",
  CC: "AC Chair Car",
  "3E": "AC 3 Economy",
  "3A": "AC 3-Tier",
  FC: "First Class",
  "2A": "AC 2-Tier",
  "1A": "AC First Class",
};

/**
 * A train's official fare per class (Railway Board fare table and the train's own timetable
 * distance), or why there is none. A train runs only some of these classes, so it says so.
 */
export function ClassFares({ fares, label, note, className }: {
  fares?: Record<string, number> | null;
  label?: string | null;
  note?: string | null;
  className?: string;
}) {
  if (!fares) return note ? <p className={cn("text-xs text-muted-foreground", className)}>{note}</p> : null;
  return (
    <div className={cn("space-y-0.5 text-xs", className)}>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5">
        {ORDER.filter((c) => fares[c] !== undefined).map((c) => (
          <span key={c} title={CLASS_NAMES[c]}>
            <span className="text-muted-foreground">{c}</span> <span className="font-medium tabular-nums">{formatInr(fares[c])}</span>
          </span>
        ))}
      </p>
      <p className="text-muted-foreground">
        {label ?? "Official fare"} · Indian Railways fare table (Railway Board CC 24/2025), per person, for the classes the train has
      </p>
    </div>
  );
}
