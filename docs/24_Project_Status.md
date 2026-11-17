# Project Status

> **Provenance:** the team's own status check against `03_PRD.md` (the approved PRD with its amendments), first written 2026-11-12, updated 2026-11-13 and again 2026-11-17 after a full test of the site. Every "Done" item points at the code or test that shows it.

**Live:** https://ai-trip-optimizer.vercel.app · **API docs:** https://ai-trip-optimizer-api.vercel.app/docs

## 1. Summary

| | |
|---|---|
| PRD user stories | **9 of 9 built**: every Must, the Should (dashboard) and the stretch What-If Simulator |
| Not built | the multi-agent pipeline (stretch), deliberately left out (R-005) |
| Backend | 25 endpoints + `/health`, 7 tables, 13 migrations, 246 passing tests |
| Frontend | 14 routes, wired to the API; 32 passing component and unit tests; optional in-browser demo mode |
| Data | live flights both ways (Google Flights via SerpApi, with Travelpayouts cached fares as the fallback) and live hotel prices (Google Hotels via SerpApi) |
| AI | LangGraph pipeline; Gemini writes the rationale behind a numbers guardrail |
| Delivery | Vercel (frontend + API) and Neon Postgres; GitHub Actions runs both test suites, lint and the build on every PR |

## 2. PRD checklist

| PRD item | Status | Where |
|---|---|---|
| **US-001** Traveler management: save with preferences, select when creating a trip, can't delete one with trips | Done | `routers/travelers.py`, `test_travelers.py`, `/users` page |
| **US-002** Trip request: unique ID, dates/budget/preferences, starts `DRAFT` | Done | `POST /trip`, `test_trips.py`, `/planning` page, `planning/page.test.tsx` |
| **US-003** Optimized itinerary: flights, stay, total, check result, within a few seconds | Done; round trip since 2026-11-13. Since the switch to Google Flights a run takes about 40 s with a fresh search and about 5.5 s when the search is cached (measured 2026-11-17), so "a few seconds" now only holds for cached searches | `POST /trips/{id}/optimize`, `pipeline/graph.py`, `test_optimize.py`, `test_return_and_savings.py` |
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
- **Trip edits (2026-11-17):** `PATCH /trips/{id}` saves a changed request. A saved itinerary is dropped and the trip goes back to `DRAFT`, and the edit is audited as `TRIP_UPDATED`.
- **Every trip filter applied (2026-11-17):** departure window, red-eyes, excluded airlines, nightly cap and amenities are rules with their own ledger reasons, and the priority (lowest cost, balanced, comfort, fastest) chooses among the valid options without going over budget. Only the hotel-distance filter isn't applied, because the hotel data has no distance.
- **Company travel policy (2026-11-17):** one policy, editable by admins only (`GET`/`PUT /policy`) and checked on every run. Hotels over the cap and short business-class flights are blocked; expensive fares and late bookings are flagged. Users also have a display name (`GET`/`PATCH /me`), which the audit trail returns as `actor_name`.
- **Deployment and CI:** both apps on Vercel, Postgres on Neon, backend tests, frontend tests, lint and build on every pull request.

## 4. What's left

| # | Item | Why it matters | Who / size |
|---|---|---|---|
| 1 | **Apply migration `20261117_100000` to production, then deploy the API and frontend** | The travel-policy table and `users.name` must exist before the new API goes live (R-013) | Bhuvan, 5 minutes |
| 1b | **Frontend follow-ups from the 2026-11-17 test:** wire "Edit request" to `PATCH /trips/{id}`, Settings to `/me` and `/policy`, and show `actor_name`; fix the priority card texts, the DEL→DEL route bug and the rejected-trip banner; hide the distance filter | Until then the new backend features don't reach the screen | Bhuvan, a few hours |
| 2 | **Demo video + deployment link** (due Nov 25, `15_Roadmap.md`) | A graded milestone. Use DEL → BOM, 2026-12-02 to 12-05: it had fares both ways and 17 hotels on 2026-11-13 (re-check the day before) | team, 1 hour |
| 3 | **Written confirmation of the scope cuts** (R-010, R-011): the RAG removal was verbal, and the submitted PRD PDF still lists two removed rows | Protects the team if asked "where is the Knowledge Assistant?" at the external viva | a message to the mentor |
| 4 | **Run the usability sessions** with 2–3 outside users, using `25_Usability_Check.md`, and record the results | The one UX metric not yet measured (Trade-off Ledger legibility) | team, 1 hour |
| 5 | Small gaps: password reset is a placeholder; a fresh optimizer run takes about 40 s since the switch to Google Flights (row US-003); CSV export, Google sign-in and the phone layout weren't covered by the 2026-11-17 test; ~110 merged branches could be deleted on GitHub. (Admins: sign up, then run `python -m app.make_admin <email>` from `backend/` with `DATABASE_URL` set.) | Polish | small |
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
- How the priority changes the pick without ever going over budget, and which company-policy rules block an option and which only flag it.
- Why editing a trip drops its itinerary instead of keeping it.
