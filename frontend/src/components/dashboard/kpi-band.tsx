import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Kpi = {
  label: string;
  value: string;
  /** a short line under the value */
  note?: string;
  /** change against the previous 30 days, in percent */
  trend?: { pct: number; goodWhenUp: boolean };
  /** the last few months, oldest first, drawn as a thin line; omitted when there is no series */
  series?: number[];
};

/** A smooth thin line through `values`, scaled to its own range; flat when every value is equal. */
function Spark({ values }: { values: number[] }) {
  const w = 120;
  const h = 32;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * w, h - 4 - ((v - min) / span) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px] max-w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--color-primary)" />
    </svg>
  );
}

/**
 * The dashboard's key numbers as one band: a small uppercase label, the value in the editorial
 * serif, the change against the previous 30 days, and a thin line of the last months.
 */
export function KpiBand({ items }: { items: Kpi[] }) {
  return (
    <section
      aria-label="Key numbers"
      className="grid overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-foreground/[0.07] sm:grid-cols-2 xl:grid-cols-4 dark:shadow-[inset_0_1px_0_rgba(236,230,218,0.05),0_30px_60px_-36px_rgba(0,0,0,0.9)]"
    >
      {items.map((k, i) => {
        const up = (k.trend?.pct ?? 0) >= 0;
        const good = k.trend ? (up ? k.trend.goodWhenUp : !k.trend.goodWhenUp) : true;
        return (
          <div
            key={k.label}
            className={cn(
              "group relative flex flex-col justify-between gap-5 p-6 transition-colors duration-500 hover:bg-foreground/[0.025]",
              i > 0 && "border-t border-border sm:border-t-0",
              i % 2 === 1 && "sm:border-l sm:border-border",
              i >= 2 && "sm:border-t xl:border-t-0",
              i === 2 && "xl:border-l"
            )}
          >
            <p className="text-[10.5px] font-medium tracking-[0.24em] text-muted-foreground uppercase">{k.label}</p>
            <div className="flex items-end justify-between gap-3">
              <p className="font-editorial text-[2.9rem] leading-none whitespace-nowrap tabular-nums">{k.value}</p>
              {k.series && k.series.some((v) => v > 0) && (
                <div className="min-w-0 shrink overflow-hidden">
                  <Spark values={k.series} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {k.trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium tabular-nums",
                    good ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
                  )}
                >
                  {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {Math.abs(k.trend.pct)}%
                </span>
              )}
              {k.note && <span className="truncate text-muted-foreground">{k.note}</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
