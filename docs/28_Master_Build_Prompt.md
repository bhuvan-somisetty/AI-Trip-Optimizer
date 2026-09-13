# Master Build Prompt — AI Trip Optimizer

*Copy everything below this line and paste it as your first message to a fresh Claude Code session in a new project folder. It is fully self-contained — Claude does not need any other file from this repo to start building.*

---

## What You're Building

**AI Trip Optimizer** — a B2B web app a business uses to plan and optimize trips for its own people. It is **not** a consumer trip planner (like Expedia) and **not** a policy-compliance engine — it's a workspace where a team member submits a trip request, an AI pipeline searches mock flight/hotel data, checks it against budget/constraints, and produces an itinerary with a fully transparent, structured explanation of *why* it chose what it chose. A human always reviews and approves/rejects — nothing auto-finalizes. Separately, there's a RAG-grounded "Trip Knowledge Assistant" that answers travel-policy questions from uploaded documents, with citations.

**Product goal (verbatim from the approved PRD):** Create a trip-planning workspace that converts a trip request into an optimized, budget-checked, explainable itinerary and answers travel-related questions with cited evidence, without ever finalizing a decision on its own.

**Product principles — apply these to every feature you build:**
- Evidence before explanation (show the data before/alongside the prose).
- Human-in-the-loop (nothing auto-finalizes; approve/reject is always explicit).
- Clear uncertainty (the assistant visibly distinguishes a cited answer from "not covered").
- No unsupported financial claims (every number the AI states must already exist elsewhere in the response — never invented).
- Every AI output is traceable to data/model context.

Build this as a **working, runnable local demo** — Next.js frontend + FastAPI backend + Postgres (with pgvector) via Docker Compose, seeded with mock data, with every Must-have feature below functional end-to-end. Ask me clarifying questions only if something here is genuinely ambiguous; otherwise scaffold and implement incrementally, and tell me exactly how to run it when you're done with each phase.

---

## Tech Stack (use exactly this)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| Styling/UI | Tailwind CSS + shadcn/ui |
| Data fetching | TanStack React Query |
| Frontend validation | Zod |
| Backend | FastAPI (Python) |
| ORM | SQLModel |
| Migrations | Alembic |
| DB driver | psycopg2-binary (sync) |
| Database | PostgreSQL + `pgvector` extension |
| AI orchestration | LangGraph + `langchain-core` + `langchain-openai` (not the full `langchain` meta-package) |
| LLM | OpenAI `gpt-4o-mini` to start (swappable behind one interface) |
| PDF parsing | `pypdf` (pure Python, no OS-level dependency) |
| Auth | `passlib[bcrypt]` + `python-jose[cryptography]` — hand-rolled JWT, not a full auth framework |
| Testing | `pytest` + `httpx` (backend), component tests (frontend) |
| Local dev | Docker Compose (Postgres + backend together) |

**Backend `requirements.txt`:** fastapi, uvicorn[standard], sqlmodel, psycopg2-binary, alembic, passlib[bcrypt], python-jose[cryptography], langgraph, langchain-core, langchain-openai, pgvector, pypdf, pytest, httpx, python-dotenv

**Frontend deps:** next, react, react-dom, typescript, tailwindcss, @tanstack/react-query, zod, plus shadcn/ui via its CLI

**Deliberately do NOT install:** the full `langchain` meta-package, Celery/RQ/Redis (no job queue needed), a general auth framework like `fastapi-users`, heavier PDF tools like `pdfplumber`/`unstructured`.

---

## Repo Structure

```
backend/        FastAPI app, SQLModel models, Alembic migrations, LangGraph pipeline
frontend/       Next.js app
data/           mock_flights.json, mock_hotels.json, sample knowledge documents
docker-compose.yml
.env.example
README.md
```

---

## Database Schema (PostgreSQL + pgvector)

**users** — id (UUID PK), email (unique), hashed_password, role (enum: member/admin), created_at

**travelers** — id (UUID PK), name, preferences (jsonb), created_by (FK → users)

**trips** — id (UUID PK), traveler_id (FK → travelers), dates (daterange), budget (numeric), preferences (jsonb), status (enum: DRAFT/OPTIMIZING/OPTIMIZED/UNDER_REVIEW/DECIDED/OPTIMIZATION_FAILED), created_by (FK → users), created_at

**itineraries** — id (UUID PK), trip_id (FK → trips), flight_option (jsonb), stay_option (jsonb), total_cost (numeric, code-computed, NEVER LLM-generated), rationale (text, LLM-generated), created_at

