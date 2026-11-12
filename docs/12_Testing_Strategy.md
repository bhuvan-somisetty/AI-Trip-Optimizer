# Testing Strategy

> **Provenance:** Entirely the team's own testing approach — no testing requirements are specified in the brief or PRD.

> **Status 2026-11-13:** 188 backend tests and 32 frontend tests pass, locally and in CI on every pull request. CI also runs ESLint, TypeScript and a production build of the frontend.

## 1. Backend Testing
- **Framework:** `pytest` + `httpx` (for FastAPI's `TestClient`).
- **Unit tests:** budget/constraint check logic, total-cost recalculation on edit — all pure Python, no LLM involved, so these should have high coverage and run fast.
- **Integration tests:** each API endpoint against a fresh in-memory SQLite database per test (with foreign keys enforced, as on Postgres), covering the happy path and the documented error cases (e.g. deleting a traveler with existing trips returns 409).
- **No network, no keys:** flight and hotel searches read fixture fares (`tests/fixtures`) and the LLM is switched off or monkeypatched, so the suite needs no secrets and gives the same result every run.

| File | Tests | Covers |
|---|---|---|
| `test_auth.py` | 10 | register, login, JWT, Sign in with Google (token verification mocked) |
| `test_travelers.py` | 16 | traveler CRUD, ownership, 409 when a traveler has trips (US-001) |
| `test_trips.py` | 23 | trip creation and validation, listing and filters, ownership (US-002) |
| `test_travel_data.py` | 18 | Travelpayouts and SerpApi parsing, caching and failures |
| `test_pipeline.py` | 21 | search, budget/constraint check, Trade-off Ledger, rationale guardrail (US-003 to US-006) |
| `test_optimize.py` | 14 | `POST /trips/{id}/optimize`, status flow, failed runs, savings |
| `test_return_and_savings.py` | 14 | return flight search and rules, same-day timing, no-return flag, savings against the median valid option |
| `test_edit_itinerary.py` | 11 | line-item edits recalculate total, flags and ledger; refusals (US-007) |
| `test_what_if.py` | 12 | preview saves nothing and searches nothing, diff, failures, apply, audit (US-011) |
| `test_decisions.py` | 14 | review, approve, reject-needs-reason, no double decisions (US-007) |
| `test_audit.py` | 12 | every event type, order, admin vs member visibility, filters (US-010) |
| `test_dashboard.py` | 6 | spend, average savings and turnaround, periods, admin vs member (US-010) |

Some tests are parametrized, so pytest reports 188 cases from these 171 functions.
- **Pipeline tests:** run the LangGraph pipeline against fixed mock data and assert the *structure* of the response (Trade-off Ledger has an entry per candidate, totals match) — not the exact LLM prose, since that's non-deterministic.

## 2. Frontend Testing
- **Framework (built 2026-11-13):** Vitest with jsdom and React Testing Library (`frontend/vitest.config.mts`, `npm test`). Tests drive components the way a user does (roles, labels, clicks, typing), not their internals. The router is mocked; API calls are mocked at `fetch`, so no backend is needed.

| File | Tests | Covers |
|---|---|---|
| `src/app/(app)/planning/page.test.tsx` | 3 | the trip request form: each step blocks until its fields are valid; a complete request is saved as a `DRAFT` trip and logged (US-002) |
| `src/app/(app)/trips/[id]/page.test.tsx` | 4 | review flow: start review, reject needs a reason (and is blocked without one), reject with reason, approve (US-007) |
| `src/components/trips/whatif.test.tsx` | 6 | What-If: sends only changed inputs, shows the comparison, says why a change fails, saves only on request, not on decided trips (US-011) |
| `src/components/trips/itinerary.test.tsx` | 4 | cost summary: savings, missing savings on old itineraries, over budget |
| `src/lib/store.test.ts` | 6 | what the browser sends to the API: swapping the return flight, outbound swaps as `flight`, preview vs apply, reject needs a reason |
| `src/lib/mappers.test.ts` | 9 | reading API results: return flight, savings, ledger kinds, flags as issues; the trip form's request body |

- **Not automated:** full browser end-to-end runs against the deployed site; those were done by hand and with scripted API calls (`14_Evaluation_Metrics.md` §4). *(The assistant chat panel was removed with RAG, 2026-09-16.)*

## 3. GenAI-Specific Evaluation
This is distinct from conventional testing — see `14_Evaluation_Metrics.md` for the full evaluation harness. In brief:
- **Guardrail test:** assert the cost-figure-consistency check (in `08_GenAI_Architecture.md` §2) actually fails the pipeline when given a deliberately inconsistent LLM response (mocked), proving the guardrail works before trusting it in production. **Built:** `test_compose_fails_when_llm_invents_a_number`, plus tests that a failed or empty LLM reply falls back to the template rationale.
- ~~**RAG citation test:** a small hand-built eval set...~~ **Removed 2026-09-16** — the instructor cut the RAG-based Trip Knowledge Assistant from scope, see `03_PRD.md` amendment / `17_Risk_Register.md` R-011.

## 4. What Is Not Tested (and why)
- Exact LLM prose wording — inherently non-deterministic; tests assert structure and guardrails, not exact text.
- Load/performance testing beyond the "a few seconds" target — no production traffic expected for a student project.

## 5. CI Integration
All backend tests, frontend lint, frontend tests and the frontend build run on every pull request and every push to `main` via GitHub Actions (`.github/workflows/ci.yml`, see `13_CICD_and_Deployment.md`). A red check means don't merge.
