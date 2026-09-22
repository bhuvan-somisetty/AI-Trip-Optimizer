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
*(Amended 2026-09-16: Weeks 9–10 originally covered the RAG-based Trip Knowledge Assistant and Ask This Itinerary — cut from scope per instructor instruction, "RAG is not needed." See `03_PRD.md` amendment and `17_Risk_Register.md` R-011. That time is now hardening/polish and pulling stretch goals earlier.)*
- **Week 9:** Authorization checks on trip-scoped endpoints, API input/output hardening and testing.
- **Week 10:** Buffer/polish — extra hardening on the optimization pipeline, UI polish, catch-up time.
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
