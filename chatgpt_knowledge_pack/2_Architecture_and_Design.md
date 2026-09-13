

<!-- ===== FILE: 05_System_Architecture.md ===== -->

# System Architecture (High-Level Design)

> **Provenance:** Entirely the team's own architecture design. No diagram, component split, or hosting topology is mandated by the brief or PRD — only the 4 stack technologies and LangGraph as framework are official (see `04_TRD.md` §2).

## 1. Overview
A conventional 3-tier architecture with one Postgres instance serving both relational and vector data, and a LangGraph pipeline embedded in the backend rather than run as a separate service.

```
┌─────────────────┐      HTTPS/JSON       ┌──────────────────────┐
│  Next.js Frontend │ ───────────────────▶ │   FastAPI Backend    │
│  (Vercel)          │ ◀─────────────────── │   (Render/Railway)   │
└─────────────────┘                       └──────────┬───────────┘
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                    ┌──────────────────┐   ┌───────────────────┐   ┌──────────────────┐
                    │ LangGraph pipeline │   │ Auth (JWT)         │   │ RAG retrieval     │
                    │ (search → check →  │   │ passlib + jose     │   │ (pgvector query)   │
                    │  compose)          │   └───────────────────┘   └──────────────────┘
                    └─────────┬──────────┘                                     │
                              │                                                │
                              ▼                                                ▼
                    ┌────────────────────────────────────────────────────────────────┐
                    │                PostgreSQL + pgvector (single instance)          │
                    │  travelers · trips · itineraries · decisions · audit_events ·   │
                    │  documents · document_chunks (with embeddings)                  │
                    └────────────────────────────────────────────────────────────────┘
```

## 2. Frontend (Next.js)
- App Router, TypeScript, Tailwind CSS + shadcn/ui components.
- TanStack React Query for all API calls (loading/error/cache state handled uniformly).
- Zod schemas mirror backend Pydantic/SQLModel schemas for consistent validation on both sides.

## 3. Backend (FastAPI)
Key route groups:
- `/auth` — login, token issuance.
- `/travelers`, `/trips` — CRUD.
- `/trips/{id}/optimize` — triggers the LangGraph pipeline, returns itinerary + Trade-off Ledger + budget/constraint result.
- `/trips/{id}/decision` — approve/reject.
- `/documents` — upload knowledge documents (ingested via `pypdf` → chunk → embed).
- `/assistant/ask` — Trip Knowledge Assistant (knowledge-base-grounded).
- `/trips/{id}/ask` — Ask This Itinerary (itinerary-scoped grounding).
- `/dashboard` — spend/turnaround aggregates.
- `/audit` — audit trail retrieval.

Full request/response shapes are in `07_API_Specification.md`.

## 4. LangGraph Pipeline (the core AI component)
A `StateGraph` with three nodes for the MVP:
1. **Search node** — queries mock flight/hotel data for the trip's dates/preferences.
2. **Budget & Constraint Check node** — deterministic Python logic (not the LLM) verifies each candidate against budget/rules.
3. **Compose node** — an LLM call (via `langchain-openai`, structured output) writes the rationale and Trade-off Ledger *using the code-computed numbers as context* — it does not invent totals.

Full node/state design in `08_GenAI_Architecture.md`. The multi-agent stretch goal (splitting this into 4 coordinating agents) is described in `00_Investigation_Report.md` A19 and only attempted after this single pipeline works end-to-end.

## 5. RAG Path
Document upload → `pypdf` text extraction → chunking → OpenAI embeddings → stored in `document_chunks.embedding` (pgvector column) → similarity search on question → top-k chunks passed to the LLM with citation instructions. Detailed in `08_GenAI_Architecture.md`.

## 6. Data Layer
Single PostgreSQL instance (with the `pgvector` extension enabled) handles both relational tables and vector similarity search — deliberately avoiding a second vector database (see ADR-002 in `18_Architecture_Decision_Records.md`). Full schema in `06_Database_Design.md`.

## 7. Deployment Topology
- Frontend on Vercel, auto-deployed from `main`.
- Backend + Postgres on Render or Railway.
- Local dev mirrors production topology via Docker Compose (Postgres + backend containers), so environment drift is minimized.


---


<!-- ===== FILE: 06_Database_Design.md ===== -->

# Database Design

> **Amended 2026-09-09:** `itineraries.co2_estimate_kg` removed — CO2-aware optimization was cut per instructor instruction. See `03_PRD.md` amendment note.

> **Provenance:** Entirely the team's own schema design. PostgreSQL is the only officially mandated database technology (brief field `tech_stack`); the specific tables, columns, and use of `pgvector` are engineering choices, not instructor-specified.

