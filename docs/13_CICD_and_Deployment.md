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
