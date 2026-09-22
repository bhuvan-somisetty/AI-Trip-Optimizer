# Evaluation Metrics

> **Provenance:** The two metric names — **Accuracy** and **UX** — are official (brief field `evaluation_metrics`). Every specific measurement and target below is the team's own operationalization of those two words, not instructor-specified.

The project brief names two evaluation metrics directly: **Accuracy** and **UX**. This file operationalizes both into measurable checks, rather than leaving them abstract.

## 1. Accuracy

| Metric | Definition | Target |
|---|---|---|
| Cost-figure consistency rate | % of generated itineraries where every dollar figure in the LLM rationale matches a code-computed value | 100% (enforced by the guardrail in `08_GenAI_Architecture.md` §2 — a mismatch fails the pipeline, so this should be structurally guaranteed, not just measured) |
| Trade-off Ledger completeness | % of itineraries where every considered alternative has a populated price and reason | 100% |
| Budget/constraint check correctness | Unit-test coverage of the deterministic check logic against hand-crafted edge cases (exactly-at-budget, one-rule-violated, multiple-rules-violated) | Full coverage of documented rules |

*(Amended 2026-09-16: RAG citation accuracy and "don't know" precision metrics removed — the instructor cut the RAG-based Trip Knowledge Assistant from scope, see `03_PRD.md` amendment / `17_Risk_Register.md` R-011.)*

## 2. UX

| Metric | Definition | How measured |
|---|---|---|
| Itinerary generation turnaround | Time from request submit to result rendered | Should meet the PRD's "a few seconds" target (US-003) |
| Trade-off Ledger legibility | Whether a user can identify why an alternative lost without reading the prose rationale | Informal usability check with a few test users during Month 3 |
| Approval rate | % of generated itineraries approved without edits | Tracked on the dashboard; not a pass/fail target, but a signal of recommendation quality |
| Average savings shown | Difference between the chosen option and the most expensive viable alternative | Dashboard metric (PRD US-010) |

## 3. How This Feeds the Testing Strategy
Accuracy metrics tied to code guardrails become automated tests (`12_Testing_Strategy.md`); UX metrics are tracked via the dashboard itself and informal review, since they're inherently less automatable for a 2-person team in 12 weeks.

## 4. Reporting
Final self-assessment against these metrics goes in `25_Project_Score.md`, filled in once the MVP is functional — not estimated in advance.