## 1. Engine
PostgreSQL with the `pgvector` extension enabled — one database serves both relational tables and vector similarity search, so no second vector database is needed (see ADR-002).

## 2. Core Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | text, unique | |
| hashed_password | text | via passlib/bcrypt |
| role | enum(`member`, `admin`) | |
| created_at | timestamptz | |

### `travelers`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | text | |
| preferences | jsonb | free-form preference fields |
| created_by | UUID FK → users.id | |

### `trips`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| traveler_id | UUID FK → travelers.id | |
| dates | daterange | |
| budget | numeric | |
| preferences | jsonb | |
| status | enum(`DRAFT`,`OPTIMIZING`,`OPTIMIZED`,`UNDER_REVIEW`,`DECIDED`,`OPTIMIZATION_FAILED`) | mirrors PRD Product States |
| created_by | UUID FK → users.id | |
| created_at | timestamptz | |

### `itineraries`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id | |
| flight_option | jsonb | chosen flight line item |
| stay_option | jsonb | chosen stay line item |
| total_cost | numeric | code-computed, never LLM-generated |
| rationale | text | LLM-generated, references the fields above |
| created_at | timestamptz | |

### `tradeoff_ledger_entries`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| itinerary_id | UUID FK → itineraries.id | |
| alternative | jsonb | one candidate option considered |
| price | numeric | |
| won | boolean | |
| reason | text | specific structured reason, per PRD US-004 |

### `decisions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id | |
| decided_by | UUID FK → users.id | |
| outcome | enum(`APPROVED`,`REJECTED`) | |
| reason | text | required when outcome = REJECTED (PRD US-007) |
| decided_at | timestamptz | |

### `audit_events`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id, nullable | nullable to also cover non-trip events |
| event_type | text | e.g. `PIPELINE_RUN`, `DECISION`, `DOCUMENT_UPLOAD` |
| payload | jsonb | |
| created_at | timestamptz | |

### `documents`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| title | text | |
| uploaded_by | UUID FK → users.id | |
| uploaded_at | timestamptz | |

### `document_chunks`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| document_id | UUID FK → documents.id | |
| chunk_text | text | |
| embedding | vector(1536) | pgvector column, dimension matches the embedding model used |

## 3. Relationships
`users 1—N travelers`, `travelers 1—N trips`, `trips 1—1 itineraries` (MVP: one active itinerary per trip; What-If Simulator previews do not persist a row unless approved), `itineraries 1—N tradeoff_ledger_entries`, `trips 1—N decisions` (append-only decision history), `trips 1—N audit_events`, `documents 1—N document_chunks`.

## 4. Migrations
Every schema change ships as an Alembic migration file — no manual/ad-hoc schema edits, so both team members and any deployment stay in sync (see `04_TRD.md` §2 and `13_CICD_and_Deployment.md`).

## 5. Notes on the `pgvector` Column
The embedding dimension (1536 above) assumes an OpenAI embedding model; if the provider changes, update the column dimension and re-embed existing chunks — tracked as a migration, not a silent schema drift.


---


<!-- ===== FILE: 07_API_Specification.md ===== -->

# API Specification

> **Provenance:** All endpoints below are the team's own design, built to satisfy the PRD's user stories and acceptance criteria (cited inline per endpoint). No specific API shape is mandated by the brief or PRD.

FastAPI auto-generates interactive OpenAPI docs at `/docs` once the backend is running — treat that as the live, authoritative spec. This file is the human-readable summary for planning and review.

## Auth
- `POST /auth/register` — create a user (Member or Admin).
- `POST /auth/login` — returns a JWT.

## Travelers
- `POST /travelers` — create a traveler.
- `GET /travelers` — list travelers.
- `DELETE /travelers/{id}` — delete; rejected (409) if the traveler has existing trips (PRD US-001).

## Trips
- `POST /trips` — create a trip request; status starts `DRAFT` (PRD US-002).
- `GET /trips/{id}` — trip detail including current itinerary and status.
- `GET /trips` — list, filterable by status.
- `POST /trips/{id}/optimize` — runs the LangGraph pipeline; returns the itinerary, Trade-off Ledger, and budget/constraint result (PRD US-003, US-004, US-005). Sets status through `OPTIMIZING → OPTIMIZED` or `OPTIMIZATION_FAILED`.
- `PATCH /trips/{id}/itinerary` — edit a line item; recalculates total cost server-side (PRD US-007).
- `POST /trips/{id}/decision` — body: `{outcome: "APPROVED"|"REJECTED", reason?: string}`; reason required when rejecting. Sets status to `DECIDED`.
- `POST /trips/{id}/preview` *(stretch — What-If Simulator)* — body: one changed input (`budget` or a preference); re-runs the pipeline with `persist:false`, returns a diff against the current itinerary without saving (PRD US-011).

