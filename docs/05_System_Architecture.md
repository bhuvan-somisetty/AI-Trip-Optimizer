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
