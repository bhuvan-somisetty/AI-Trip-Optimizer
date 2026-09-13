

<!-- ===== FILE: 12_Testing_Strategy.md ===== -->

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
- **RAG citation test:** a small hand-built eval set (WikiQA-style question/answer/evidence triples, per the project's reference dataset) run against the assistant, checking citation presence and correctness.

## 4. What Is Not Tested (and why)
- Exact LLM prose wording — inherently non-deterministic; tests assert structure and guardrails, not exact text.
- Load/performance testing beyond the "a few seconds" target — no production traffic expected for a student project.

## 5. CI Integration
All backend tests run on every pull request via GitHub Actions before merge to `main` (see `13_CICD_and_Deployment.md`) — a red test blocks merge, not just a suggestion.


---


<!-- ===== FILE: 13_CICD_and_Deployment.md ===== -->

# CI/CD and Deployment

> **Provenance:** Entirely the team's own CI/CD and deployment design — no deployment platform, branching strategy, or pipeline is mandated by the brief or PRD; the brief's `expected_output` field only says "Working app," not how it's deployed.

## 1. Branch Strategy
- `main` stays deployable at all times.
- All work happens on `feature/<name>` branches, merged via pull request — never committed directly to `main`.
- At least one team member reviews the other's PR before merge (2-person team, so this is a lightweight but real check, not a rubber stamp).

## 2. Continuous Integration
GitHub Actions workflow triggered on every PR:
1. Install backend dependencies, run `pytest`.
2. Install frontend dependencies, run the type checker (`tsc --noEmit`) and any component tests.
3. Block merge if either step fails.

## 3. Local Development
Docker Compose brings up:
- A PostgreSQL container (with `pgvector` extension enabled on init).
- The FastAPI backend container.
The frontend runs separately via `npm run dev` (Next.js dev server), pointed at the local backend via an env var — this avoids container rebuilds on every frontend change.

## 4. Deployment
- **Frontend:** Vercel, auto-deployed from `main` on every merge.
- **Backend + Database:** Render or Railway — both free-tier friendly for a student project; Postgres add-on with `pgvector` support on either platform.
- Environment variables (OpenAI key, DB URL, JWT secret) set directly in the hosting platform's dashboard — never committed, mirroring `.env.example`.

## 5. Database Migrations in Deployment
Alembic migrations run as a deploy step (before the new backend version starts serving traffic) — schema and code version stay in lockstep, avoiding the "app expects a column that doesn't exist yet" failure mode.

## 6. Submission Deliverables Mapped to This Pipeline
- **GitHub Submission deadline** — the `main` branch at that point in time, with CI green.
- **Deployment Link deadline** — the live Vercel + Render/Railway URLs, working end-to-end.
- **Project Demo Video** — recorded against the deployed instance, not localhost, so it reflects what a grader can actually click through themselves.

See `24_Submission_Checklist.md` for the full deadline-by-deadline breakdown.


---


<!-- ===== FILE: 14_Evaluation_Metrics.md ===== -->

# Evaluation Metrics

> **Provenance:** The two metric names — **Accuracy** and **UX** — are official (brief field `evaluation_metrics`). Every specific measurement and target below is the team's own operationalization of those two words, not instructor-specified.

The project brief names two evaluation metrics directly: **Accuracy** and **UX**. This file operationalizes both into measurable checks, rather than leaving them abstract.

## 1. Accuracy

| Metric | Definition | Target |
|---|---|---|
| Cost-figure consistency rate | % of generated itineraries where every dollar figure in the LLM rationale matches a code-computed value | 100% (enforced by the guardrail in `08_GenAI_Architecture.md` §2 — a mismatch fails the pipeline, so this should be structurally guaranteed, not just measured) |
| Trade-off Ledger completeness | % of itineraries where every considered alternative has a populated price and reason | 100% |
| Budget/constraint check correctness | Unit-test coverage of the deterministic check logic against hand-crafted edge cases (exactly-at-budget, one-rule-violated, multiple-rules-violated) | Full coverage of documented rules |
| RAG citation accuracy | On a hand-built eval set (WikiQA-style question/answer/evidence triples, per the project's reference dataset), % of answers whose citation actually supports the answer | Track and report; no fabricated citations |
| RAG "don't know" precision | % of out-of-scope questions correctly answered with "not covered" rather than a guess | High — false confidence is worse than an honest "I don't know" per product principles |

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


---


<!-- ===== FILE: 15_Roadmap.md ===== -->

# Roadmap (12 Weeks)

> **Provenance:** The three one-word month themes (Setup / Core features / AI & deploy) are official (brief fields `first/second/third_month_milestones`). The milestone date table below is from the instructor's separate deadline schedule (verify current before relying on it — see `17_Risk_Register.md` R-004). The week-by-week task breakdown within each month is entirely the team's own planning, not instructor-specified.

This is the high-level month/week shape. Day-to-day, per-person tasks with implementation steps live in the "AI Trip Optimizer — Week-by-Week Build Plan" Google Doc (search Drive by that title) — this file is the milestone-level summary for the docs kit.

## Month 1 — Setup (Weeks 1–4)
No AI/LLM code this month — pure plumbing, so Month 2 isn't fighting infrastructure and AI logic at the same time.
- **Week 1:** Next.js app shell + FastAPI skeleton + Docker Compose (Postgres) running side by side.
- **Week 2:** Auth (JWT), role-based access, DB schema + first Alembic migrations.
- **Week 3:** Traveler + Trip CRUD, mock flight/hotel data seeded.
- **Week 4:** Trip request UI end-to-end (create → list → detail), no optimization yet.

## Month 2 — Core Features (Weeks 5–8)
- **Week 5–6:** LangGraph pipeline — search node, deterministic budget/constraint check node, first version of the compose node (Trade-off Ledger + cost-consistency guardrail).
- **Week 7:** Review/edit/approve workflow, audit trail wired to every pipeline run and decision.
- **Week 8:** Itinerary result UI polish — Trade-off Ledger panel, budget/constraint flags, rationale display.

## Month 3 — AI & Deploy (Weeks 9–12)
- **Week 9:** Knowledge document ingestion (`pypdf` → chunk → embed → pgvector), Trip Knowledge Assistant first version.
- **Week 10:** Ask This Itinerary (itinerary-scoped grounding), authorization checks on trip-scoped endpoints.
- **Week 11:** Dashboard, eval harness (`14_Evaluation_Metrics.md`), security review, stretch goals if on schedule (What-If Simulator first, multi-agent only if time remains).
- **Week 12:** Deployment (Vercel + Render/Railway), demo video, final documentation pass.

## Milestone Dates (from the instructor's brief — confirm current before acting)
| Milestone | Date |
|---|---|
| PRD Submission | Aug 30 |
| GitHub Submission | Sept 6 |
| Viva 1 | Sept 15–22 |
| Viva 2 | Oct 15–22 |
| Viva 3 | Nov 15–22 |
| Project Demo Video + Deployment Link | Nov 25 |
| External Final Viva | Dec 10–15 |

**Flag:** as of this doc's writing, PRD and GitHub submission dates may already be behind — confirm with the mentor before treating this roadmap's week numbering as still aligned to the calendar (see `17_Risk_Register.md`).


---


<!-- ===== FILE: 16_Team_Responsibilities.md ===== -->

# Team Responsibilities

> **Provenance:** The team of 2 is confirmed via the PRD (two names listed as team members) — the brief sheet itself has no explicit team-size field. The workstream split below (Product/Data/Optimizer vs. App/RAG/Assistant) is the team's own division of labor, not instructor-assigned.

Both team members work across both frontend and backend at points — the split below is by *topic*, not frontend/backend, so both get real hands-on GenAI exposure rather than one person only touching CSS and the other only Python. Swap the names below if you divide it differently; the task list itself doesn't change.

## Workstream A — Product, Data & Optimizer
**Owner (suggested): Bhuvan**
- Database schema and Alembic migrations.
- Mock flight/hotel data (`09_Mock_Data_Spec.md`).
- The LangGraph optimization pipeline: search node, budget/constraint check node.
- Trade-off Ledger data structure and its guardrail (cost-figure consistency check).
- Dashboard aggregation queries.

## Workstream B — App, RAG & Assistant
**Owner (suggested): Swetalin**
- Next.js app shell, auth UI, trip request/review UI.
- Document ingestion pipeline (`pypdf` → chunk → embed).
- Trip Knowledge Assistant and Ask This Itinerary.
- Frontend state/data-fetching (React Query), component library setup (shadcn/ui).

## Shared / Sync Points
Per the week-by-week plan, each week has a "Sync" item — something both people must agree on together before either builds against it (e.g., the exact `itineraries` schema, before Workstream B builds a UI against it). Don't let these drift into "figure it out separately and reconcile later."

## Cross-Cutting Ownership
- **Testing:** each person writes tests for the code they own; integration tests covering both sides done together in Week 7–8.
- **Security review, deployment, documentation:** shared, done together in Month 3 rather than assigned to one person, since both need to be able to explain the whole system at viva.

## Viva Readiness
Both team members must be able to explain the full product in one paragraph and walk through either workstream — vivas are individual, not just "whoever built that part answers." Treat weekly syncs as the mechanism that keeps both people conversant in the whole system, not just their half.


---


<!-- ===== FILE: 17_Risk_Register.md ===== -->

# Risk Register

> **Provenance:** Entirely the team's own risk analysis, except R-004 (deadline risk), which references the instructor's official milestone date table directly.

Expands on the risk table in `02_BRD.md` §10 with fuller detail, owners, and status tracking. Update this file as risks change — it's meant to be live, not a one-time planning artifact.

| ID | Risk | Probability | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-001 | LLM states a cost/rationale figure inconsistent with the computed total | Medium | High | Compute totals in code only; guardrail check fails the pipeline on mismatch (`08_GenAI_Architecture.md` §2) | Workstream A | Open — implement guardrail in Week 6 |
| R-002 | RAG assistant answers without real grounding (hallucination) | Medium | High | Require citations on every answer; explicit "not covered" fallback when retrieval confidence is low | Workstream B | Open — implement in Week 9 |
| R-003 | Mock flight/hotel data too thin or unrealistic to demo well | Medium | Medium | Build a varied mock dataset early (Month 1), per `09_Mock_Data_Spec.md`, not as an afterthought | Workstream A | Open — Week 3 |
| R-004 | **Submission deadlines (PRD Aug 30, GitHub Sept 6) may already be behind current date** | Medium | High | Confirm current/live schedule with mentor immediately; if genuinely behind, prioritize Week 1 scaffolding over further planning docs | Both | **Needs immediate confirmation** |
| R-005 | 2-person team runs out of time for stretch goals (multi-agent, What-If Simulator) | High | Low | Stretch goals explicitly deprioritized below all Must/Should items; cut first if behind schedule (see `15_Roadmap.md` Week 11) | Both | Accepted — by design |
| R-006 | Duration ambiguity (12 vs. 20 weeks) causes re-pacing mid-project | Low (resolved) | Medium | Resolved via the instructor's milestone table (`15_Roadmap.md`) — 12-week build window confirmed | Both | Resolved 2026-09-08 |
| R-007 | The instructor's brief explicitly requires referring to a file titled "Complete Documentation" for the required PRD format — we have not located a file with that exact title; only 2 differently-named/differently-themed template files exist in the reference Drive folder | Medium | High | Search the Drive folder again closer to the PRD Submission deadline (it may be added later), or ask the instructor directly where "Complete Documentation" is; do not assume this docs kit's structure satisfies that requirement until verified | Both | **Open — unresolved, needs instructor confirmation** |
| R-008 | Scope drift beyond the approved PRD during implementation | Medium | Medium | `03_PRD.md` is the single source of truth; it matches the approved PDF except for clearly-marked amendments (see R-009) — any new feature idea gets checked against it before being built | Both | Ongoing discipline |
| R-009 | **The approved PRD PDF's Feature Priorities table still lists "CO2-aware optimization" and "Knowledge document upload" as Must — this was an oversight, not the instructor's actual intent.** The instructor's real instruction was only to remove two user stories (old US-005 "CO2 alongside cost," old US-009 "upload a knowledge document") from an earlier 13-story draft — confirmed by diffing that draft against the approved PDF. The stories were correctly removed, but the matching table rows were mistakenly left in when finalizing the PDF. This docs kit now corrects the table to match the real intended scope (see `03_PRD.md` amendment note). "Trip Knowledge Assistant" remains Must-have and still functionally needs *some* document-ingestion mechanism — kept as an implementation detail, not a scored line item. Corrected across `03_PRD.md`, `01_Project_Overview.md`, `02_BRD.md`, `05–10_*.md`, `15_Roadmap.md`, `16_Team_Responsibilities.md`, `19_Competitor_Analysis.md`, `20_Differentiators.md`, `21_Glossary.md`, `25_Project_Score.md`, `26_Day_by_Day_Build_Plan.md`. | Low (this docs kit is now correct) | Medium | See R-010 — the actual submitted PDF file itself is still wrong and needs a decision | Both | **Docs kit corrected 2026-09-09** |
| R-010 | **The actual PDF file (`AI Trip Optimizer — PRD final.pdf`) — whatever was submitted for "PRD Submission" — still contains the stale table rows and was not corrected by this session.** If that exact file was already submitted to the instructor/OJT portal, there's now a mismatch between the submitted document and this (corrected) docs kit. | Medium | High | Decide with your sir: (a) is a corrected PDF re-upload needed, or (b) is the verbal correction enough and the table typo is understood/forgiven. Don't assume — ask directly. | Both | **Open — needs the user's decision/action, not something I can fix from here** |

## How to Use This File
Revisit at each weekly sync (`16_Team_Responsibilities.md`) — add newly discovered risks, update status on existing ones, and don't let "Open" risks silently age past their relevant week without a decision.


---


<!-- ===== FILE: 18_Architecture_Decision_Records.md ===== -->

# Architecture Decision Records (ADRs)

> **Provenance:** Every ADR below documents the team's own technical decision-making. None of these specific choices (auth approach, PDF library, job-queue decision, etc.) are mandated by the brief or PRD — only the 4 stack technologies and LangGraph are official (see `04_TRD.md` §2).

Short, numbered records of decisions that could plausibly have gone another way — so the reasoning is preserved, not just the outcome.

## ADR-001: Single Postgres instance for both relational and vector data
**Decision:** Use `pgvector` inside the mandated PostgreSQL database rather than a dedicated vector DB (Pinecone, Weaviate, etc.).
**Why:** The stack (PostgreSQL) is already mandated by the project brief; adding a second database is unnecessary operational complexity for a 2-person team, and `pgvector` is mature enough for the data volumes here (a handful of knowledge documents, not millions of vectors).
**Status:** Accepted.

## ADR-002: (see ADR-001 — merged, no separate vector DB)
*(Number reserved to keep IDs stable if this list is extended; ADR-001 covers the decision.)*

## ADR-003: Hand-rolled JWT auth instead of a full auth framework
**Decision:** Use `passlib[bcrypt]` + `python-jose[cryptography]` directly rather than `fastapi-users` or similar.
**Why:** Only 2 roles (Member, Admin) are required. A full framework adds configuration surface and abstractions to learn that don't pay for themselves at this scale, for a first-time GenAI/backend team.
**Status:** Accepted.

## ADR-004: Deterministic budget/constraint checks in code, not the LLM
**Decision:** The `check_node` in the LangGraph pipeline is pure Python, not an LLM call.
**Why:** Budget/constraint rules need to be reproducible and auditable — an LLM re-deriving "is $6,200 under a $6,000 budget" is both unnecessary and a trust risk. The LLM's role is explaining a result computed elsewhere, not computing it.
**Status:** Accepted — directly enforces the PRD principle "no unsupported financial claims."

## ADR-005: One LLM call per itinerary generation, not one per candidate
**Decision:** A single structured-output LLM call in `compose_node` produces both the rationale and the full Trade-off Ledger.
**Why:** Keeps latency within the PRD's "a few seconds" target and keeps per-request cost predictable; candidate evaluation itself is deterministic and doesn't need per-candidate LLM calls.
**Status:** Accepted.

## ADR-006: No job queue (Celery/RQ/Redis) for the MVP
**Decision:** The optimization pipeline runs synchronously within the HTTP request.
**Why:** The PRD requires a response within a few seconds, which a synchronous call comfortably meets at this data scale; introducing a queue adds infrastructure and failure modes (worker crashes, queue backlogs) disproportionate to the actual latency problem.
**Status:** Accepted — revisit only if real latency measurements exceed the target.

## ADR-007: `langchain-core` + one provider package, not the full `langchain` meta-package
**Decision:** Install `langchain-core` and `langchain-openai` specifically, not the umbrella `langchain` package.
**Why:** The umbrella package pulls in many integrations the project doesn't use, bloating dependency resolution and install time for no benefit.
**Status:** Accepted.

## ADR-008: `pypdf` for PDF text extraction
**Decision:** Use `pypdf` over `pdfplumber` or `unstructured`.
**Why:** Pure Python, no OS-level dependency (e.g. Poppler) to install separately — the most accessible option for a beginner 2-person team on Windows/macOS mixed environments. The project only needs plain text extraction, not table/layout preservation.
**Status:** Accepted.


---