## Knowledge Assistant
*(`POST/GET /documents` are an implementation detail supporting the Trip Knowledge Assistant, not a separately scored feature — see `03_PRD.md` amendment note.)*
- `POST /documents` — upload a document (multipart); triggers `pypdf` extraction, chunking, and embedding.
- `GET /documents` — list uploaded documents.
- `POST /assistant/ask` — body: `{question: string}`; returns a cited answer or an explicit "not covered" response (PRD US-08).
- `POST /trips/{id}/ask` — Ask This Itinerary; body: `{question: string}`; answers grounded in that trip's own itinerary/audit data (PRD US-09).

## Dashboard & Audit
- `GET /dashboard?period=...` — total spend, average savings, average turnaround time for the period (PRD US-010).
- `GET /audit?trip_id=...` — audit event history; independent of dashboard aggregation.

## Response Conventions
- All errors return `{detail: string}` with a standard HTTP status code (401/403 for auth, 404 for missing resources, 409 for conflicting operations like deleting a traveler with trips, 422 for validation errors from Pydantic/SQLModel).
- All monetary figures returned by `/trips/{id}/optimize` are computed in code — the LLM-authored `rationale` field never introduces a number not already present elsewhere in the response (product principle: no unsupported financial claims).


---


<!-- ===== FILE: 08_GenAI_Architecture.md ===== -->

# GenAI Architecture

> **Provenance:** The RAG pattern is grounded in the official brief field `reference_docs` (Lewis et al., arXiv:2005.11401) and its named WikiQA-style evaluation approach. The specific LangGraph node design, guardrail implementation, and prompting details below are the team's own design — LangGraph itself is the only officially mandated framework (brief field `framework`).

## 1. Two Separate AI Surfaces
This project has two distinct GenAI components — don't conflate them:
1. The **LangGraph optimization pipeline** (structured, deterministic-checks-plus-LLM-explanation).
2. The **RAG-grounded Trip Knowledge Assistant** (retrieval + cited generation), including its itinerary-scoped variant, "Ask This Itinerary."

## 2. LangGraph Optimization Pipeline

### State
A `TypedDict` carrying: the trip request (dates/budget/preferences), the candidate flight/stay options found, the budget/constraint check result, and the final composed itinerary.

### Nodes
1. **`search_node`** — pure Python; queries mock flight/hotel data, no LLM call.
2. **`check_node`** — pure Python; deterministically checks each candidate against budget and constraint rules. No LLM call — this keeps the "why it failed budget" reasoning trustworthy and reproducible.
3. **`compose_node`** — the only LLM call in the pipeline. Uses `.with_structured_output()` (via `langchain-openai`) so the model returns a typed object: `{rationale: str, tradeoff_ledger: [{alternative, price, won, reason}]}`. The prompt explicitly passes the code-computed totals and instructs the model never to introduce a different number.

### Why one LLM call, not one per candidate
Keeps latency within the PRD's "a few seconds" target (US-003) and keeps cost predictable — evaluating candidates is cheap deterministic logic; only the final explanation needs the LLM.

### Guardrail
Before returning the response, the backend validates that every dollar figure in `rationale` matches a value already present in the structured response. A mismatch is treated as a pipeline error (`OPTIMIZATION_FAILED`), not silently returned — this directly enforces the PRD's "no unsupported financial claims" principle.

## 3. RAG — Trip Knowledge Assistant

Standard RAG pattern, following Lewis et al. (arXiv:2005.11401):
1. **Ingest:** uploaded document → `pypdf` text extraction → chunk (e.g. ~500-token chunks with overlap) → embed each chunk → store in `document_chunks.embedding` (pgvector).
2. **Retrieve:** on a question, embed the question, run a pgvector similarity search (cosine distance), take top-k chunks.
3. **Generate:** pass the retrieved chunks plus the question to the LLM with an explicit instruction: answer only from the provided chunks, cite the source document/chunk, and say "not covered" if the retrieved chunks don't actually answer the question (PRD US-08 acceptance criteria).

The assistant's evaluation set should be built in the style of the WikiQA dataset (Microsoft Research) — question/answer/supporting-evidence triples — per the project's reference docs, to make citation accuracy measurable (see `14_Evaluation_Metrics.md`).

