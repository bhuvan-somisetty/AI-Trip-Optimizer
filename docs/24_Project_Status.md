# Project Status

> **Provenance:** the team's own status check against `03_PRD.md` (the approved PRD with its amendments), first written 2026-11-12 and updated 2026-11-13. Every "Done" item points at the code or test that shows it.

**Live:** https://ai-trip-optimizer.vercel.app · **API docs:** https://ai-trip-optimizer-api.vercel.app/docs

## 1. Summary

| | |
|---|---|
| PRD user stories | **9 of 9 built**: every Must, the Should (dashboard) and the stretch What-If Simulator |
| Not built | the multi-agent pipeline (stretch), deliberately left out (R-005) |
| Backend | 20 endpoints + `/health`, 6 tables, 12 migrations, 188 passing tests |
| Frontend | 14 routes, wired to the API; 32 passing component and unit tests; optional in-browser demo mode |
| Data | real flight fares both ways (Travelpayouts) and live hotel prices (Google Hotels via SerpApi) |
| AI | LangGraph pipeline; Gemini writes the rationale behind a numbers guardrail |
| Delivery | Vercel (frontend + API) and Neon Postgres; GitHub Actions runs both test suites, lint and the build on every PR |

## 2. PRD checklist

| PRD item | Status | Where |
|---|---|---|
| **US-001** Traveler management: save with preferences, select when creating a trip, can't delete one with trips | Done | `routers/travelers.py`, `test_travelers.py`, `/users` page |
| **US-002** Trip request: unique ID, dates/budget/preferences, starts `DRAFT` | Done | `POST /trip`, `test_trips.py`, `/planning` page, `planning/page.test.tsx` |
| **US-003** Optimized itinerary: flights, stay, total, check result, within a few seconds | Done (2.6–2.7 s live); round trip since 2026-11-13 | `POST /trips/{id}/optimize`, `pipeline/graph.py`, `test_optimize.py`, `test_return_and_savings.py` |
| **US-004** Why one option beat another: every alternative with price and a structured reason, winner included | Done, for outbound, return and stay | Trade-off Ledger in `graph.py`, `test_pipeline.py` |
| **US-005** Budget/constraint issues name the rule and the line item, visibly flagged | Done | `check_node` / `price_check`, flags on the trip page |
| **US-006** Rationale references the chosen items and never states a wrong number | Done | `write_rationale` guardrail, `test_compose_fails_when_llm_invents_a_number` |
| **US-007** Edit a line item (total recalculates), approve → `DECIDED`, reject needs a reason | Done | `PATCH /trips/{id}/itinerary`, `POST /trips/{id}/decision`, `test_edit_itinerary.py`, `test_decisions.py`, `trips/[id]/page.test.tsx` |
| **US-010** Audit history of every decision and pipeline run | Done | `audit_events`, `GET /audit`, `test_audit.py`, `/audit` page |
| **US-010** Dashboard: total spend, average savings, average turnaround per period | Done (2026-11-13) | `GET /dashboard`, `test_dashboard.py`; `/analytics` page; savings defined in `14_Evaluation_Metrics.md` |
| **US-011** (stretch) What-If preview: compare a changed input without losing the original | Done (2026-11-13) | `POST /trips/{id}/preview` and `/preview/apply`, `test_what_if.py`; What-if tab, `whatif.test.tsx` |
| Product states `DRAFT → OPTIMIZING → OPTIMIZED → UNDER_REVIEW → DECIDED`, plus `OPTIMIZATION_FAILED` | Done | `TripStatus` in `models.py`; a second optimize click during a run gets 409 |
| Principle: human in the loop | Done | nothing is decided without an explicit approve/reject; nothing is booked; a what-if is saved only on request |

## 3. Built beyond the original plan
- **Real prices** instead of mock data (amendment in `01_Project_Overview.md`). When there's no fare on the start date, the run fails with the nearest dates that have fares; a missing return fare is flagged instead of failing the trip.
- **Sign in with Google** next to email and password (`POST /auth/google`).
- **Gemini** through its OpenAI-compatible API, with a template fallback when the LLM is off or fails.
- **Line-item edits** keep the Trade-off Ledger honest: the swapped-in option is marked "Picked by the reviewer", and the rationale says so.
- **What-if previews never search again:** they rerun the checks on the saved search results, so they are instant, free, and compare like with like.
- **Deployment and CI:** both apps on Vercel, Postgres on Neon, backend tests, frontend tests, lint and build on every pull request.

## 4. What's left

| # | Item | Why it matters | Who / size |
|---|---|---|---|
| 1 | **Apply migration `20261113_100000` to production, then deploy the API and frontend** | The return-flight and savings columns must exist before the new API goes live (R-013) | team, 5 minutes |
| 2 | **Demo video + deployment link** (due Nov 25, `15_Roadmap.md`) | A graded milestone. Use DEL → BOM, 2026-12-02 to 12-05: it had fares both ways and 17 hotels on 2026-11-13 (re-check the day before) | team, 1 hour |
| 3 | **Written confirmation of the scope cuts** (R-010, R-011): the RAG removal was verbal, and the submitted PRD PDF still lists two removed rows | Protects the team if asked "where is the Knowledge Assistant?" at the external viva | a message to the mentor |
| 4 | **Run the usability sessions** with 2–3 outside users, using `25_Usability_Check.md`, and record the results | The one UX metric not yet measured (Trade-off Ledger legibility) | team, 1 hour |
| 5 | Small gaps: password reset is a placeholder; ~110 merged branches could be deleted on GitHub. (Admins: sign up, then run `python -m app.make_admin <email>` from `backend/` with `DATABASE_URL` set.) | Polish | small |
| — | Multi-agent pipeline (stretch) | Left out on purpose: the single pipeline meets every story, and a second agent would add LLM calls without adding a checked number | not planned |

## 5. Viva readiness
Both team members should be able to walk through the whole flow on the live site (`16_Team_Responsibilities.md`), and answer:
- Why the LLM never computes a price, and what happens when it states one anyway (guardrail, `08_GenAI_Architecture.md` §2).
- Why RAG is not in the product (instructor scope cut, `03_PRD.md` amendment 2026-09-16).
- Where the prices come from, and what happens when the start date or the return date has no fares.
- How an edit keeps the total, flags, savings and ledger consistent (recomputed in code, never sent by the client).
- What "savings" means and why it uses the median valid option, not the most expensive one (`14_Evaluation_Metrics.md`).
- Why a what-if preview can't change anything until it is applied, and why it doesn't search again.
- How the audit trail stays complete (written in the same transaction as each action; append-only).
