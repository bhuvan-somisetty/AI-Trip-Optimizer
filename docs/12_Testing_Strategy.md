# Testing Strategy

> **Provenance:** Entirely the team's own testing approach — no testing requirements are specified in the brief or PRD.

> **Status 2026-11-12:** 153 backend tests pass, locally and in CI on every pull request. There are no automated frontend tests yet (§2); the frontend is checked by ESLint, TypeScript and a production build in CI.

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
| `test_optimize.py` | 13 | `POST /trips/{id}/optimize`, status flow, failed runs |
| `test_edit_itinerary.py` | 11 | line-item edits recalculate total, flags and ledger; refusals (US-007) |
| `test_decisions.py` | 14 | review, approve, reject-needs-reason, no double decisions (US-007) |
| `test_audit.py` | 12 | every event type, order, admin vs member visibility, filters (US-010) |

Some tests are parametrized, so pytest reports 153 cases from these 138 functions.
- **Pipeline tests:** run the LangGraph pipeline against fixed mock data and assert the *structure* of the response (Trade-off Ledger has an entry per candidate, totals match) — not the exact LLM prose, since that's non-deterministic.

## 2. Frontend Testing
- **Planned, not built:** component tests for key interactive pieces: the trip request form and the itinerary review/edit/approve flow — verifying loading/error states render correctly (React Query's states) rather than full end-to-end browser automation. *(The assistant chat panel was removed with RAG, 2026-09-16.)*
- **What runs today:** ESLint, `tsc` type-checking and `next build` on every pull request. The live site was checked end to end by hand and with scripted API calls on 2026-11-12 (`14_Evaluation_Metrics.md` §4).

## 3. GenAI-Specific Evaluation
This is distinct from conventional testing — see `14_Evaluation_Metrics.md` for the full evaluation harness. In brief:
- **Guardrail test:** assert the cost-figure-consistency check (in `08_GenAI_Architecture.md` §2) actually fails the pipeline when given a deliberately inconsistent LLM response (mocked), proving the guardrail works before trusting it in production. **Built:** `test_compose_fails_when_llm_invents_a_number`, plus tests that a failed or empty LLM reply falls back to the template rationale.
- ~~**RAG citation test:** a small hand-built eval set...~~ **Removed 2026-09-16** — the instructor cut the RAG-based Trip Knowledge Assistant from scope, see `03_PRD.md` amendment / `17_Risk_Register.md` R-011.

## 4. What Is Not Tested (and why)
- Exact LLM prose wording — inherently non-deterministic; tests assert structure and guardrails, not exact text.
- Load/performance testing beyond the "a few seconds" target — no production traffic expected for a student project.

## 5. CI Integration
All backend tests, frontend lint and the frontend build run on every pull request and every push to `main` via GitHub Actions (`.github/workflows/ci.yml`, see `13_CICD_and_Deployment.md`). A red check means don't merge.
