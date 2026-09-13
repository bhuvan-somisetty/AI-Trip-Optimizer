# Single Day-by-Day Checklist (Day 0 – Day 60, Both Team Members)

> **Provenance:** This is the team's own execution plan, laid out as one continuous day list (not grouped by week) plus a master checklist, per the user's explicit request. It restates `26_Day_by_Day_Build_Plan.md` in a flatter, checkbox-friendly format — see that file for the "how to build it" technical detail behind each task. Day numbers are relative working days (Day 1 = your actual first working day, once confirmed with your mentor — see `17_Risk_Register.md` R-004), assuming a 5-day week.
>
> **Amended 2026-09-13:** Role split changed to a strict backend vs. frontend split, per the team's own decision — see `16_Team_Responsibilities.md`. Swetalin = Backend, Bhuvan = Frontend.

**Roles:** Swetalin = Backend (FastAPI, database, every API endpoint, LangGraph pipeline, RAG backend logic). Bhuvan = Frontend (Next.js UI for every screen, wiring screens to Swetalin's endpoints).

---

## Day 0 — Joint UI/UX Wireframing (before Day 1, ~2–3 hours, both together)
**Feature/Part:** UI/UX Wireframing — all 4 core screens (prep work, not a scored PRD feature itself)
- [ ] Read `10_UI_UX_Design.md` together, out loud, screen by screen
- [ ] Wireframe (Figma, low-fidelity) — **Trip Request Form**
- [ ] Wireframe — **Itinerary Result View** (Trade-off Ledger panel, budget/constraint flags, rationale, approve/reject) — the most important screen
- [ ] Wireframe — **Trip Knowledge Assistant chat panel** (incl. mode toggle for Ask This Itinerary)
- [ ] Wireframe — **Dashboard**
- [ ] Both: skim Navan (navan.com), ITILITE (itilite.com), Deem (deem.com) for layout inspiration, 5–10 min each
- [ ] Agree on shared visual language (nav structure, spacing, where primary actions live)
- [ ] Save the Figma link somewhere both can find (pin in chat / put in `README.md`)

**Deliverable:** ☐ One shared Figma file covering all 4 core screens.

---

**Feature/Part (Day 1–5):** App Shell + Backend Skeleton + Docker Compose — Infrastructure setup, not a scored PRD feature yet (official brief: `tech_stack` = React/Next.js, FastAPI, PostgreSQL)

## Day 1
- [ ] Swetalin: Create repo structure (`backend/`, `frontend/`, `data/`); write `docker-compose.yml` with Postgres (`pgvector/pgvector` image)
- [ ] Bhuvan: `npx create-next-app@latest`; confirm dev server runs at `localhost:3000`

## Day 2
- [ ] Swetalin: FastAPI skeleton (`app/main.py`, `/health` endpoint); confirm `uvicorn` runs
- [ ] Bhuvan: Install Tailwind + shadcn/ui; build layout shell (nav, page container) following the Day 0 wireframe

## Day 3
- [ ] Swetalin: Wire backend container into Docker Compose; confirm `docker compose up -d` brings up both
- [ ] Bhuvan: Install React Query; set up `lib/api.ts` fetch wrapper

## Day 4
- [ ] Swetalin: Write `.env.example` (DB URL, JWT secret placeholder, OpenAI key placeholder)
- [ ] Bhuvan: Confirm frontend calls `/health` through the wrapper and renders it

## Day 5 — Sync
- [ ] Both: Confirm `docker compose up -d` + `npm run dev` run side by side; commit Week 1 skeleton
- [ ] Bhuvan: Write `README.md` stub

**Deliverable:** ☐ Next.js + FastAPI running side by side, frontend calls `/health` successfully.

---

**Feature/Part (Day 6–10):** Auth & RBAC — official Must-have feature (brief field `must_have_features` includes "Auth")

## Day 6
- [ ] Swetalin: Install `alembic`, `sqlmodel`, `psycopg2-binary`; write the `users` SQLModel
- [ ] Bhuvan: Quick wireframe (15 min) of login/register forms; build with shadcn/ui form components

## Day 7
- [ ] Swetalin: First Alembic migration (`users` table); `alembic upgrade head`
- [ ] Bhuvan: Zod schemas mirroring register/login request shapes

## Day 8
- [ ] Swetalin: `passlib` password hashing + `POST /auth/register`
- [ ] Bhuvan: Wire register form to `POST /auth/register` (React Query mutation)

## Day 9
- [ ] Swetalin: JWT issuance (`python-jose`) + `POST /auth/login`; write `get_current_user` dependency
- [ ] Bhuvan: Wire login form; store JWT

## Day 10 — Sync
- [ ] Both: Agree on the JWT payload shape (user id, role, expiry)
- [ ] Swetalin: Write `require_admin` dependency
- [ ] Bhuvan: Add auth state (protected routes redirect to login)

**Deliverable:** ☐ A user can register, log in, frontend holds a valid JWT.

---

**Feature/Part (Day 11–15):** Traveler Management (US-001, Must) + Trip Request Creation (US-002, Must) + mock data — official Must-have feature (brief field `must_have_features` includes "CRUD")

## Day 11
- [ ] Swetalin: SQLModel + migration for `travelers` table
- [ ] Bhuvan: Traveler creation form UI (build from Day 0 wireframe)

## Day 12
- [ ] Swetalin: SQLModel + migration for `trips` table (status enum)
- [ ] Bhuvan: Trip request form UI — dates, budget, preferences (build from Day 0 wireframe)

## Day 13
- [ ] Swetalin: `POST/GET/DELETE /travelers` incl. 409-on-existing-trips check
- [ ] Bhuvan: Wire traveler form to API; traveler list view

## Day 14
- [ ] Swetalin: `POST/GET /trips` (status starts `DRAFT`)
- [ ] Bhuvan: Wire trip request form to API; trip list view

## Day 15 — Sync
- [ ] Both: Confirm the trip JSON shape (dates/budget/preferences) agreed
- [ ] Swetalin: Write `data/mock_flights.json` + `data/mock_hotels.json` + seed script
- [ ] Bhuvan: Trip detail page skeleton

**Deliverable:** ☐ Full traveler/trip CRUD working; mock data seeded.

---

**Feature/Part (Day 16–20):** Trip Request UI hardening — polishing/testing US-001 + US-002 (no new feature this block, closes out Month 1 "Setup")

## Day 16
- [ ] Swetalin: Review DB indices/FK constraints
- [ ] Bhuvan: Loading/error states on all forms and lists

## Day 17
- [ ] Swetalin: Backend integration tests for traveler/trip endpoints
- [ ] Bhuvan: Form validation polish (Zod error messages)

## Day 18
- [ ] Swetalin: `GET /trips` status filter
- [ ] Bhuvan: Trip list filtering UI by status

## Day 19
- [ ] Swetalin: Code review Bhuvan's frontend/API wiring
- [ ] Bhuvan: Code review Swetalin's schema/migrations

## Day 20 — Sync (End of Month 1)
- [ ] Both: Walk through create-traveler → create-trip → view-trip flow end-to-end; fix anything broken
- [ ] Swetalin: Tag/commit `end-of-month-1`

**Deliverable:** ☐ Working, demoable CRUD app — no AI yet. Matches official Month 1 theme "Setup."

---

**Feature/Part (Day 21–25):** LangGraph Optimization Pipeline, node-by-node — Itinerary Composition (US-003, Must) + Budget & Constraint Check (US-005, Must). All backend — Bhuvan gets a head start on the result-screen UI shell ahead of real data.

## Day 21
- [ ] Swetalin: Define `TypedDict` state; scaffold `StateGraph` with 3 empty nodes; set up OpenAI account/API key in `.env`; install `langgraph`, `langchain-core`, `langchain-openai`
- [ ] Bhuvan: Review Itinerary Result View spec in `10_UI_UX_Design.md`; sketch the static layout (no data yet)

## Day 22
- [ ] Swetalin: Implement `search_node` against mock data
- [ ] Bhuvan: Build static Trade-off Ledger panel shell (placeholder rows)

## Day 23
- [ ] Swetalin: Implement `check_node` (budget/constraint rules); draft the `compose_node` prompt
- [ ] Bhuvan: Build static budget/constraint flag components

## Day 24
- [ ] Swetalin: Implement `compose_node` (LLM call using `check_node`'s output as context)
- [ ] Bhuvan: Build static rationale display component

## Day 25 — Sync
- [ ] Both: Review the full state shape flowing through all 3 nodes together
- [ ] Swetalin: Implement the cost-consistency guardrail; test it fails correctly on a mocked bad response

**Deliverable:** ☐ All 3 pipeline nodes exist and connect (not fully wired to an endpoint yet).

---

**Feature/Part (Day 26–30):** LangGraph Pipeline wired end-to-end — Trade-off Ledger (US-004, Must) + Explainable Rationale (US-006, Must), on top of US-003/US-005 from the last block

## Day 26
- [ ] Swetalin: Wire `POST /trips/{id}/optimize` end-to-end; persist `itineraries` + `tradeoff_ledger_entries`; build the itinerary result API response shape
- [ ] Bhuvan: Start wiring the static UI shell to the real `/optimize` response

## Day 27
- [ ] Swetalin: Add `OPTIMIZING`/`OPTIMIZED`/`OPTIMIZATION_FAILED` status transitions; pipeline integration test (fixed mock data, assert structure)
- [ ] Bhuvan: Loading state for the optimize call

## Day 28
- [ ] Swetalin: Tune `check_node` rules against realistic scenarios; tune the `compose_node` prompt for rationale quality
- [ ] Bhuvan: Continue wiring real data into the ledger/flags/rationale components

## Day 29
- [ ] Swetalin: Performance check — confirm `/optimize` responds within a few seconds
- [ ] Bhuvan: Client-side check for the optimize call

## Day 30 — Sync
- [ ] Both: Run the full pipeline together against 3–4 trip scenarios; review output quality
- [ ] Swetalin: Fix any Trade-off Ledger entries with missing/unclear reasons; Bhuvan: fix any UI issues surfaced by real data

**Deliverable:** ☐ `POST /trips/{id}/optimize` returns a real itinerary with Trade-off Ledger + guardrailed rationale, rendered in a working UI. Matches PRD US-003, US-004, US-005, US-006.

---

**Feature/Part (Day 31–35):** Review/Edit/Approve Workflow (US-007, Must) + Audit Trail (Must)

## Day 31
- [ ] Swetalin: Design `audit_events` writes (hook into `/optimize` and `/decision`)
- [ ] Bhuvan: Approve/Reject UI (reject requires a reason field)

## Day 32
- [ ] Swetalin: Implement `PATCH /trips/{id}/itinerary` (recalculate total on edit)
- [ ] Bhuvan: Edit-line-item UI, live total recalculation

## Day 33
- [ ] Swetalin: Implement `POST /trips/{id}/decision` (status → `DECIDED`)
- [ ] Bhuvan: Wire approve/reject buttons

## Day 34
- [ ] Swetalin: `GET /audit?trip_id=...` endpoint
- [ ] Bhuvan: Audit history view

## Day 35 — Sync
- [ ] Both: Confirm audit events capture everything needed to reconstruct "what happened and why"
- [ ] Bhuvan: Test the full review→edit→approve flow manually

**Deliverable:** ☐ Full itinerary lifecycle working: generate → review → edit → approve/reject, with audit trail.

---

**Feature/Part (Day 36–40):** Itinerary Result UI polish — the Trade-off Ledger (US-004) as a real, demo-ready screen, closes out Month 2 "Core features"

## Day 36
- [ ] Swetalin: Backend support for UI-driven query needs (e.g. sorting ledger by price)
- [ ] Bhuvan: Refine Day 0 wireframe for this screen against real API data (30 min); polish Trade-off Ledger panel component

## Day 37
- [ ] Swetalin: Review data completeness (every alternative has price + reason)
- [ ] Bhuvan: Polish budget/constraint flag components

## Day 38
- [ ] Bhuvan: Polish rationale display component

## Day 39
- [ ] Swetalin: Fix any backend gaps found during UI integration
- [ ] Bhuvan: Full itinerary result page assembly

## Day 40 — Sync (End of Month 2)
- [ ] Both: Demo the full result page together against 2–3 saved trips; polish
- [ ] Swetalin: End-of-month-2 commit

**Deliverable:** ☐ Demo-ready itinerary review screen. Matches official Month 2 theme "Core features."

---

**Feature/Part (Day 41–45):** Trip Knowledge Assistant v1 (US-08, Must) — document ingestion + RAG retrieval + cited Q&A. All backend/RAG work sits with Swetalin; Bhuvan gets a head start on the chat UI shell.

## Day 41
- [ ] Swetalin: `documents` + `document_chunks` migrations (pgvector column); install `pypdf`; standalone script extracting text from a sample PDF
- [ ] Bhuvan: Review assistant chat panel spec in `10_UI_UX_Design.md`; sketch chat UI structure (message list, input, mode toggle)

## Day 42
- [ ] Swetalin: Write sample knowledge documents (per `09_Mock_Data_Spec.md` §3); implement chunking logic
- [ ] Bhuvan: Build static chat panel shell (placeholder messages)

## Day 43
- [ ] Swetalin: Implement embedding + storing chunks (`POST /documents`)
- [ ] Bhuvan: Build citation display component (static)

## Day 44
- [ ] Swetalin: Review chunk quality against sample documents; implement pgvector similarity search for a question
- [ ] Bhuvan: Build "not covered" empty-state UI

## Day 45 — Sync
- [ ] Both: Test retrieval quality together — right chunk for an obvious question?
- [ ] Swetalin: Implement `POST /assistant/ask` with citation + "not covered" fallback; Bhuvan: confirm static UI shell matches the real response shape

**Deliverable:** ☐ Upload a document, ask a question, get a cited answer, rendered in a working chat UI. Matches PRD US-08.

---

**Feature/Part (Day 46–50):** Ask This Itinerary (US-09, Should) + authorization/security hardening around it

## Day 46
- [ ] Swetalin: Write trip-ownership-check FastAPI dependency; apply to all trip-scoped routes; design the itinerary-scoped retrieval
- [ ] Bhuvan: Wire the static chat panel to the real `/assistant/ask` endpoint from Day 41–45

## Day 47
- [ ] Swetalin: Implement `POST /trips/{id}/ask`
- [ ] Bhuvan: Quick wireframe (15 min) refining the assistant chat panel with the mode toggle; start Ask This Itinerary UI

## Day 48
- [ ] Swetalin: Ensure responses clearly labeled itinerary-scoped vs. knowledge-base
- [ ] Bhuvan: Continue building Ask This Itinerary UI

## Day 49
- [ ] Swetalin: Write authz integration tests (a user can't access another user's trip); audit trip-scoped endpoints for missing auth checks
- [ ] Bhuvan: Wire Ask This Itinerary UI to `POST /trips/{id}/ask`

## Day 50 — Sync
- [ ] Both: Verify a logged-in user genuinely cannot see another user's trip data
- [ ] Bhuvan: Test a few "why not the earlier flight?"-style questions

**Deliverable:** ☐ Ask This Itinerary working, clearly distinguished from general assistant; authorization holes closed.

---

**Feature/Part (Day 51–55):** Dashboard (US-010, Should) + Eval Harness + Security Review, plus What-If Simulator (US-011, Could/stretch) only if on schedule

## Day 51
- [ ] Swetalin: `GET /dashboard` aggregation query
- [ ] Bhuvan: Quick wireframe (15 min) refining dashboard against real metrics; build Dashboard UI

## Day 52
- [ ] Swetalin: Build accuracy eval harness (cost-consistency, ledger completeness checks) AND RAG citation eval set (WikiQA-style triples)
- [ ] Bhuvan: Accessibility pass on forms/dashboard

## Day 53
- [ ] Swetalin: Security review — secrets, auth, input validation pass
- [ ] Bhuvan: Polish Dashboard UI against real data

## Day 54
- [ ] Swetalin (if on schedule): `POST /trips/{id}/preview` — What-If Simulator
- [ ] Bhuvan (if on schedule): What-If diff UI

## Day 55 — Sync
- [ ] Both: Go/no-go decision on stretch goals based on actual progress
- [ ] Swetalin: Run the full eval harness; record results into `25_Project_Score.md`

**Deliverable:** ☐ Dashboard live, eval numbers captured, security reviewed, stretch goals attempted only if on schedule.

---

**Feature/Part (Day 56–60):** Deployment, Demo Video, Final Documentation Pass — Submission Deliverables (no PRD feature; wraps up all of Month 3 "AI & Deploy")

## Day 56
- [ ] Swetalin: Set up Render/Railway backend + Postgres; configure env vars
- [ ] Bhuvan: Set up Vercel frontend deployment

## Day 57
- [ ] Swetalin: Run Alembic migrations against production DB; seed mock data
- [ ] Bhuvan: Point frontend at production API URL; smoke test

## Day 58
- [ ] Both: Fix any deploy-specific bugs (env var mismatches, CORS)

## Day 59
- [ ] Both: Record demo video walkthrough (shared or split by backend/frontend)

## Day 60 — Final Sync
- [ ] Both: Final full walkthrough together against the live deployment; submit per `24_Submission_Checklist.md`
- [ ] Swetalin: Final docs pass — update `25_Project_Score.md` with real numbers

**Deliverable:** ☐ Live, working deployment; demo video; all submission checklist items complete.

---

# Master Checklist

## A. PRD Features (Must/Should/Could)
- [ ] Traveler management — **Must** (US-001)
- [ ] Trip request creation — **Must** (US-002)
- [ ] Flight/Stay search — **Must**
- [ ] Budget & constraint check — **Must** (US-005)
- [ ] Itinerary composition — **Must** (US-003)
- [ ] Trade-off Ledger — **Must** (US-004)
- [ ] Explainable rationale — **Must** (US-006)
- [ ] Review/edit/approve — **Must** (US-007)
- [ ] Trip Knowledge Assistant — **Must** (US-08)
- [ ] Audit trail — **Must**
- [ ] Ask This Itinerary — **Should** (US-09)
- [ ] Dashboard — **Should** (US-010)
- [ ] Streaming assistant responses — **Could**
- [ ] What-If Simulator — **Could (stretch)** (US-011)
- [ ] Multi-agent expansion — **Stretch**

## B. Infrastructure & Setup
- [ ] GitHub repo created, both team members as collaborators
- [ ] Docker Compose (Postgres + pgvector, backend)
- [ ] Next.js app shell (App Router, TypeScript, Tailwind, shadcn/ui)
- [ ] FastAPI skeleton
- [ ] Auth: JWT issuance/verification, RBAC (Member/Admin)
- [ ] DB schema + Alembic migrations for all tables (`users`, `travelers`, `trips`, `itineraries`, `tradeoff_ledger_entries`, `decisions`, `audit_events`, `documents`, `document_chunks`)
- [ ] Mock flight data seeded (`data/mock_flights.json`)
- [ ] Mock hotel data seeded (`data/mock_hotels.json`)
- [ ] Sample knowledge documents ready
- [ ] `.env.example`, `.gitignore`, `README.md`
- [ ] GitHub Actions CI (backend tests + frontend type check)
- [ ] Frontend deployed (Vercel)
- [ ] Backend + DB deployed (Render or Railway)

## C. UI/UX Wireframing
- [ ] Trip Request Form — wireframed Day 0
- [ ] Itinerary Result View — wireframed Day 0, refined Day 36
- [ ] Trip Knowledge Assistant chat panel — wireframed Day 0, refined Day 49
- [ ] Dashboard — wireframed Day 0, refined Day 51
- [ ] Login/Register forms — wireframed Day 6
- [ ] What-If diff UI — wireframed Day 54 (only if stretch goal attempted)

## D. Testing & Quality
- [ ] Unit tests: budget/constraint check logic, total-cost recalculation
- [ ] Integration tests: all API endpoints (happy path + documented error cases)
- [ ] Pipeline test: LangGraph response structure (not exact LLM prose)
- [ ] Guardrail test: cost-consistency check fails correctly on bad input
- [ ] RAG citation eval set built and run
- [ ] Frontend component tests: trip form, review/approve flow, chat panel
- [ ] Security review complete (secrets, auth, input validation)
- [ ] Accessibility pass on forms/dashboard

## E. Submission Deliverables
- [ ] PRD Submission (confirm date with mentor — `17_Risk_Register.md` R-004)
- [ ] GitHub Submission (full `docs/` kit + working repo skeleton)
- [ ] Viva 1
- [ ] Viva 2
- [ ] Viva 3
- [ ] Project Demo Video (recorded against deployed instance)
- [ ] Deployment Link (live, working)
- [ ] External Final Viva
- [ ] Open item resolved: where is the "Complete Documentation" file? (`17_Risk_Register.md` R-007)
- [ ] Open item resolved: does the submitted PRD PDF need correcting? (`17_Risk_Register.md` R-009/R-010)
