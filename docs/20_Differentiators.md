# Differentiators

> **Provenance:** The three features below ARE official — they appear directly in the PRD's Feature Priorities table (Trade-off Ledger = Must; Ask This Itinerary = Should; What-If Simulator = Could/stretch). The competitor-gap framing and positioning statement below are the team's own analysis, not instructor-provided.
>
> **Amended 2026-09-09:** CO2-aware optimization removed from this list — cut as a scored feature per the instructor's verbal instruction. See `03_PRD.md` amendment note and `17_Risk_Register.md` R-009. It was previously differentiator #2 here; the list below is renumbered.

Three features exist specifically because no competitor reviewed in `19_Competitor_Analysis.md` has them in this form, and none require infrastructure beyond what `04_TRD.md` already specifies. One is Must-have in the approved PRD; two are Should/Could.

## 1. Trade-off Ledger — Must
**What:** Every alternative the optimization pipeline considered is shown with its price and a specific structured reason it won or lost (price, budget, constraint, or preference) — not just the final chosen option.
**Why it's differentiated:** Competitors show a result or a pass/fail policy flag; none expose the full considered set with reasons in a structured, persistent form.
**PRD reference:** US-004.

## 2. Ask This Itinerary — Should
**What:** The Trip Knowledge Assistant can answer questions grounded in one specific itinerary's own data and audit trail ("why not the earlier flight?"), distinct from its general knowledge-base mode.
**Why it's differentiated:** Competitor AI assistants (e.g. Navan's concierge, ITILITE's Iris) are conversational booking/analyst aids drawing on general knowledge or retrospective benchmarking, not scoped to explain a specific already-generated recommendation.
**PRD reference:** US-09.

## 3. What-If Simulator — Could (stretch)
**What:** Change one input (budget or a preference) and preview a re-optimized itinerary without saving, with a diff against the original.
**Why it's differentiated:** None of the competitors reviewed in `19_Competitor_Analysis.md` expose live re-optimization previews directly to an end user — it's at best an internal ops tool.
**PRD reference:** US-011. Build only after the MVP pipeline works end-to-end (see `15_Roadmap.md` Week 11, `00_Investigation_Report.md` A19).

## Positioning Statement
For the PRD/viva framing: *"Enterprise travel tools treat explainability as a compliance afterthought — a policy pass/fail flag. AI Trip Optimizer treats it as the core UX: every recommendation comes with a structured, auditable record of what was considered and why."* This is an honest differentiation — it doesn't claim competitors entirely lack these capabilities, it identifies a genuine gap in how they present optimization reasoning to the end user.
