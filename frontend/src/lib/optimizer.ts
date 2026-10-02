import { cabinLabel, cityByCode, searchFlights, searchHotels, amenityLabel } from "./catalog";
import { formatInr, formatDuration, formatTime } from "./format";
import type {
  ConstraintIssue,
  Flight,
  Hotel,
  Itinerary,
  LedgerEntry,
  Policy,
  Priority,
  ReasonCode,
  TimeWindow,
  Trip,
} from "./types";

/**
 * Two-stage optimization pipeline (docs/08_GenAI_Architecture.md):
 *   1. search + hard-constraint screening + scoring  → candidate pool
 *   2. combination search under budget + composition → itinerary, ledger, issues, rationale
 * Every money figure is computed here; the rationale only restates numbers already
 * present on the itinerary (product principle: no unsupported financial claims).
 */

export const windowHours: Record<TimeWindow, [number, number] | null> = {
  any: null,
  early_morning: [4, 8],
  morning: [8, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  night: [21, 28],
};

export const windowLabel: Record<TimeWindow, string> = {
  any: "Any time",
  early_morning: "Early morning (4–8)",
  morning: "Morning (8–12)",
  afternoon: "Afternoon (12–17)",
  evening: "Evening (17–21)",
  night: "Night (21–4)",
};

export const priorityLabel: Record<Priority, string> = {
  cheapest: "Lowest cost",
  balanced: "Balanced",
  comfort: "Comfort first",
  fastest: "Fastest travel",
};

const weights: Record<Priority, { cost: number; time: number; comfort: number }> = {
  cheapest: { cost: 0.75, time: 0.1, comfort: 0.15 },
  balanced: { cost: 0.5, time: 0.25, comfort: 0.25 },
  comfort: { cost: 0.25, time: 0.25, comfort: 0.5 },
  fastest: { cost: 0.3, time: 0.55, comfort: 0.15 },
};

type Screened<T> = { option: T; score: number; reject?: { code: ReasonCode; reason: string } };

function hourOf(iso: string) {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

export function isRedEye(f: Flight) {
  const h = hourOf(f.departure);
  return h < 5 || h >= 22.5;
}

function inWindow(f: Flight, w: TimeWindow) {
  const range = windowHours[w];
  if (!range) return true;
  let h = hourOf(f.departure);
  if (w === "night" && h < 4) h += 24;
  return h >= range[0] && h < range[1];
}

export function nightsBetween(a: string, b: string | null) {
  if (!b) return 1;
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function screenFlights(flights: Flight[], trip: Trip): Screened<Flight>[] {
  const f = trip.filters;
  const w = weights[f.priority];
  const prices = flights.map((x) => x.price);
  const durs = flights.map((x) => x.durationMin);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const minD = Math.min(...durs);
  const maxD = Math.max(...durs);

  return flights.map((fl) => {
    const costScore = 1 - (fl.price - minP) / Math.max(1, maxP - minP);
    const timeScore = 1 - (fl.durationMin - minD) / Math.max(1, maxD - minD);
    let comfort = 1 - fl.stops * 0.35;
    if (isRedEye(fl)) comfort -= 0.25;
    if (fl.refundable) comfort += 0.1;
    if (f.preferredAirlines.includes(fl.airline)) comfort += 0.25;
    const score = Math.round((w.cost * costScore + w.time * timeScore + w.comfort * Math.max(0, Math.min(1, comfort))) * 100);

    let reject: Screened<Flight>["reject"];
    if (f.excludedAirlines.includes(fl.airline)) {
      reject = { code: "CONSTRAINT", reason: `${fl.airline} is on the excluded-airline list for this trip.` };
    } else if (fl.stops > f.maxStops) {
      reject = {
        code: "CONSTRAINT",
        reason: `${fl.stops} stop${fl.stops > 1 ? "s" : ""} via ${fl.via} exceeds the max-stops rule (${f.maxStops === 0 ? "non-stop only" : `≤ ${f.maxStops}`}).`,
      };
    } else if (f.avoidRedEye && isRedEye(fl)) {
      reject = { code: "PREFERENCE", reason: `Red-eye departure at ${formatTime(fl.departure)} — traveler asked to avoid red-eyes.` };
    } else if (!inWindow(fl, f.departureWindow)) {
      reject = {
        code: "PREFERENCE",
        reason: `Departs ${formatTime(fl.departure)}, outside the preferred ${windowLabel[f.departureWindow].toLowerCase()} window.`,
      };
    }
    return { option: fl, score, reject };
  });
}

function screenHotels(hotels: Hotel[], trip: Trip, policy: Policy): Screened<Hotel>[] {
  const f = trip.filters;
  const w = weights[f.priority];
  const intl = cityByCode[trip.destination]?.international;
  const policyCap = intl ? policy.maxNightlyRateIntl : policy.maxNightlyRate;
  const cap = f.maxNightlyRate ?? null;
  const prices = hotels.map((h) => h.pricePerNight);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  return hotels.map((h) => {
    const costScore = 1 - (h.pricePerNight - minP) / Math.max(1, maxP - minP);
    const locScore = 1 - Math.min(1, h.distanceKm / 10);
    const comfort = (h.rating - 3) / 2 * 0.7 + (h.amenities.length / 8) * 0.3;
    const score = Math.round((w.cost * costScore + w.time * locScore + w.comfort * Math.max(0, Math.min(1, comfort))) * 100);

    let reject: Screened<Hotel>["reject"];
    const missing = f.requiredAmenities.filter((a) => !h.amenities.includes(a));
    if (h.rating < f.minHotelRating) {
      reject = { code: "CONSTRAINT", reason: `Guest rating ${h.rating} is below the ${f.minHotelRating}+ minimum.` };
    } else if (h.distanceKm > f.maxHotelDistanceKm) {
      reject = { code: "CONSTRAINT", reason: `${h.distanceKm} km from the city centre exceeds the ${f.maxHotelDistanceKm} km limit.` };
    } else if (cap !== null && h.pricePerNight > cap) {
      reject = { code: "BUDGET", reason: `${formatInr(h.pricePerNight)}/night is over the trip's nightly cap of ${formatInr(cap)}.` };
    } else if (h.pricePerNight > policyCap) {
      reject = {
        code: "CONSTRAINT",
        reason: `${formatInr(h.pricePerNight)}/night breaks the company hotel policy cap of ${formatInr(policyCap)}.`,
      };
    } else if (missing.length) {
      reject = { code: "PREFERENCE", reason: `Missing required amenities: ${missing.map((m) => amenityLabel[m] ?? m).join(", ")}.` };
    }
    return { option: h, score, reject };
  });
}

export class OptimizationError extends Error {}

type Combo = { out: Screened<Flight>; ret: Screened<Flight> | null; stay: Screened<Hotel> | null; cost: number; score: number };

function costOf(trip: Trip, out: Flight, ret: Flight | null, stay: Hotel | null, nights: number) {
  const pax = Math.max(1, trip.travelerIds.length);
  const flightCost = (out.price + (ret?.price ?? 0)) * pax;
  const stayCost = stay ? stay.pricePerNight * nights * trip.rooms : 0;
  return { flightCost, stayCost, total: flightCost + stayCost };
}

export function optimize(trip: Trip, policy: Policy): Itinerary {
  const started = performance.now();
  const nights = nightsBetween(trip.departDate, trip.returnDate);
  const outAll = screenFlights(searchFlights(trip.origin, trip.destination, trip.departDate, trip.filters.cabin), trip);
  const retAll = trip.returnDate
    ? screenFlights(searchFlights(trip.destination, trip.origin, trip.returnDate, trip.filters.cabin), trip)
    : [];
  const stayAll = screenHotels(searchHotels(trip.destination), trip, policy);

  const outOk = outAll.filter((x) => !x.reject);
  const retOk = retAll.filter((x) => !x.reject);
  const stayOk = stayAll.filter((x) => !x.reject);

  if (!outOk.length) throw new OptimizationError(`No outbound flight satisfies the filters (${outAll.length} searched). Loosen stops, time window or airline rules.`);
  if (trip.returnDate && !retOk.length) throw new OptimizationError(`No return flight satisfies the filters (${retAll.length} searched). Loosen stops, time window or airline rules.`);
  if (!stayOk.length) throw new OptimizationError(`No hotel satisfies the stay filters (${stayAll.length} searched). Lower the rating/distance limits or remove required amenities.`);

  const combos: Combo[] = [];
  for (const out of outOk)
    for (const ret of trip.returnDate ? retOk : [null])
      for (const stay of stayOk) {
        const { total } = costOf(trip, out.option, ret?.option ?? null, stay.option, nights);
        const score = out.score * 0.4 + (ret ? ret.score * 0.3 : out.score * 0.3) + stay.score * 0.3;
        combos.push({ out, ret, stay, cost: total, score });
      }

  const within = combos.filter((c) => c.cost <= trip.budget);
  const best = within.length
    ? within.reduce((a, b) => (b.score > a.score || (b.score === a.score && b.cost < a.cost) ? b : a))
    : combos.reduce((a, b) => (b.cost < a.cost ? b : a));

  const itinerary = compose(trip, policy, best.out.option, best.ret?.option ?? null, best.stay?.option ?? null, nights, {
    outAll,
    retAll,
    stayAll,
  });
  itinerary.runMs = Math.max(1, Math.round(performance.now() - started));
  return itinerary;
}

function compose(
  trip: Trip,
  policy: Policy,
  out: Flight,
  ret: Flight | null,
  stay: Hotel | null,
  nights: number,
  pools: { outAll: Screened<Flight>[]; retAll: Screened<Flight>[]; stayAll: Screened<Hotel>[] },
  edited = false
): Itinerary {
  const { flightCost, stayCost, total } = costOf(trip, out, ret, stay, nights);
  const pax = Math.max(1, trip.travelerIds.length);

  const ledger: LedgerEntry[] = [];
  const flightEntries = (kind: "outbound" | "return", pool: Screened<Flight>[], chosen: Flight | null) => {
    for (const s of [...pool].sort((a, b) => a.option.price - b.option.price)) {
      const fl = s.option;
      const won = chosen?.id === fl.id;
      let code: ReasonCode;
      let reason: string;
      if (won) {
        code = "WINNER";
        reason = edited
          ? `Selected manually by reviewer (score ${s.score}/100).`
          : `Best weighted score (${s.score}/100) for "${priorityLabel[trip.filters.priority]}" that keeps the trip within budget.`;
      } else if (s.reject) {
        code = s.reject.code;
        reason = s.reject.reason;
      } else {
        const swapTotal = total - (chosen?.price ?? 0) * pax + fl.price * pax;
        const delta = fl.price - (chosen?.price ?? 0);
        if (swapTotal > trip.budget && total <= trip.budget) {
          code = "BUDGET";
          reason = `Would raise the trip total to ${formatInr(swapTotal)}, ${formatInr(swapTotal - trip.budget)} over budget.`;
        } else if (delta > 0) {
          code = "PRICE";
          reason = `${formatInr(delta)} more per traveler than the chosen flight with no better overall score (${s.score} vs ${pool.find((p) => p.option.id === chosen?.id)?.score ?? "—"}).`;
        } else {
          code = "PREFERENCE";
          const bits: string[] = [];
          if (fl.stops > (chosen?.stops ?? 0)) bits.push(`${fl.stops} stop${fl.stops > 1 ? "s" : ""}`);
          if (isRedEye(fl)) bits.push("red-eye timing");
          if (fl.durationMin > (chosen?.durationMin ?? 0) + 20) bits.push(`${formatDuration(fl.durationMin - (chosen?.durationMin ?? 0))} longer`);
          if (!fl.refundable && chosen?.refundable) bits.push("non-refundable fare");
          reason = `${formatInr(Math.abs(delta))} cheaper but scored lower (${s.score}/100)${bits.length ? ` — ${bits.join(", ")}` : ""}.`;
        }
      }
      ledger.push({
        id: `${kind}-${fl.id}`,
        kind,
        optionId: fl.id,
        label: `${fl.airline} ${fl.flightNo}`,
        detail: `${formatTime(fl.departure)} → ${formatTime(fl.arrival)} · ${formatDuration(fl.durationMin)} · ${fl.stops === 0 ? "Non-stop" : `${fl.stops} stop via ${fl.via}`}`,
        price: fl.price,
        score: s.score,
        won,
        feasible: !s.reject,
        reasonCode: code,
        reason,
      });
    }
  };
  flightEntries("outbound", pools.outAll, out);
  if (ret) flightEntries("return", pools.retAll, ret);

  for (const s of [...pools.stayAll].sort((a, b) => a.option.pricePerNight - b.option.pricePerNight)) {
    const h = s.option;
    const won = stay?.id === h.id;
    let code: ReasonCode;
    let reason: string;
    const nightlyTotal = (p: number) => p * nights * trip.rooms;
    if (won) {
      code = "WINNER";
      reason = edited
        ? `Selected manually by reviewer (score ${s.score}/100).`
        : `Highest stay score (${s.score}/100): ${h.rating}★ rating, ${h.distanceKm} km from centre, within budget.`;
    } else if (s.reject) {
      code = s.reject.code;
      reason = s.reject.reason;
    } else {
      const swapTotal = total - nightlyTotal(stay?.pricePerNight ?? 0) + nightlyTotal(h.pricePerNight);
      const delta = h.pricePerNight - (stay?.pricePerNight ?? 0);
      if (swapTotal > trip.budget && total <= trip.budget) {
        code = "BUDGET";
        reason = `Would raise the trip total to ${formatInr(swapTotal)}, ${formatInr(swapTotal - trip.budget)} over budget.`;
      } else if (delta > 0) {
        code = "PRICE";
        reason = `${formatInr(delta)}/night more than the chosen hotel without a higher score (${s.score}/100).`;
      } else {
        code = "PREFERENCE";
        reason = `${formatInr(Math.abs(delta))}/night cheaper but scored lower (${s.score}/100) — ${h.rating}★, ${h.distanceKm} km out.`;
      }
    }
    ledger.push({
      id: `stay-${h.id}`,
      kind: "stay",
      optionId: h.id,
      label: h.name,
      detail: `${h.stars}★ hotel · ${h.rating} rating · ${h.distanceKm} km · ${h.area}`,
      price: h.pricePerNight,
      score: s.score,
      won,
      feasible: !s.reject,
      reasonCode: code,
      reason,
    });
  }

  const issues = checkConstraints(trip, policy, out, ret, stay, total);

  const typicalFlight = median(pools.outAll.map((s) => s.option.price)) + (ret ? median(pools.retAll.map((s) => s.option.price)) : 0);
  const typicalStay = median(pools.stayAll.map((s) => s.option.pricePerNight));
  const baselineCost = Math.round(typicalFlight * pax + (stay ? typicalStay * nights * trip.rooms : 0));
  const savings = Math.max(0, baselineCost - total);

  const itinerary: Itinerary = {
    outbound: out,
    return: ret,
    stay,
    nights,
    rooms: trip.rooms,
    travelers: pax,
    flightCost,
    stayCost,
    totalCost: total,
    baselineCost,
    savings,
    ledger,
    issues,
    rationale: "",
    generatedAt: new Date().toISOString(),
    runMs: 0,
    edited,
  };
  itinerary.rationale = writeRationale(trip, itinerary);
  return itinerary;
}

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function checkConstraints(
  trip: Trip,
  policy: Policy,
  out: Flight,
  ret: Flight | null,
  stay: Hotel | null,
  total: number
): ConstraintIssue[] {
  const issues: ConstraintIssue[] = [];
  const intl = cityByCode[trip.destination]?.international || cityByCode[trip.origin]?.international;
  if (total > trip.budget) {
    issues.push({
      id: "budget",
      rule: "Trip budget",
      lineItem: "Trip total",
      severity: "error",
      message: `Total ${formatInr(total)} exceeds the approved budget of ${formatInr(trip.budget)} by ${formatInr(total - trip.budget)}. No combination of feasible options fits.`,
    });
  } else if (total > trip.budget * 0.9) {
    issues.push({
      id: "budget-tight",
      rule: "Trip budget",
      lineItem: "Trip total",
      severity: "warning",
      message: `Uses ${Math.round((total / trip.budget) * 100)}% of the budget — only ${formatInr(trip.budget - total)} headroom left for incidentals.`,
    });
  }
  for (const [label, fl] of [["Outbound flight", out], ["Return flight", ret]] as const) {
    if (!fl) continue;
    if (fl.price > policy.managerApprovalFlightOver) {
      issues.push({
        id: `mgr-${fl.id}`,
        rule: `Flights over ${formatInr(policy.managerApprovalFlightOver)} need manager approval`,
        lineItem: `${label}: ${fl.airline} ${fl.flightNo} (${formatInr(fl.price)})`,
        severity: "warning",
        message: "Route this itinerary to a manager before booking.",
      });
    }
    if (fl.cabin === "business" && fl.durationMin < policy.businessClassMinHours * 60) {
      issues.push({
        id: `biz-${fl.id}`,
        rule: `Business class only for flights ≥ ${policy.businessClassMinHours}h`,
        lineItem: `${label}: ${fl.airline} ${fl.flightNo} (${formatDuration(fl.durationMin)})`,
        severity: "error",
        message: "Flight is too short to qualify for business class under the travel policy.",
      });
    }
    if (policy.preferredAirlines.length && !policy.preferredAirlines.includes(fl.airline)) {
      issues.push({
        id: `pref-${fl.id}`,
        rule: "Preferred-vendor programme",
        lineItem: `${label}: ${fl.airline}`,
        severity: "info",
        message: `${fl.airline} is not a preferred vendor; corporate discounts will not apply.`,
      });
    }
  }
  if (stay) {
    const cap = intl ? policy.maxNightlyRateIntl : policy.maxNightlyRate;
    if (stay.pricePerNight > cap) {
      issues.push({
        id: "hotel-cap",
        rule: `Hotel cap ${formatInr(cap)}/night (${intl ? "international" : "domestic"})`,
        lineItem: `Stay: ${stay.name} (${formatInr(stay.pricePerNight)}/night)`,
        severity: "error",
        message: "Nightly rate breaks the company hotel policy.",
      });
    }
    if (!stay.freeCancellation) {
      issues.push({
        id: "hotel-nonref",
        rule: "Prefer flexible bookings",
        lineItem: `Stay: ${stay.name}`,
        severity: "info",
        message: "Rate is non-cancellable; changes after booking will be charged.",
      });
    }
  }
  const lead = Math.round((new Date(`${trip.departDate}T00:00:00`).getTime() - Date.now()) / 86400000);
  if (lead >= 0 && lead < policy.advanceBookingDays) {
    issues.push({
      id: "advance",
      rule: `Book at least ${policy.advanceBookingDays} days ahead`,
      lineItem: `Departure ${trip.departDate}`,
      severity: "warning",
      message: `Only ${lead} day${lead === 1 ? "" : "s"} of lead time — late bookings typically cost more.`,
    });
  }
  return issues;
}

export function writeRationale(trip: Trip, it: Itinerary) {
  const o = it.outbound;
  const dest = cityByCode[trip.destination]?.name ?? trip.destination;
  const parts: string[] = [];
  const outRejected = it.ledger.filter((l) => l.kind === "outbound" && !l.won);
  const cheaper = outRejected.filter((l) => l.price < o.price);
  parts.push(
    `For "${priorityLabel[trip.filters.priority]}" optimisation, ${o.airline} ${o.flightNo} (${formatTime(o.departure)} departure, ${o.stops === 0 ? "non-stop" : `${o.stops} stop`}, ${formatDuration(o.durationMin)}) was selected at ${formatInr(o.price)} per traveler in ${cabinLabel[o.cabin]}.`
  );
  if (cheaper.length) {
    parts.push(
      `${cheaper.length} cheaper outbound option${cheaper.length > 1 ? "s were" : " was"} passed over — see the Trade-off Ledger for the specific reason on each.`
    );
  }
  if (it.return) {
    parts.push(`The return is ${it.return.airline} ${it.return.flightNo} at ${formatInr(it.return.price)}.`);
  }
  if (it.stay) {
    parts.push(
      `In ${dest}, ${it.stay.name} (${it.stay.rating}★, ${it.stay.distanceKm} km from centre) was chosen at ${formatInr(it.stay.pricePerNight)}/night for ${it.nights} night${it.nights > 1 ? "s" : ""}.`
    );
  }
  const errors = it.issues.filter((i) => i.severity === "error");
  const warnings = it.issues.filter((i) => i.severity === "warning");
  if (errors.length) {
    parts.push(`The constraint check found ${errors.length} blocking issue${errors.length > 1 ? "s" : ""}; resolve ${errors.length > 1 ? "them" : "it"} or reject with a reason.`);
  } else {
    parts.push(
      `The total of ${formatInr(it.totalCost)} is within the ${formatInr(trip.budget)} budget${warnings.length ? `, with ${warnings.length} policy warning${warnings.length > 1 ? "s" : ""} to review` : " and passes every policy rule"}.`
    );
  }
  if (it.savings > 0) parts.push(`That is ${formatInr(it.savings)} below the typical market cost of ${formatInr(it.baselineCost)} for this route and stay.`);
  return parts.join(" ");
}

/** Reviewer swaps a line item for another option from the ledger; totals, issues and rationale recompute. */
export function editItinerary(trip: Trip, policy: Policy, kind: "outbound" | "return" | "stay", optionId: string): Itinerary {
  const it = trip.itinerary!;
  const outAll = screenFlights(searchFlights(trip.origin, trip.destination, trip.departDate, trip.filters.cabin), trip);
  const retAll = trip.returnDate
    ? screenFlights(searchFlights(trip.destination, trip.origin, trip.returnDate, trip.filters.cabin), trip)
    : [];
  const stayAll = screenHotels(searchHotels(trip.destination), trip, policy);
  const out = kind === "outbound" ? outAll.find((s) => s.option.id === optionId)!.option : it.outbound;
  const ret = kind === "return" ? retAll.find((s) => s.option.id === optionId)!.option : it.return;
  const stay = kind === "stay" ? stayAll.find((s) => s.option.id === optionId)!.option : it.stay;
  const next = compose(trip, policy, out, ret, stay, it.nights, { outAll, retAll, stayAll }, true);
  next.runMs = it.runMs;
  return next;
}

export function optionsFor(trip: Trip, policy: Policy) {
  return {
    outbound: screenFlights(searchFlights(trip.origin, trip.destination, trip.departDate, trip.filters.cabin), trip),
    return: trip.returnDate ? screenFlights(searchFlights(trip.destination, trip.origin, trip.returnDate, trip.filters.cabin), trip) : [],
    stay: screenHotels(searchHotels(trip.destination), trip, policy),
  };
}