**tradeoff_ledger_entries** — id (UUID PK), itinerary_id (FK → itineraries), alternative (jsonb, one candidate option considered), price (numeric), won (boolean), reason (text, specific structured reason)

**decisions** — id (UUID PK), trip_id (FK → trips), decided_by (FK → users), outcome (enum: APPROVED/REJECTED), reason (text, required when REJECTED), decided_at

**audit_events** — id (UUID PK), trip_id (FK → trips, nullable), event_type (text, e.g. PIPELINE_RUN/DECISION/DOCUMENT_UPLOAD), payload (jsonb), created_at

**documents** — id (UUID PK), title, uploaded_by (FK → users), uploaded_at

**document_chunks** — id (UUID PK), document_id (FK → documents), chunk_text (text), embedding (vector(1536), pgvector column)

**Relationships:** users 1—N travelers, travelers 1—N trips, trips 1—1 itineraries (one active itinerary per trip — What-If previews don't persist unless approved), itineraries 1—N tradeoff_ledger_entries, trips 1—N decisions (append-only), trips 1—N audit_events, documents 1—N document_chunks.

Every schema change must be an Alembic migration file — no manual/ad-hoc schema edits.

---

## API Endpoints

**Auth:** `POST /auth/register`, `POST /auth/login` (returns JWT)

**Travelers:** `POST /travelers`, `GET /travelers`, `DELETE /travelers/{id}` (409 if traveler has existing trips)

**Trips:**
- `POST /trips` — create; status starts DRAFT
- `GET /trips/{id}` — detail incl. current itinerary + status
- `GET /trips` — list, filterable by status
- `POST /trips/{id}/optimize` — runs the LangGraph pipeline; returns itinerary + Trade-off Ledger + budget/constraint result; sets status OPTIMIZING → OPTIMIZED or OPTIMIZATION_FAILED
- `PATCH /trips/{id}/itinerary` — edit a line item; recalculates total cost server-side
- `POST /trips/{id}/decision` — body `{outcome: "APPROVED"|"REJECTED", reason?: string}`; reason required when rejecting; sets status DECIDED
- `POST /trips/{id}/preview` *(stretch)* — What-If Simulator; body: one changed input; re-runs pipeline with `persist:false`, returns a diff without saving

**Knowledge Assistant:**
- `POST /documents` — upload (multipart); triggers pypdf extraction → chunk → embed
- `GET /documents` — list
- `POST /assistant/ask` — body `{question: string}`; cited answer or explicit "not covered"
- `POST /trips/{id}/ask` — Ask This Itinerary; body `{question: string}`; answers grounded in that trip's own itinerary/audit data only

**Dashboard & Audit:**
- `GET /dashboard?period=...` — total spend, average savings, average turnaround time
- `GET /audit?trip_id=...` — audit event history

**Conventions:** errors return `{detail: string}` with standard HTTP codes (401/403 auth, 404 missing, 409 conflict, 422 validation). All monetary figures in `/trips/{id}/optimize` are code-computed — the LLM's `rationale` field must never introduce a number not already present elsewhere in the response.

---

## GenAI Architecture

There are **two separate AI surfaces** — don't conflate them.

### 1. LangGraph Optimization Pipeline

**State (TypedDict):** trip request (dates/budget/preferences), candidate flight/stay options found, budget/constraint check result, final composed itinerary.

**Nodes:**
1. `search_node` — pure Python, queries mock flight/hotel data. No LLM call.
2. `check_node` — pure Python, deterministically checks each candidate against budget/constraint rules. No LLM call — this is what keeps "why it failed budget" trustworthy and reproducible.
3. `compose_node` — the **only** LLM call. Use `.with_structured_output()` (via `langchain-openai`) so the model returns a typed object: `{rationale: str, tradeoff_ledger: [{alternative, price, won, reason}]}`. The prompt must pass the code-computed totals explicitly and instruct the model to never introduce a different number.

**Why one LLM call, not one per candidate:** keeps latency to a few seconds and cost predictable — deterministic logic evaluates candidates; only the final explanation needs the LLM.

**Guardrail (must implement):** before returning the response, validate that every dollar figure in `rationale` matches a value already present in the structured response. On mismatch, treat it as a pipeline failure (set status `OPTIMIZATION_FAILED`) — never silently return an inconsistent answer.

### 2. RAG — Trip Knowledge Assistant

Standard RAG pattern (grounded in Lewis et al., RAG paper arXiv:2005.11401):
1. **Ingest:** uploaded document → `pypdf` text extraction → chunk (~500 tokens, with overlap) → embed each chunk → store in `document_chunks.embedding` (pgvector).
2. **Retrieve:** embed the question → pgvector cosine similarity search → top-k chunks.
3. **Generate:** pass retrieved chunks + question to the LLM with an explicit instruction: answer only from the provided chunks, cite the source document/chunk, and say "not covered" if the chunks don't actually answer the question.

### 3. Ask This Itinerary (itinerary-scoped RAG)

Same retrieve-then-generate pattern, but the retrieval source is a single trip's own stored data (itinerary, Trade-off Ledger entries, audit events) — not the general knowledge base. The response must make clear which source it drew from.

### Prompting principles (apply to both surfaces)
- Evidence before explanation — retrieved/computed facts go into the prompt context before the model explains.
- Structured output over free-form prose wherever the UI needs to render specific fields.
- Explicit "I don't know" instruction — tell the model directly to decline rather than guess when evidence is insufficient.

### LLM-specific security
- Prompt injection via uploaded documents: system prompt must explicitly separate instructions from retrieved content; retrieved chunks are never treated as instructions.
- The cost/rationale guardrail above is the primary trust mechanism — treat mismatches as failures, not soft warnings.

---

## Mock Data

**`data/mock_flights.json`** — records like:
```json
{"id": "FL-1001", "origin": "BLR", "destination": "DEL", "departure_time": "2026-10-12T06:15:00", "arrival_time": "2026-10-12T08:45:00", "airline": "Sample Air", "price": 6200, "cabin_class": "economy", "stops": 0}
```
Include multiple price points per route (budget vs. premium), at least one red-eye and one daytime option, a mix of direct/connecting — so the Trade-off Ledger has genuinely different rejection reasons (price, timing, stops), not just one dimension.

**`data/mock_hotels.json`** — records like:
```json
{"id": "HT-2001", "city": "DEL", "name": "Sample Central Hotel", "price_per_night": 3800, "rating": 4.2, "amenities": ["wifi", "breakfast_included"], "distance_to_center_km": 1.5}
```
Spread across budget/mid/premium tiers per city used in flight data.

**Sample knowledge documents:** at least one visa/entry-requirements summary, one travel-policy document (e.g. "flights over ₹X require manager approval"), one general FAQ (baggage, expense process) — short (1–3 pages), ingestable via the pypdf pipeline.

**Volume:** at least 3–4 flight options and 3–4 hotel options per route/city used in the demo — enough for non-trivial reasoning, not a full production catalog.

---

## UI/UX — Core Screens

**Trip Request Form** — traveler selection (or create new), dates, budget, preferences (free text + structured tags). Submit creates a DRAFT trip.

**Itinerary Result View** *(the most important screen)*:
- Chosen flight + stay + total cost, shown as data first.
- **Trade-off Ledger panel** — every alternative considered, with price and a one-line structured reason (won/lost + why). This is the core differentiator UI — a first-class panel, not an accordion afterthought.
- Budget/constraint flags — each issue visibly tagged with the specific rule and offending line item, not buried in prose.
- Rationale text — references the specific chosen items, never states a number not already shown above it.
- Approve / Reject (reason required) / Edit line item (recalculates total live).

**Trip Knowledge Assistant (chat panel)** — general mode (knowledge base) and itinerary-scoped mode ("Ask This Itinerary") must be visually distinct (e.g. a mode toggle) so the user always knows which source is being queried. Every answer shows its citation inline, or an explicit "I don't have information on that" state.

**Dashboard (Admin)** — total spend, average savings, average turnaround time for a selected period; link through to full audit history rather than duplicating it.

**What-If Simulator (stretch, build only if time remains)** — side-by-side/diff view: original vs. previewed change, changed fields highlighted, explicit "Save this instead" action.

**Component library:** Tailwind CSS + shadcn/ui — copy components into the project rather than building from scratch. Baseline accessibility (label associations, keyboard nav, contrast) on forms/dashboard.

---

## Auth & Security

- Two roles only: **Member** (create/manage own trips/travelers, use both assistant modes) and **Admin** (also: dashboard aggregates, knowledge-document management).
- Hand-rolled JWT: `passlib[bcrypt]` for hashing, `python-jose[cryptography]` for issuance/verification.
- Every `/trips/{id}/...` endpoint must verify the requesting user has access to that trip — implement as a reusable FastAPI dependency, not repeated inline per route.
- All secrets in `.env` (never committed); `.env.example` documents required keys with empty placeholders.
- Pydantic/SQLModel validates all input server-side (source of truth); Zod mirrors client-side for UX only.

---

## Product States

`DRAFT → OPTIMIZING → OPTIMIZED → UNDER_REVIEW → DECIDED`, with failure state `OPTIMIZATION_FAILED`.

---

## Full Feature List (build Must-haves first, in this order)

| Feature | Priority | User story |
|---|---|---|
| Traveler management | Must | US-001: add/list/delete a traveler; can't delete one with existing trips |
| Trip request creation | Must | US-002: create a trip, status starts DRAFT |
| Flight/Stay search | Must | (part of the pipeline `search_node`) |
| Itinerary composition | Must | US-003: generate an optimized itinerary with flights, stay, total cost, returned in a few seconds |
| Trade-off Ledger | Must | US-004: every alternative shown with price + specific won/lost reason |
| Budget & constraint check | Must | US-005: each issue names the specific rule + offending line item, visibly flagged |
| Explainable rationale | Must | US-006: rationale references specific chosen items; never states an unmatched cost figure |
| Review/edit/approve | Must | US-007: editing recalculates total; approve → DECIDED; reject requires a stored reason |
| Trip Knowledge Assistant | Must | US-08: cited answer, or explicit "not covered" if not in any document |
| Audit trail | Must | every pipeline run and decision writes an audit_events row |
| Ask This Itinerary | Should | US-09: answers about one specific itinerary, using its own data; never confused with knowledge-base answers |
| Dashboard | Should | US-010: total spend, average savings, average turnaround for a period; audit history independently intact |
| Streaming assistant responses | Could | nice-to-have, not required for MVP |
| What-If Simulator | Could (stretch) | US-011: preview a changed input without losing the original; explicit diff shown |

**Stretch, in priority order (only after all Must/Should work end-to-end):** (1) What-If Simulator, (2) multi-agent expansion — splitting `compose_node` into coordinating `FlightAgent`/`StayAgent`/`BudgetConstraintsAgent`/`ComposerAgent` nodes with an `Orchestrator`.

**Explicitly out of scope for this demo:** mobile-native app, offline mode, multi-language UI, live/real supplier data (mock data only), production-grade rate limiting/WAF, formal security certification.

---

## Suggested Build Order

1. **Foundation:** repo structure, Docker Compose (Postgres+pgvector, backend), Next.js shell, FastAPI skeleton with `/health`, confirm both run side by side.
2. **Auth:** `users` table + migration, register/login, JWT issuance/verification, protected routes on the frontend.
3. **Core CRUD:** `travelers` + `trips` tables/migrations/endpoints, seed `data/mock_flights.json` + `data/mock_hotels.json`, build the Trip Request Form and trip list/detail UI.
4. **Optimization pipeline:** LangGraph state + 3 nodes (`search_node`, `check_node`, `compose_node`), the cost-consistency guardrail, wire `POST /trips/{id}/optimize`, persist `itineraries` + `tradeoff_ledger_entries`.
5. **Review workflow:** `PATCH /trips/{id}/itinerary`, `POST /trips/{id}/decision`, `audit_events` writes, approve/reject/edit UI.
6. **Itinerary Result UI:** build out the full Trade-off Ledger panel, budget/constraint flags, rationale display — this screen matters most.
7. **Knowledge Assistant:** `documents`/`document_chunks` tables, ingestion pipeline (pypdf → chunk → embed), `POST /assistant/ask`, chat UI.
8. **Ask This Itinerary:** itinerary-scoped retrieval, `POST /trips/{id}/ask`, trip-ownership authorization checks, mode-toggle UI.
9. **Dashboard:** `GET /dashboard` aggregation, Dashboard UI.
10. **Polish & stretch (if time remains):** What-If Simulator, security/accessibility pass, tests.
11. **Wrap-up:** README with setup/run instructions, confirm the whole flow works end-to-end from a clean `docker compose up`.

## Definition of Done for This Demo

- `docker compose up` brings up Postgres (with pgvector) + backend; `npm run dev` runs the frontend.
- A user can register, log in, add a traveler, create a trip, run the optimizer, see a real Trade-off Ledger with genuinely different won/lost reasons, edit a line item, approve or reject with a reason, and see it in the audit history.
- The Trip Knowledge Assistant answers a question from an uploaded sample document with a citation, and says "not covered" for something outside the documents.
- Ask This Itinerary answers a question about one specific trip's own data, clearly distinguished from the knowledge-base assistant.
- Every dollar figure the LLM states matches a number already computed in code — verify this holds by testing at least one deliberately awkward trip (tight budget, multiple close-priced options).
