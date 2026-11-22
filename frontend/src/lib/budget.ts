import type { JourneyMode, JourneyResponse } from "@/lib/api";
import { formatInr } from "@/lib/format";

/**
 * How journeys fit a travel budget (in rupees, for all travellers). A real fare is compared
 * exactly; a train or bus with only a distance-based estimate is "likely" within or over, and
 * says so; a journey with neither, or a fare in another currency, can't be compared.
 */

export type BudgetStatus = "within" | "likely" | "partly" | "over" | "unknown";
export type BudgetFit = { status: BudgetStatus; label: string };

export function budgetFit(j: JourneyResponse, budget: number | null): BudgetFit | null {
  if (!budget || budget <= 0) return null;
  if (j.fare !== null) {
    if (j.currency && j.currency !== "INR") return { status: "unknown", label: `Fare in ${j.currency}, not compared` };
    return j.fare <= budget
      ? { status: "within", label: `Within budget · ${formatInr(budget - j.fare)} left` }
      : { status: "over", label: `${formatInr(j.fare - budget)} over budget` };
  }
  const e = j.fare_estimate;
  if (!e) return { status: "unknown", label: "No fare to compare" };
  if (e.high <= budget) return { status: "likely", label: "Likely within budget (estimate)" };
  if (e.low > budget) return { status: "over", label: "Likely over budget (estimate)" };
  return { status: "partly", label: "Within budget in cheaper classes (estimate)" };
}

/** What a journey costs for sorting cheapest first: the fare, else the low end of the estimate. */
export function sortCost(j: JourneyResponse): number {
  return j.fare ?? j.fare_estimate?.low ?? Number.POSITIVE_INFINITY;
}

export function fitsBudget(j: JourneyResponse, budget: number | null): boolean {
  const fit = budgetFit(j, budget);
  return !fit || fit.status === "within" || fit.status === "likely" || fit.status === "partly";
}

export type ModeSummary = {
  mode: JourneyMode;
  /** journeys using only this mode */
  count: number;
  /** of those, how many fit the budget (all of them without a budget) */
  fitting: number;
  /** cheapest real fare among the fitting ones */
  cheapestFare: number | null;
  /** lowest and highest estimate among fitting ones without a fare */
  estimate: { low: number; high: number } | null;
};

/** One row per mode for "Compare all": how many options fit the budget and from what price. */
export function modeSummary(journeys: JourneyResponse[], modes: JourneyMode[], budget: number | null): ModeSummary[] {
  return modes.map((mode) => {
    const mine = journeys.filter((j) => j.modes.every((m) => m === mode));
    const fitting = mine.filter((j) => fitsBudget(j, budget));
    const fares = fitting.filter((j) => j.fare !== null && (!j.currency || j.currency === "INR")).map((j) => j.fare as number);
    const estimates = fitting.filter((j) => j.fare === null && j.fare_estimate).map((j) => j.fare_estimate!);
    return {
      mode,
      count: mine.length,
      fitting: fitting.length,
      cheapestFare: fares.length ? Math.min(...fares) : null,
      estimate: estimates.length ? { low: Math.min(...estimates.map((e) => e.low)), high: Math.max(...estimates.map((e) => e.high)) } : null,
    };
  });
}

/** The cheapest priced journey within the budget, and the best value one (fare plus time). */
export function bestWithinBudget(journeys: JourneyResponse[], budget: number | null, valueOfTime = 300) {
  const priced = journeys.filter((j) => j.fare !== null && (!j.currency || j.currency === "INR") && (!budget || (j.fare as number) <= budget));
  const cheapest = [...priced].sort((a, b) => (a.fare as number) - (b.fare as number) || a.duration_minutes - b.duration_minutes)[0] ?? null;
  const score = (j: JourneyResponse) => (j.fare as number) + (valueOfTime * j.duration_minutes) / 60;
  const bestValue = [...priced].sort((a, b) => score(a) - score(b))[0] ?? null;
  return { cheapest, bestValue };
}
