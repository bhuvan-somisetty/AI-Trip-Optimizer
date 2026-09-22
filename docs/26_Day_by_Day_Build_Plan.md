# Day-by-Day Build Plan (12 Weeks, Both Team Members)

> **Provenance:** This is the team's own execution plan — no day-by-day schedule is mandated by the brief or PRD. It operationalizes the official month themes (`15_Roadmap.md`) and the officially mandated/suggested tech (`22_Tech_Stack_and_Libraries.md`) into concrete daily tasks. Week numbers are relative (Week 1, Week 2...), NOT tied to specific calendar dates — the real start date depends on resolving `17_Risk_Register.md` R-004 (deadline confirmation) with the mentor first. Map Week 1 = your actual first working week once that's confirmed.
>
> **Amended 2026-09-09:** CO2 tasks removed from Week 5–6 below — CO2-aware optimization was cut per instructor instruction (see `03_PRD.md` amendment note, `17_Risk_Register.md` R-009).
>
> **Amended 2026-09-13:** Role split changed from topic-based (Product/Data/Optimizer vs. App/RAG/Assistant) to a strict **backend vs. frontend** split, per the team's own decision — see `16_Team_Responsibilities.md`. Swetalin now owns all backend/API/database/AI-pipeline work; Bhuvan now owns all frontend/UI work. Every day-table below has been rewritten to reflect this, including reallocating Week 9–11 tasks that used to mix backend RAG work into "Workstream B."
>
> **Amended 2026-09-16:** Weeks 9–10 rewritten — they originally covered the RAG-based Trip Knowledge Assistant and Ask This Itinerary, both cut from scope per instructor instruction ("RAG is not needed," see `03_PRD.md` amendment and `17_Risk_Register.md` R-011). That time is now authorization/hardening work and a buffer week.

## How to Read This Doc
Each week has a goal, a **How to build it** section per feature (concrete steps — function names, endpoints, files touched), then a **Day 1–5** breakdown per person. Assumes a standard 5-day working week; compress or stretch days as your real schedule requires, but keep the task order — later days depend on earlier ones.

**Roles:**
- **Backend — Swetalin:** FastAPI, database schema/migrations, every API endpoint, the LangGraph pipeline, guardrails, dashboard queries.
- **Frontend — Bhuvan:** Next.js UI for every screen, component library, frontend state/data-fetching, wiring screens to Swetalin's endpoints.

**Full library list** (don't reinstall per-week — install what's needed as you reach it): see `22_Tech_Stack_and_Libraries.md`.

## UI/UX Design Approach (added 2026-09-09, per the user's explicit ask)
Every screen gets a quick **low-fidelity wireframe before it gets built** — not all screens upfront, not skipped entirely. This is scheduled below, day by day, at the point each screen is first built.

- **Tool:** Figma (free tier is enough — one shared file, both of you as editors). Paper/whiteboard photographed and shared works too if Figma feels like overhead this early.
- **What "low-fidelity" means:** boxes, labels, and arrows — no colors, no real components, no pixel-perfect spacing. The goal is agreeing on *what's on the screen and where*, not finishing the visual design. Real styling comes from Tailwind + shadcn/ui during the build step itself.
- **Reference material:** `10_UI_UX_Design.md` already specifies what each screen must contain (per PRD acceptance criteria) — wireframe *that*, don't invent new content. For visual inspiration (layout patterns, not copying), the closest competitor UIs already reviewed in `19_Competitor_Analysis.md` are worth a quick look before wireframing:
  - **Navan** (navan.com) — cleanest modern layout, good reference for the trip request flow and overall nav structure.
  - **ITILITE** (itilite.com) — closest feature match to this project; useful for general layout ideas.
  - **Deem** (deem.com) — useful for dashboard/reporting layout ideas.
- **Where each screen's wireframe happens:** Day 0 below covers the 3 core screens jointly, upfront, so both of you share one visual vocabulary before splitting work; anything not covered there gets a quick wireframe pass on the day it's first built (marked inline in the tables below).

---

# Month 1 — Setup (Weeks 1–4)
No AI/LLM code this month — pure plumbing, so Month 2 isn't fighting infrastructure and AI logic at once.

## Day 0 — Joint UI/UX Wireframing Session (before Week 1 Day 1)
**Do this together, in one sitting, ~2–3 hours, before either of you writes any code.**

