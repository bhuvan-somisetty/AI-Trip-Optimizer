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
| Average savings shown | Difference between the chosen option and the median-priced viable alternative, summed over the line items *(amended 2026-11-13, see below)* | Dashboard metric (PRD US-010) |

**Savings definition, amended 2026-11-13:** the original definition compared the chosen option with the *most expensive* viable alternative. On live data that is dominated by luxury hotels that happen to meet the rating rule: a DEL → BOM run reported savings of 171,136 on a 9,545 trip. The figure is now measured against the **median** price of the options that met every rule, per line item (outbound flight, return flight, stay), which reads as "how much cheaper than a typical acceptable option". The same run's savings are now in proportion to the trip (a live DEL → BOM round trip of 14,950 showed savings of 9,450). Computed in `check_node` (`backend/app/pipeline/graph.py`), tested in `test_return_and_savings.py`.

## 3. How This Feeds the Testing Strategy
Accuracy metrics tied to code guardrails become automated tests (`12_Testing_Strategy.md`); UX metrics are tracked via the dashboard itself and informal review, since they're inherently less automatable for a 2-person team in 12 weeks.

## 4. Reporting
The final self-assessment against these metrics is done once the MVP is functional — not estimated in advance.

### Self-assessment, 2026-11-12
Measured on the live deployment (https://ai-trip-optimizer.vercel.app, API on Vercel `sin1`, Neon Postgres, Gemini `gemini-3.5-flash-lite`) with scripted API calls, plus the backend test suite.

| Metric | Target | Result | Evidence |
|---|---|---|---|
| Cost-figure consistency | 100% | **Met by construction.** Every number in an LLM rationale is checked against the computed figures; a mismatch fails the run, so no inconsistent rationale can be saved | `test_compose_fails_when_llm_invents_a_number`; live runs on DEL→BOM returned Gemini rationales whose figures match the saved totals |
| Trade-off Ledger completeness | 100% | **Met.** Every option the run considered has a kind, price, won/lost and reason; exactly one winner per kind | `test_compose_ledger_lists_every_option_with_one_winner_each`; live DEL→BOM run: 4 flight rows and 17 hotel rows, all with a price and a reason |
| Budget/constraint check correctness | every documented rule | **Met.** Over budget, no option meeting preferences, no flights, fares on another day, same-day trips | `test_pipeline.py` (21 tests), `test_edit_itinerary.py` (over-budget after an edit) |
| Generation turnaround | "a few seconds" (US-003) | **Met.** 2.6–2.7 s for a full run with live fares, hotels and the Gemini rationale; about 0.7 s when there are no fares for the date. Each run's time is saved as `run_ms` in its audit event | live runs, 2026-11-12 |
| Ledger legibility | user can tell why an option lost without the prose | **Met in design.** Each losing row states its reason in one structured line ("Price: 1,199 more than HT-c5ed804f", "Different day: … departs 2026-12-19, 3 day(s) before the trip starts"). The informal test with outside users has not been done | `07_API_Specification.md` examples |
| Approval rate | tracked, no target | **Tracked** on the Analytics page per period | `frontend/src/app/(app)/analytics/page.tsx` |
| Average savings | dashboard metric (US-010) | **Met (2026-11-13).** Every itinerary carries a savings figure (chosen vs the median valid option); the Analytics page and `GET /dashboard` average it over approved trips | `test_dashboard.py`, `test_return_and_savings.py`; local run on live fares, DEL → BOM 2026-12-02 to 12-05: total 14,950, savings 9,450 |
| Round-trip totals | not in the original metrics | **Met (2026-11-13).** The total includes the flight back when a fare exists; otherwise a flag says it doesn't | same local run: outbound 6,563 + return 6,812 + 3 nights at 525 = 14,950 |

**Usability check:** the script, tasks and SUS questionnaire are ready in `25_Usability_Check.md`; the sessions with 2–3 outside users still have to be run and their results added there.

**Known limits of the measurements:** the turnaround figures come from a handful of runs on one route, not a load test; fares depend on what the Travelpayouts cache holds for a date, so some dates have one flight and others several.
