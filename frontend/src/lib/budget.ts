import type { JourneyMode, JourneyResponse } from "@/lib/api";
import { formatInr } from "@/lib/format";

/**
 * How journeys fit a travel budget (in rupees, for all travellers). Only real fares are compared:
 * a journey whose fare isn't published, or is in another currency, can't be compared and says so.
 */

export type BudgetStatus = "within" | "over" | "unknown";
export type BudgetFit = { status: BudgetStatus; label: string };

export function budgetFit(j: JourneyResponse, budget: number | null): BudgetFit | null {
  if (!budget || budget <= 0) return null;
  if (j.fare === null) return { status: "unknown", label: "Fare not published: check with the operator" };
  if (j.currency && j.currency !== "INR") return { status: "unknown", label: `Fare in ${j.currency}, not compared` };
  return j.fare <= budget
    ? { status: "within", label: `Within budget · ${formatInr(budget - j.fare)} left` }
    : { status: "over", label: `${formatInr(j.fare - budget)} over budget` };
}

/** What a journey costs for sorting cheapest first: its fare; a journey without one goes last. */
export function sortCost(j: JourneyResponse): number {
  return j.fare ?? Number.POSITIVE_INFINITY;
}

/** With "Only within budget": journeys whose real fare fits (all of them without a budget). */
export function fitsBudget(j: JourneyResponse, budget: number | null): boolean {
  const fit = budgetFit(j, budget);
  return !fit || fit.status === "within";
}

export type ModeSummary = {
  mode: JourneyMode;
  /** journeys using only this mode */
  count: number;
  /** of those, how many have a real fare within the budget (all priced ones without a budget) */
  fitting: number;
  /** of those, how many have no published fare */
  unpriced: number;
  /** cheapest real fare among the fitting ones */
  cheapestFare: number | null;
};

/** One row per mode for "Compare all": how many options fit the budget and from what price. */
export function modeSummary(journeys: JourneyResponse[], modes: JourneyMode[], budget: number | null): ModeSummary[] {
  return modes.map((mode) => {
    const mine = journeys.filter((j) => j.modes.every((m) => m === mode));
    const priced = mine.filter((j) => j.fare !== null && (!j.currency || j.currency === "INR"));
    const fitting = priced.filter((j) => !budget || (j.fare as number) <= budget);
    return {
      mode,
      count: mine.length,
      fitting: fitting.length,
      unpriced: mine.length - priced.length,
      cheapestFare: fitting.length ? Math.min(...fitting.map((j) => j.fare as number)) : null,
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