1. Open `10_UI_UX_Design.md` together and read each screen's required content out loud.
2. In Figma (or paper), sketch low-fidelity wireframes for the 3 core screens: **Trip Request Form**, **Itinerary Result View** (the most important one — Trade-off Ledger panel, budget/constraint flags, rationale text, approve/reject actions), and **Dashboard**.
3. Briefly look at Navan, ITILITE, and Deem's live sites (links above) for layout inspiration — 5–10 minutes each, not a deep audit.
4. Agree on a shared visual language: nav structure, spacing rhythm, where primary actions (Approve/Reject/Ask) live on the page — so the backend's data shapes and Bhuvan's later screens still feel like one product.
5. Save the Figma file link somewhere both of you can find it again (e.g. pinned in your shared chat, or a link in `README.md`).

**Deliverable:** One shared Figma file (or photographed sketches) covering all 4 core screens, agreed by both of you, referenced when building each screen later.

## Week 1 — App Shell + Backend Skeleton + Docker Compose

**How to build it:**
- Frontend: `npx create-next-app@latest` → TypeScript, App Router, Tailwind, `src/` directory. Install `@tanstack/react-query`, `zod`. Init shadcn/ui (`npx shadcn@latest init`).
- Backend: create `backend/` with `fastapi`, `uvicorn[standard]`, `sqlmodel`, `python-dotenv` in `requirements.txt`. A minimal `app/main.py` with a `/health` endpoint.
- Docker Compose: `docker-compose.yml` with a plain `postgres` service and a `backend` service.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Create repo structure (`backend/`, `frontend/`, `data/`, `docs/` already exists); write `docker-compose.yml` with Postgres | `create-next-app` scaffold; confirm dev server runs at `localhost:3000` |
| 2 | FastAPI skeleton (`app/main.py`, `/health` endpoint); confirm `uvicorn app.main:app --reload` runs | Install Tailwind + shadcn/ui; build a basic layout shell (nav, page container) — follow the Day 0 wireframe's nav structure |
| 3 | Wire backend container into Docker Compose; confirm `docker compose up -d` brings up Postgres + backend together | Install React Query; set up a `lib/api.ts` fetch wrapper pointed at `NEXT_PUBLIC_API_URL` |
| 4 | Write `.env.example` (DB URL, JWT secret placeholder, OpenAI key placeholder) per `11_Security_Design.md` §3 | Confirm frontend can call `/health` through the API wrapper and render the result |
| 5 | **Sync:** both confirm `docker compose up -d` + `npm run dev` run side by side without conflicts; commit Week 1 skeleton | Same sync; write `README.md` stub with setup steps (mirrors `23_Setup_Guide.md`) |

**Deliverable:** Next.js dev server + FastAPI (in Docker) running side by side, frontend successfully calls `/health`.

## Week 2 — Auth, RBAC, DB Schema, First Migrations

**How to build it:**
- DB: create the `users` table per `06_Database_Design.md` (id, email, hashed_password, role, created_at). First Alembic migration.
- Auth: `passlib[bcrypt]` for hashing, `python-jose[cryptography]` for JWT. `POST /auth/register`, `POST /auth/login` per `07_API_Specification.md`. A FastAPI dependency (`get_current_user`) that decodes the JWT and loads the user; a second dependency (`require_admin`) for admin-only routes — see `11_Security_Design.md` §2.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Install `alembic`, `sqlmodel`, `psycopg2-binary`; `alembic init`; write the `users` SQLModel | Quick wireframe (15 min) of login/register forms — these weren't in the Day 0 set since they're simple; then build with shadcn/ui form components |
| 2 | First Alembic migration (`users` table); run `alembic upgrade head` against the Docker Postgres | Zod schemas mirroring the register/login request shapes |
| 3 | Implement `passlib` password hashing + `POST /auth/register` | Wire the register form to `POST /auth/register` via React Query mutation |
| 4 | Implement JWT issuance (`python-jose`) + `POST /auth/login`; write `get_current_user` dependency | Wire login form; store JWT (e.g. httpOnly-friendly approach or a simple client store) |
| 5 | **Sync:** agree on the JWT payload shape (user id, role, expiry) so frontend and backend interpret it identically; write `require_admin` dependency | Add auth state to the app (protected routes redirect to login if no valid token) |

**Deliverable:** A user can register, log in, and the frontend holds a valid JWT for subsequent calls.

## Week 3 — Traveler + Trip CRUD, Mock Data Seeded

