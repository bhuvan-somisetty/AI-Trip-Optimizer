# Project Status

> **Provenance:** the team's own status check, written 2026-11-12 against `03_PRD.md` (the approved PRD with its amendments). Every "Done" item points at the code or test that shows it.

**Live:** https://ai-trip-optimizer.vercel.app · **API docs:** https://ai-trip-optimizer-api.vercel.app/docs

## 1. Summary

| | |
|---|---|
| PRD Must items | **8 of 8 built and live** |
| PRD Should items | Dashboard **mostly built** (savings missing for real accounts) |
| PRD stretch items | What-If Simulator and multi-agent pipeline **not started** |
| Backend | 17 endpoints + `/health`, 6 tables, 11 migrations, 153 passing tests |
| Frontend | 14 routes, wired to the API; optional in-browser demo mode |
| Data | real flight fares (Travelpayouts) and live hotel prices (Google Hotels via SerpApi) |
| AI | LangGraph pipeline; Gemini writes the rationale behind a numbers guardrail |
| Delivery | Vercel (frontend + API) and Neon Postgres; GitHub Actions CI on every PR |

## 2. PRD checklist

| PRD item | Status | Where |
|---|---|---|
| **US-001** Traveler management: save with preferences, select when creating a trip, can't delete one with trips | Done | `routers/travelers.py`, `test_travelers.py`, `/users` page |
| **US-002** Trip request: unique ID, dates/budget/preferences, starts `DRAFT` | Done | `POST /trip`, `test_trips.py`, `/planning` page |
| **US-003** Optimized itinerary: flights, stay, total, check result, within a few seconds | Done (2.6–2.7 s live) | `POST /trips/{id}/optimize`, `pipeline/graph.py`, `test_optimize.py` |
| **US-004** Why one option beat another: every alternative with price and a structured reason, winner included | Done | Trade-off Ledger in `graph.py`, `test_pipeline.py` |
| **US-005** Budget/constraint issues name the rule and the line item, visibly flagged | Done | `check_node` / `price_check`, flags on the trip page |
| **US-006** Rationale references the chosen items and never states a wrong number | Done | `write_rationale` guardrail, `test_compose_fails_when_llm_invents_a_number` |
| **US-007** Edit a line item (total recalculates), approve → `DECIDED`, reject needs a reason | Done | `PATCH /trips/{id}/itinerary`, `POST /trips/{id}/decision`, `test_edit_itinerary.py`, `test_decisions.py` |
| **US-010** Audit history of every decision and pipeline run | Done | `audit_events`, `GET /audit`, `test_audit.py`, `/audit` page |
| **US-010** Dashboard: total spend, average savings, average turnaround per period | Partly done | `/analytics` shows spend, turnaround and approval rate; savings is 0 for real accounts (§4, item 2) |
| **US-011** (stretch) What-If preview | Not started | `POST /trips/{id}/preview` is specified in `07_API_Specification.md` only |
| Product states `DRAFT → OPTIMIZING → OPTIMIZED → UNDER_REVIEW → DECIDED`, plus `OPTIMIZATION_FAILED` | Done | `TripStatus` in `models.py`; a second optimize click during a run gets 409 |
| Principle: human in the loop | Done | nothing is decided without an explicit approve/reject; nothing is booked |

## 3. Built beyond the original plan
- **Real prices** instead of mock data (amendment in `01_Project_Overview.md`). When there's no fare on the chosen day, the run fails with the nearest dates that have fares.
- **Sign in with Google** next to email and password (`POST /auth/google`).
- **Gemini** through its OpenAI-compatible API, with a template fallback when the LLM is off or fails.
- **Line-item edits** keep the Trade-off Ledger honest: the swapped-in option is marked "Picked by the reviewer", and the rationale says so.
- **Deployment and CI:** both apps on Vercel, Postgres on Neon, tests/lint/build on every pull request.

## 4. What's left, in priority order

| # | Item | Why it matters | Size |
|---|---|---|---|
| 1 | **Demo video + deployment link** (due Nov 25, `15_Roadmap.md`) | A graded milestone. Use DEL→BOM, 2026-12-22 to 12-25: it has fares and many hotels, so editing can be shown | 1 hour |
| 2 | **Average savings for real accounts** (US-010): return the gap between the chosen option and the most expensive viable alternative from the backend, as `14_Evaluation_Metrics.md` defines it | The only PRD metric that shows 0 on the live site | small |
| 3 | **Return flight:** the total covers the outbound flight and the hotel only | A mentor may ask why a round trip's "total cost" has one flight | medium |
| 4 | **Written confirmation of the scope cuts** (R-010, R-011): RAG removal was verbal, and the submitted PRD PDF still lists two removed rows | Protects the team if asked "where is the Knowledge Assistant?" at the external viva | a message to the mentor |
| 5 | **Frontend tests** (`12_Testing_Strategy.md` §2): component tests for the trip form and the review/edit/approve flow | The testing strategy promises them; today only lint, type-check and build run | medium |
| 6 | **Informal usability check** with 2–3 people (`14_Evaluation_Metrics.md` UX) | The one UX metric not measured | 1 hour |
| 7 | **What-If Simulator** (US-011, stretch) | Optional; the strongest stretch item if time remains | large |
| 8 | Small gaps: password reset is a placeholder; admins can only be made in the database; ~110 merged branches could be deleted on GitHub | Polish | small |

## 5. Viva readiness
Both team members should be able to walk through the whole flow on the live site (`16_Team_Responsibilities.md`), and answer:
- Why the LLM never computes a price, and what happens when it states one anyway (guardrail, `08_GenAI_Architecture.md` §2).
- Why RAG is not in the product (instructor scope cut, `03_PRD.md` amendment 2026-09-16).
- Where the prices come from and what happens when a date has no fares.
- How an edit keeps the total, flags and ledger consistent (recomputed in code, never sent by the client).
- How the audit trail stays complete (written in the same transaction as each action; append-only).
