# Team Responsibilities

> **Provenance:** The team of 2 is confirmed via the PRD (two names listed as team members) — the brief sheet itself has no explicit team-size field. The workstream split below is the team's own division of labor, not instructor-assigned.

> **Amended 2026-09-13:** Originally split by *topic* (Product/Data/Optimizer vs. App/RAG/Assistant), so both people touched some frontend and some backend. The team decided to switch to a strict **backend vs. frontend** split instead — Swetalin owns all backend/API/database work, Bhuvan owns all frontend/UI work. This is the team's own decision, not an instructor instruction. Applied across `26_Day_by_Day_Build_Plan.md` and `27_Day_by_Day_Checklist.md`.
>
> **Amended 2026-09-16:** RAG/Trip Knowledge Assistant/Ask This Itinerary work removed from both workstreams below — cut from scope per instructor instruction ("RAG is not needed," see `03_PRD.md` amendment, `17_Risk_Register.md` R-011).

## Workstream A — Backend, Data & AI Pipeline
**Owner: Swetalin**
- FastAPI backend and every API endpoint (auth, travelers, trips, optimize, decision, documents, assistant, dashboard, audit) — see `07_API_Specification.md`.
- Database schema and Alembic migrations.
- Mock flight/hotel data (`09_Mock_Data_Spec.md`).
- The LangGraph optimization pipeline: search node, budget/constraint check node, compose node (LLM call) — see `08_GenAI_Architecture.md`.
- Trade-off Ledger data structure and its guardrail (cost-figure consistency check).
- Dashboard aggregation queries, audit trail writes.

## Workstream B — Frontend / UI
**Owner: Bhuvan**
- Next.js app shell, routing, layout.
- Every screen's UI: auth (login/register), Trip Request Form, Itinerary Result View (Trade-off Ledger panel, budget/constraint flags, rationale display), Dashboard.
- Frontend state/data-fetching (React Query), form validation (Zod), component library setup (shadcn/ui + Tailwind).
- Wiring every screen to Swetalin's API endpoints once they exist.

## Shared / Sync Points
Per the week-by-week plan, each week has a "Sync" item — something both people must agree on together before either builds against it (e.g., the exact `itineraries` JSON shape, before Bhuvan builds a UI against it). Don't let these drift into "figure it out separately and reconcile later."

## Cross-Cutting Ownership
- **Testing:** each person writes tests for the code they own; integration tests covering both sides done together in Week 7–8.
- **Security review, deployment, documentation:** shared, done together in Month 3 rather than assigned to one person, since both need to be able to explain the whole system at viva.

## Viva Readiness
Both team members must be able to explain the full product in one paragraph and walk through either side — vivas are individual, not just "whoever built that part answers." Even with a strict backend/frontend split, Bhuvan should be able to explain what the API does and why, and Swetalin should be able to explain the UI/UX decisions — treat weekly syncs as the mechanism that keeps both people conversant in the whole system, not just their half.