## 4. Ask This Itinerary (itinerary-scoped RAG)
Same retrieve-then-generate pattern, but the retrieval source is a single trip's own stored data — its itinerary, Trade-off Ledger entries, and audit events — not the general knowledge base. The response must make clear which source it drew from, so it's never confused with a knowledge-base answer (PRD US-09 acceptance criteria).

## 5. Prompting Principles (apply to both surfaces)
- Evidence before explanation — retrieved/computed facts go into the prompt context before the model is asked to explain.
- Structured output over free-form prose wherever a UI needs to render specific fields (Trade-off Ledger entries, citations).
- Explicit "I don't know" instruction — the model is told directly to decline rather than guess when evidence is insufficient.

## 6. Stretch: Multi-Agent Expansion
If pursued (only after the single pipeline works end-to-end — see `00_Investigation_Report.md` A19), the `compose_node` above splits into a `FlightAgent`, `StayAgent`, `BudgetConstraintsAgent`, and `ComposerAgent`, coordinated by an `Orchestrator` node with conditional routing (e.g., looping back to a specialist when a constraint check fails). This is additive to, not a replacement of, the guardrail described in §2.


---


<!-- ===== FILE: 09_Mock_Data_Spec.md ===== -->

# Mock Data Specification

> **Provenance:** Use of mock/sample data (rather than live supplier data) is the team's own inference from the PRD's principles and general student-project constraints — it is not a literal instruction on the brief sheet (see `00_Investigation_Report.md` A5). The specific field schemas and data-volume guidance below are entirely the team's own design.

This file specifies what mock flight/hotel/knowledge data should look like so it's realistic enough to demo the optimizer meaningfully.

## 1. Mock Flights (`data/mock_flights.json`)
*(Amended 2026-09-09: `co2_kg` field removed — CO2-aware optimization was cut per instructor instruction, see `03_PRD.md` amendment note.)*

Each record should carry enough fields for the budget/constraint check to be meaningful:
```json
{
  "id": "FL-1001",
  "origin": "BLR",
  "destination": "DEL",
  "departure_time": "2026-10-12T06:15:00",
  "arrival_time": "2026-10-12T08:45:00",
  "airline": "Sample Air",
  "price": 6200,
  "cabin_class": "economy",
  "stops": 0
}
```
Recommended coverage: multiple price points per route (budget vs. premium), at least one red-eye and one daytime option per route, and a mix of direct/connecting flights — so the Trade-off Ledger has genuinely different reasons to reject options (price, timing, stops), not just one dimension.

## 2. Mock Hotels (`data/mock_hotels.json`)
```json
{
  "id": "HT-2001",
  "city": "DEL",
  "name": "Sample Central Hotel",
  "price_per_night": 3800,
  "rating": 4.2,
  "amenities": ["wifi", "breakfast_included"],
  "distance_to_center_km": 1.5
}
```
Recommended coverage: a spread across budget/mid/premium price tiers per city used in flight data, so budget-constraint rejections have real alternatives to compare against.

## 3. Sample Knowledge Documents
At least one sample document per common travel-policy topic, to give the RAG assistant something meaningful to retrieve from:
- A visa/entry-requirements summary for 1–2 sample destinations.
- A preferred-vendor / travel-policy document (e.g., "flights over ₹X require manager approval").
- A general FAQ (baggage policy, expense submission process).

These should be short (1–3 pages) plain-text or PDF files, ingestable via the `pypdf` pipeline described in `08_GenAI_Architecture.md`.

## 4. Data Volume Guidance
Enough variety to make the optimizer's reasoning non-trivial (at least 3–4 flight options and 3–4 hotel options per route/city used in the demo), but not so much that seeding becomes its own project — this is explicitly a mock dataset, not a production catalog (see Out of Scope in `01_Project_Overview.md`).

## 5. Ownership
Per the team split in `16_Team_Responsibilities.md`, mock data authoring sits with Workstream A (Product, Data & Optimizer) — it should be ready early in Month 1 so the pipeline isn't blocked waiting on data.


---


<!-- ===== FILE: 10_UI_UX_Design.md ===== -->

# UI/UX Design

> **Provenance:** Entirely the team's own UI/UX design, built to satisfy the PRD's acceptance criteria (cited inline). React/Next.js is officially mandated (brief field `tech_stack`); Tailwind CSS is officially suggested (brief field `suggested_libraries_tools`) — shadcn/ui is the team's own addition on top of that suggestion.

## 1. Design Principles (from PRD Product Principles)
- **Evidence before explanation** — show the data (prices, rules) before or alongside the prose rationale, never prose alone.
- **Human-in-the-loop** — every itinerary screen makes Approve/Reject/Edit visibly available; nothing auto-finalizes.
- **Clear uncertainty** — the assistant visibly distinguishes "cited answer" from "not covered by any document."

