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