**How to build it:**
- DB: `travelers` and `trips` tables per `06_Database_Design.md` (trip `status` enum starts at `DRAFT`, per PRD US-002).
- Endpoints: `POST/GET/DELETE /travelers`, `POST/GET /trips` per `07_API_Specification.md` — the traveler-delete endpoint must return 409 if the traveler has existing trips (PRD US-001 acceptance criteria).
- Mock data: build `data/mock_flights.json` and `data/mock_hotels.json` per `09_Mock_Data_Spec.md`, plus a seed script.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | SQLModel + migration for `travelers` table | Traveler creation form UI (build from the Day 0 wireframe) |
| 2 | SQLModel + migration for `trips` table (status enum) | Trip request form UI (dates, budget, preferences) — build from the Day 0 wireframe |
| 3 | `POST/GET/DELETE /travelers` incl. the 409-on-existing-trips check | Wire traveler form to the API; traveler list view |
| 4 | `POST/GET /trips` (status starts `DRAFT`) | Wire trip request form to the API; trip list view |
| 5 | **Sync:** confirm the trip JSON shape (dates/budget/preferences) both sides agree on; write `data/mock_flights.json` + `data/mock_hotels.json` per spec, plus the seed script | Trip detail page skeleton (shows DRAFT trips, no optimization yet) |

**Deliverable:** Full traveler/trip CRUD working end-to-end in the UI; mock flight/hotel data seeded in the DB.

## Week 4 — Trip Request UI End-to-End (No Optimization Yet)

**How to build it:** Polish the create → list → detail flow so it's demo-ready even before the optimizer exists — this is the last "plumbing only" week per `15_Roadmap.md`.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Review/clean up DB indices and FK constraints across `travelers`/`trips` | Loading/error states on all forms and lists (React Query states) |
| 2 | Write backend integration tests for traveler/trip endpoints (`12_Testing_Strategy.md`) | Form validation polish (Zod error messages surfaced in UI) |
| 3 | Add `GET /trips` status filter | Trip list filtering UI by status |
| 4 | Code review of Bhuvan's frontend/API-wiring | Code review of Swetalin's schema/migrations |
| 5 | **Sync:** both walk through the full create-traveler → create-trip → view-trip flow together end-to-end; fix anything broken | Same; tag/commit `end-of-month-1` |

**Deliverable:** A working, demoable CRUD app — no AI yet, but a solid foundation. Matches Month 1's official theme "Setup."

---

# Month 2 — Core Features (Weeks 5–8)

## Week 5–6 — LangGraph Optimization Pipeline

**How to build it** (full detail in `08_GenAI_Architecture.md` §2):
1. Define the pipeline `TypedDict` state (trip request, candidate options, check result, composed itinerary).
2. `search_node` — pure Python, queries mock flight/hotel data by trip dates/preferences. No LLM.
3. `check_node` — pure Python, deterministic budget/constraint checks. No LLM (ADR-004).
4. `compose_node` — the only LLM call, using `.with_structured_output()` via `langchain-openai`, returning `{rationale, tradeoff_ledger}`. Prompt passes code-computed totals; instructs the model never to invent a different number.
5. Guardrail: after the LLM call, validate every dollar figure in `rationale` matches a value already in the structured response; on mismatch, set status `OPTIMIZATION_FAILED` instead of returning an inconsistent answer.
6. Wire `POST /trips/{id}/optimize` to run the graph and persist to `itineraries` + `tradeoff_ledger_entries`.

This whole feature is backend/AI-pipeline work — Bhuvan's frontend side this stretch is building the UI shell that will later render the result, ahead of the real data existing.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| Week5 Day1 | Define `TypedDict` state; scaffold the `StateGraph` with 3 empty nodes; set up an OpenAI account/API key in `.env` (not committed); install `langgraph`, `langchain-core`, `langchain-openai` | Review `10_UI_UX_Design.md`'s Itinerary Result View spec; sketch the static layout (no data yet) |
| Week5 Day2 | Implement `search_node` against mock data | Build the static Trade-off Ledger panel shell (placeholder rows) |
| Week5 Day3 | Implement `check_node` (budget/constraint rules); draft the `compose_node` prompt (evidence-before-explanation, structured output schema) | Build static budget/constraint flag components |
| Week5 Day4 | Implement `compose_node` calling the LLM with `check_node`'s output as context | Build static rationale display component |
| Week5 Day5 | **Sync:** review the full state shape flowing through all 3 nodes together; implement the cost-consistency guardrail; test it fails correctly on a mocked inconsistent response | Same sync — confirm the static UI shell matches the real state shape being returned |
| Week6 Day1 | Wire `POST /trips/{id}/optimize` end-to-end; persist `itineraries` + `tradeoff_ledger_entries`; build the itinerary result API response shape per `07_API_Specification.md` | Start wiring the static shell to the real `/optimize` response |
| Week6 Day2 | Add `OPTIMIZING`/`OPTIMIZED`/`OPTIMIZATION_FAILED` status transitions; pipeline integration test (fixed mock data, assert response structure, not exact LLM prose) | Loading state for the optimize call |
| Week6 Day3 | Tune `check_node` rules against a few realistic trip scenarios; tune the `compose_node` prompt for rationale quality/clarity | Continue wiring real data into the Trade-off Ledger/flags/rationale components |
| Week6 Day4 | Performance check: confirm `/optimize` responds within a few seconds (PRD US-003) | Same check from the client side |
| Week6 Day5 | **Sync:** run the full pipeline together against 3–4 different trip scenarios, review output quality; fix any Trade-off Ledger entries with missing/unclear reasons | Same sync; fix any UI issues surfaced by real data |

