# Testing Strategy

> **Provenance:** Entirely the team's own testing approach — no testing requirements are specified in the brief or PRD.

## 1. Backend Testing
- **Framework:** `pytest` + `httpx` (for FastAPI's `TestClient`).
- **Unit tests:** budget/constraint check logic, total-cost recalculation on edit — all pure Python, no LLM involved, so these should have high coverage and run fast.
- **Integration tests:** each API endpoint against a test database (a separate Postgres schema/DB, not the dev one), covering the happy path and the documented error cases (e.g. deleting a traveler with existing trips returns 409).
- **Pipeline tests:** run the LangGraph pipeline against fixed mock data and assert the *structure* of the response (Trade-off Ledger has an entry per candidate, totals match) — not the exact LLM prose, since that's non-deterministic.

## 2. Frontend Testing
- Component tests for key interactive pieces: the trip request form, the itinerary review/approve flow, the assistant chat panel — verifying loading/error states render correctly (React Query's states) rather than full end-to-end browser automation, which is out of scope for the timeline.

## 3. GenAI-Specific Evaluation
This is distinct from conventional testing — see `14_Evaluation_Metrics.md` for the full evaluation harness. In brief:
- **Guardrail test:** assert the cost-figure-consistency check (in `08_GenAI_Architecture.md` §2) actually fails the pipeline when given a deliberately inconsistent LLM response (mocked), proving the guardrail works before trusting it in production.
- ~~**RAG citation test:** a small hand-built eval set...~~ **Removed 2026-09-16** — the instructor cut the RAG-based Trip Knowledge Assistant from scope, see `03_PRD.md` amendment / `17_Risk_Register.md` R-011.

## 4. What Is Not Tested (and why)
- Exact LLM prose wording — inherently non-deterministic; tests assert structure and guardrails, not exact text.
- Load/performance testing beyond the "a few seconds" target — no production traffic expected for a student project.

## 5. CI Integration
All backend tests run on every pull request via GitHub Actions before merge to `main` (see `13_CICD_and_Deployment.md`) — a red test blocks merge, not just a suggestion.
