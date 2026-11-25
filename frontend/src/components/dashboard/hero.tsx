import Link from "next/link";
import { ArrowRight, Plane, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatDateRange, formatInr } from "@/lib/format";
import { cityName } from "@/lib/store";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

// The flight arc's path, in the 560 x 240 box it is drawn in; the plane glides along the same path.
const ARC = "M 24 214 C 170 40, 400 10, 536 70";

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * The dashboard's opening panel: the date, a greeting in the editorial serif, the review count,
 * the two main actions, and the next approved departure as a boarding pass. Always dark and
 * cinematic, in both themes: grainy obsidian with a tangerine horizon and a calm flight arc.
 */
export function DashboardHero({ name, now, pending, next }: { name: string; now: number; pending: number; next?: Trip }) {
  return (
    <section className="hero-obsidian grain relative isolate overflow-hidden rounded-[2rem] text-[#ece6da] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]">
      {/* Flight arc: decorative, hidden from assistive tech. */}
      <div aria-hidden className="pointer-events-none absolute right-[4%] bottom-[6%] hidden h-[240px] w-[560px] opacity-80 lg:block">
        <svg viewBox="0 0 560 240" className="absolute inset-0 size-full">
          <defs>
            <linearGradient id="arc" x1="0" x2="1">
              <stop offset="0%" stopColor="#ece6da" stopOpacity="0" />
              <stop offset="45%" stopColor="#ece6da" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ff6a3d" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path d={ARC} fill="none" stroke="url(#arc)" strokeWidth="1.25" strokeDasharray="2 7" strokeLinecap="round" />
          <circle cx="24" cy="214" r="3" fill="#ece6da" fillOpacity="0.5" />
          <circle cx="536" cy="70" r="4" fill="#ff6a3d" />
          <circle cx="536" cy="70" r="12" fill="#ff6a3d" fillOpacity="0.15" />
        </svg>
        <span
          className="flight-glide absolute top-0 left-0 text-[#ece6da]"
          style={{ offsetPath: `path("${ARC}")`, offsetRotate: "auto", animation: "flight-glide 26s cubic-bezier(.45,.05,.35,1) infinite" }}
        >
          <Plane className="size-4 rotate-45 fill-current" />
        </span>
      </div>

      <div className="relative z-10 grid gap-10 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end lg:p-12">
        <div className="max-w-2xl">
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.32em] text-[#ece6da]/55 uppercase">
            <span className="h-px w-8 bg-[#ff6a3d]" />
            {new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="font-editorial mt-6 text-[clamp(2.75rem,6vw,5.25rem)] leading-[0.92] text-[#ece6da]">
            {greeting(now)},
            <br />
            <em className="bg-gradient-to-r from-[#ffd2bd] via-[#ff9a72] to-[#ff6a3d] bg-clip-text text-transparent">{name}.</em>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[#ece6da]/65">
            {pending > 0
              ? `${pending} itinerar${pending === 1 ? "y is" : "ies are"} ready for your review. Every choice comes with its reasons.`
              : "Every itinerary is reviewed. The optimizer is ready for the next trip."}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/planning"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 rounded-full px-6 text-[15px] shadow-[0_18px_40px_-14px_rgba(255,106,61,0.85)] transition-transform active:scale-[0.98]"
              )}
            >
              <Plus />
              Plan a trip
            </Link>
            {pending > 0 && (
              <Link href="/trips" className="glass inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium text-[#ece6da] transition-colors hover:bg-white/10">
                Review {pending === 1 ? "itinerary" : `${pending} itineraries`}
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
        </div>

        <BoardingPass trip={next} />
      </div>
    </section>
  );
}

/** The next approved departure, styled as a boarding pass; an invitation to plan one when there is none. */
function BoardingPass({ trip }: { trip?: Trip }) {
  if (!trip) {
    return (
      <div className="glass relative w-full max-w-[340px] rounded-3xl p-6">
        <p className="text-[10px] font-medium tracking-[0.3em] text-[#ece6da]/50 uppercase">Next departure</p>
        <p className="font-editorial mt-4 text-3xl leading-tight">No departures yet</p>
        <p className="mt-2 text-sm text-[#ece6da]/60">Approved trips appear here with their dates and route.</p>
      </div>
    );
  }
  return (
    <Link href={`/trips/${trip.id}`} className="glass group relative block w-full max-w-[340px] rounded-3xl transition-transform duration-500 hover:-translate-y-1">
      <div className="p-6 pb-5">
        <div className="flex items-center justify-between text-[10px] font-medium tracking-[0.3em] text-[#ece6da]/50 uppercase">
          <span>Next departure</span>
          <span className="rounded-full bg-[#7fcf9f]/15 px-2 py-0.5 tracking-[0.15em] text-[#9fe0b8]">Approved</span>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="font-editorial text-5xl leading-none">{trip.origin}</p>
            <p className="mt-1.5 truncate text-xs text-[#ece6da]/55">{cityName(trip.origin)}</p>
          </div>
          <Plane className="mb-5 size-5 shrink-0 text-[#ff6a3d]" />
          <div className="text-right">
            <p className="font-editorial text-5xl leading-none">{trip.destination}</p>
            <p className="mt-1.5 truncate text-xs text-[#ece6da]/55">{cityName(trip.destination)}</p>
          </div>
        </div>
      </div>
      {/* perforation */}
      <div className="relative h-px">
        <span className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-[#080b12]" />
        <span className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-[#080b12]" />
        <span className="mx-5 block border-t border-dashed border-[#ece6da]/20" />
      </div>
      <dl className="grid grid-cols-2 gap-4 p-6 pt-5 text-sm">
        <div>
          <dt className="text-[10px] tracking-[0.25em] text-[#ece6da]/45 uppercase">Dates</dt>
          <dd className="mt-1">{formatDateRange(trip.departDate, trip.returnDate)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-[10px] tracking-[0.25em] text-[#ece6da]/45 uppercase">Cost</dt>
          <dd className="mt-1 tabular-nums">{trip.itinerary ? formatInr(trip.itinerary.totalCost) : formatInr(trip.budget)}</dd>
        </div>
        <div className="col-span-2 flex items-center justify-between text-[11px] tracking-[0.2em] text-[#ece6da]/45 uppercase">
          <span>{trip.code}</span>
          <span className="flex items-center gap-1 text-[#ff9a72] normal-case tracking-normal transition-transform group-hover:translate-x-0.5">
            Open trip <ArrowRight className="size-3.5" />
          </span>
        </div>
      </dl>
    </Link>
  );
}