**Deliverable:** `POST /trips/{id}/optimize` returns a real itinerary with Trade-off Ledger + guardrailed rationale, rendered in a working UI. Matches PRD US-003, US-004, US-005, US-006.

## Week 7 — Review/Edit/Approve Workflow + Audit Trail

**How to build it:** `PATCH /trips/{id}/itinerary` (recalculates total cost), `POST /trips/{id}/decision` (approve → `DECIDED`; reject requires a reason) per PRD US-007. Every pipeline run and decision writes an `audit_events` row (event_type `PIPELINE_RUN` / `DECISION`).

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Design `audit_events` writes — hook into `/optimize` and `/decision` | Approve/Reject UI (reject requires a reason field) |
| 2 | Implement `PATCH /trips/{id}/itinerary` (recalculate total on edit) | Edit-line-item UI, live total recalculation on the client too (server is source of truth) |
| 3 | Implement `POST /trips/{id}/decision` (status → `DECIDED`) | Wire approve/reject buttons to the endpoint |
| 4 | `GET /audit?trip_id=...` endpoint | Audit history view (simple timeline/list) |
| 5 | **Sync:** confirm audit events capture everything needed to reconstruct "what happened and why" for a trip | Same; test the full review→edit→approve flow manually |

**Deliverable:** Full itinerary lifecycle working: generate → review → edit → approve/reject, with an audit trail.

## Week 8 — Itinerary Result UI Polish

**How to build it:** Per `10_UI_UX_Design.md` — Trade-off Ledger panel as a first-class element (not an accordion afterthought), budget/constraint flags visibly tagged, rationale text that never states an unshown number. This screen matters most — revisit the Day 0 wireframe first, since by now you have real data shapes from Weeks 5–7 that may not match what was sketched blind.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Backend support for any UI-driven query needs (e.g. sorting ledger entries by price) | Refine the Day 0 wireframe for this screen against real API response data (30 min), then polish the Trade-off Ledger panel component |
| 2 | Review data completeness — every alternative has price + reason populated | Polish budget/constraint flag components (rule + offending line item) |
| 3 | — | Polish rationale display component |
| 4 | Fix any backend gaps found during UI integration | Full itinerary result page assembly |
| 5 | **Sync:** demo the full result page together against 2–3 saved trips; polish based on what looks unclear | Same; end-of-month-2 commit |

**Deliverable:** A demo-ready itinerary review screen. Matches Month 2's official theme "Core features."

---

# Month 3 — AI & Deploy (Weeks 9–12)

## Week 9 — Authorization Checks + API Hardening

*(Amended 2026-09-16: this week originally covered knowledge-document ingestion and the Trip Knowledge Assistant — cut from scope, "RAG is not needed." See amendment note at the top of this file.)*

**How to build it:** Every `/trips/{id}/...` endpoint must verify the requesting user has access (`11_Security_Design.md` §2) — a trip-ownership-check FastAPI dependency applied to all trip-scoped routes, not repeated inline per route. Also a full pass documenting concrete input/output examples for every endpoint in `07_API_Specification.md`, per the instructor's separate "input/output of API" instruction.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Write the trip-ownership-check FastAPI dependency; apply to all trip-scoped routes | Review frontend error-state handling against real backend error shapes (401/403/404/409/422) |
| 2 | Write authz integration tests (a user can't access another user's trip) | UI polish pass on forms/lists using the buffer time |
| 3 | Document concrete request/response JSON examples for every endpoint in `07_API_Specification.md` | Same UI polish pass, continued |
| 4 | Audit trip-scoped endpoints for missing auth checks; fix any gaps found | Cross-check frontend API calls against the now-documented request/response shapes |
| 5 | **Sync:** verify together that a logged-in user genuinely cannot see another user's trip data; walk through the documented API examples together via `/docs` (Swagger) | Same sync |

