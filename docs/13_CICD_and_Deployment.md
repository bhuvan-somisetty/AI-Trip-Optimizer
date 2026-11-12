# CI/CD and Deployment

> **Provenance:** Entirely the team's own CI/CD and deployment design — no deployment platform, branching strategy, or pipeline is mandated by the brief or PRD; the brief's `expected_output` field only says "Working app," not how it's deployed.

## 1. Branch Strategy
- `main` stays deployable at all times.
- All work happens on `feature/<name>` branches, merged via pull request — never committed directly to `main`.
- At least one team member reviews the other's PR before merge (2-person team, so this is a lightweight but real check, not a rubber stamp).

## 2. Continuous Integration
`.github/workflows/ci.yml` runs on every pull request and every push to `main`:
1. **Backend tests:** Python 3.11, `pip install -r requirements.txt`, `pytest`. The tests use in-memory SQLite, fixture flights and hotels and no LLM, so CI needs no secrets.
2. **Frontend lint, tests and build:** Node 24, `npm ci`, `npm run lint`, `npm test` (Vitest component and unit tests in jsdom), `npm run build` (the build includes the TypeScript check).
3. A PR shouldn't be merged while either job is red.

## 3. Local Development
Docker Compose brings up:
- A plain PostgreSQL container.
- The FastAPI backend container.
The frontend runs separately via `npm run dev` (Next.js dev server), pointed at the local backend via an env var — this avoids container rebuilds on every frontend change.

## 4. Deployment
*(Amended 2026-11-12 — the original plan was Render or Railway for the backend.)*

| Part | Where | Live URL |
|---|---|---|
| Frontend (Next.js) | Vercel project `ai-trip-optimizer` | https://ai-trip-optimizer.vercel.app |
| Backend (FastAPI) | Vercel project `ai-trip-optimizer-api`, Python runtime, region `sin1` | https://ai-trip-optimizer-api.vercel.app (`/health`, `/docs`) |
| Database | Neon PostgreSQL, connected through the Vercel Neon integration | — |

Deploy from the repo root with the Vercel CLI: `vercel deploy --prod --cwd backend --project ai-trip-optimizer-api` and `vercel deploy --prod --cwd frontend --project ai-trip-optimizer`.

Environment variables live in each Vercel project, never in git (names mirror `.env.example`):
- **API:** `DATABASE_URL` (from Neon), `JWT_SECRET`, `CORS_ORIGINS`, `TRAVELPAYOUTS_TOKEN`, `SERPAPI_API_KEY`, `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` (Gemini's free tier through its OpenAI-compatible endpoint, model `gemini-3.5-flash-lite`), `GOOGLE_CLIENT_ID`.
- **Frontend:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## 5. Database Migrations in Deployment
Vercel's Python runtime has no pre-start hook, so migrations are run by hand **before** deploying a backend that needs them, against the production database:
```
cd backend
vercel env pull .env.prod --environment production --project ai-trip-optimizer-api --yes
DATABASE_URL="$(grep '^DATABASE_URL=' .env.prod | cut -d= -f2- | tr -d '"')" python -m alembic upgrade head
rm -f .env.prod
```
Running it twice is safe: Alembic skips migrations that are already applied. The Docker image (`backend/Dockerfile`) still runs `alembic upgrade head` on start for local and container deploys.

## 6. Submission Deliverables Mapped to This Pipeline
- **GitHub Submission deadline** — the `main` branch at that point in time, with CI green.
- **Deployment Link deadline** — the live Vercel URLs above, working end-to-end.
- **Project Demo Video** — recorded against the deployed instance, not localhost, so it reflects what a grader can actually click through themselves.