## 2. Core Screens

### Trip Request Form
Traveler selection (or create new), dates, budget, preferences (free text + structured tags). Submitting creates a `DRAFT` trip.

### Itinerary Result View
*(Amended 2026-09-09: CO2 estimate removed, cut per instructor instruction — see `03_PRD.md` amendment note.)*
- Chosen flight + stay, total cost — shown as data first.
- **Trade-off Ledger panel** — every alternative considered, listed with price and a one-line structured reason (won/lost + why); this is the differentiator UI, not an afterthought accordion.
- Budget/constraint flags — each issue visibly tagged with the specific rule and offending line item (not buried in the rationale paragraph).
- Rationale text — references the specific chosen items and never states a number not already shown above it.
- Approve / Reject (reason required) / Edit line item (recalculates total live).

### Trip Knowledge Assistant (chat panel)
- General mode (knowledge base) and itinerary-scoped mode ("Ask This Itinerary") are visually distinct — e.g. a mode toggle or separate entry points — so a user always knows which source is being queried (PRD US-09 acceptance criteria).
- Every answer shows its citation (document name/chunk) inline, or an explicit "I don't have information on that" state.

### Dashboard (Admin)
Total spend, average savings, average turnaround time for a selected period; a link through to full audit history rather than duplicating it.

### What-If Simulator (stretch)
Side-by-side or diff view: original itinerary vs. the previewed change, with changed fields visually highlighted; an explicit "Save this instead" action, since previews don't persist until approved.

## 3. Component Library
Tailwind CSS + shadcn/ui — pre-built, accessible components (forms, dialogs, tables, tabs) copied into the project and owned directly, rather than built from scratch. Keeps a beginner team from re-solving basic accessibility/interaction problems.

## 4. Accessibility
Baseline WCAG-oriented practices on the dashboard and forms (label associations, keyboard navigation, sufficient contrast) — not a formal audit, but a stated NFR (see `04_TRD.md` §7 and BRD §8).

## 5. Not in Scope for MVP UI
Mobile-native app, offline mode, multi-language UI — none required by the PRD; see Out of Scope in `01_Project_Overview.md`.


---


<!-- ===== FILE: 11_Security_Design.md ===== -->

# Security Design

> **Provenance:** Entirely the team's own security design — no security requirements are specified in the brief or PRD beyond the general product principles (e.g. auditability, no unsupported claims).

## 1. Authentication
Hand-rolled JWT auth using `passlib[bcrypt]` (password hashing) and `python-jose[cryptography]` (JWT issuance/verification). A full auth framework (e.g. `fastapi-users`) is deliberately not used — with only 2 roles, it adds more surface area to learn and debug than it saves (see ADR-003).

## 2. Authorization
Role-based access control with exactly two roles: **Member** and **Admin**.
- Members can create/manage their own trips and travelers, use both assistant modes.
- Admin-only: dashboard aggregates, knowledge-document management.
- Every trip-scoped endpoint (`/trips/{id}/...`) must verify the requesting user has access to that trip — implemented as a FastAPI dependency, not repeated inline per-route.

## 3. Secrets Management
- All secrets (OpenAI API key, DB credentials, JWT signing secret) live in `.env`, loaded via `python-dotenv` locally and via the hosting platform's environment variable settings in deployment.
- `.env.example` documents every required key name with placeholder/empty values — never a real value.
- `.env` is gitignored; verified before every commit (see `13_CICD_and_Deployment.md`).

## 4. Data Handling
- No real employee PII or production payment data is ever handled — synthetic/mock data only (see Out of Scope, `01_Project_Overview.md`). This removes most compliance surface area for a student project.
- Uploaded knowledge documents are assumed non-sensitive sample material for the same reason.

## 5. Input Validation
- Pydantic/SQLModel schemas validate all API input server-side; Zod schemas mirror them client-side for early feedback, but server-side validation is the actual security boundary (client-side is UX only).

## 6. LLM-Specific Risks
- **Prompt injection via uploaded documents:** a malicious document could attempt to instruct the assistant to ignore its citation requirement. Mitigation: system prompt explicitly separates instructions from retrieved content, and retrieved chunks are never treated as instructions.
- **Cost/rationale mismatch (not a security issue but a trust one):** enforced via the guardrail in `08_GenAI_Architecture.md` §2 — any mismatch fails the pipeline rather than returning an inconsistent answer.

## 7. Out of Scope
Penetration testing, formal security certification, production-grade rate limiting/WAF — not required for a student OJT MVP; flagged here so it's a documented decision, not an oversight.


---