**Deliverable:** Every trip-scoped endpoint has a real authorization check; `07_API_Specification.md` documents concrete input/output for every endpoint.

## Week 10 — Buffer / Hardening

*(Amended 2026-09-16: this week originally covered Ask This Itinerary — cut from scope along with the rest of the RAG-based features. See amendment note at the top of this file.)*

**How to build it:** No new feature this week — extra time to harden the optimization pipeline (the project's one AI surface) and polish the UI, or to catch up if Weeks 1–9 ran long.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Re-test the optimization pipeline against edge cases (tight budget, multiple close-priced options) | Polish the Itinerary Result View against real data |
| 2 | Add/expand backend tests for the pipeline guardrail | Accessibility pass on forms (label associations, keyboard nav) |
| 3 | Catch-up buffer — clear any open bugs from Weeks 1–9 | Catch-up buffer — clear any open bugs from Weeks 1–9 |
| 4 | Catch-up buffer | Catch-up buffer |
| 5 | **Sync:** full walkthrough of the app together, list anything still rough before Week 11 | Same sync |

**Deliverable:** A hardened, bug-free Must-have feature set going into Week 11 — no new scope added this week.

## Week 11 — Dashboard, Eval Harness, Security Review, Stretch Goals

**How to build it:** `GET /dashboard?period=...` aggregating spend/savings/turnaround (PRD US-010). Eval harness per `14_Evaluation_Metrics.md`. Security review per `11_Security_Design.md`. Stretch goals only if on schedule — What-If Simulator first (cheaper), multi-agent only if time remains (`17_Risk_Register.md` R-005).

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | `GET /dashboard` aggregation query | Quick wireframe (15 min) refining the dashboard from Day 0 against real metrics available by now; then build Dashboard UI |
| 2 | Build the accuracy eval harness (cost-consistency, ledger completeness checks) | Accessibility pass on forms/dashboard (`10_UI_UX_Design.md` §4) |
| 3 | Security review: secrets, auth, input validation pass (`11_Security_Design.md`) | Polish Dashboard UI against real data |
| 4 | **If on schedule:** `POST /trips/{id}/preview` (What-If Simulator, `persist:false`) | **If on schedule:** What-If diff UI |
| 5 | **Sync:** go/no-go decision on stretch goals based on actual progress; if behind, cut per `17_Risk_Register.md` R-005; run the full eval harness and record results into `25_Project_Score.md` | Same sync |

**Deliverable:** Dashboard live, eval numbers captured, security reviewed, stretch goals attempted only if genuinely on schedule.

## Week 12 — Deployment, Demo Video, Final Documentation Pass

**How to build it:** Vercel (frontend) + Render/Railway (backend+DB) per `13_CICD_and_Deployment.md`. Alembic migrations run as a deploy step. Demo video recorded against the live deployment, not localhost.

| Day | Swetalin (Backend) | Bhuvan (Frontend) |
|---|---|---|
| 1 | Set up Render/Railway backend + Postgres; configure env vars | Set up Vercel frontend deployment |
| 2 | Run Alembic migrations against production DB; seed mock data | Point frontend at the production API URL; smoke test |
| 3 | Fix any deploy-specific bugs (env var mismatches, CORS) | Same |
| 4 | Record demo video walkthrough (shared or split by backend/frontend) | Same |
| 5 | **Sync:** final full walkthrough together against the live deployment; submit per `24_Submission_Checklist.md`; final docs pass — update `25_Project_Score.md` with real numbers | Same sync |

**Deliverable:** Live, working deployment; demo video; all submission checklist items complete.

---

## A Note on This Being Your First GenAI Project
The only genuinely new-to-you concept in this whole plan is Weeks 5–6 — everything in Month 1 is standard CRUD/auth work you may already recognize from other web projects, and Weeks 9–10 are hardening/buffer time, not new AI concepts. Don't front-load anxiety onto Week 1 thinking it's the "AI part" — it isn't. The real learning curve starts at Week 5, and by then you'll have a working app to build the AI features into, not a blank page.
