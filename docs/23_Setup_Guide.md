# Local Setup Guide

> **Provenance:** Entirely the team's own setup instructions, following from the stack choices explained in `22_Tech_Stack_and_Libraries.md`.

> **Amended 2026-11-12:** rewritten to match the built project: the Docker image runs migrations itself, there is no seed script (the optimizer reads real fares, and the tests use fixture fares), and the optional keys for real fares, Gemini and Google sign-in are listed. Deploying is in `13_CICD_and_Deployment.md`.

## Prerequisites
- Node.js 24 (LTS)
- Python 3.11+
- Docker Desktop (optional: only for running Postgres and the API in containers)

## 1. Clone and Environment
```
git clone https://github.com/bhuvan-somisetty/AI-Trip-Optimizer.git
cd AI-Trip-Optimizer
cp .env.example .env
```
Fill in `.env` (never commit it). Only `DATABASE_URL` and `JWT_SECRET` are required; every other key turns on one feature and the app works without it:

| Key | Without it | Where to get it |
|---|---|---|
| `JWT_SECRET` | required | any long random string |
| `DATABASE_URL` | required | the Docker Compose default works as is |
| `TRAVELPAYOUTS_TOKEN` | no flight fares, so optimizing fails with a clear reason | free: travelpayouts.com → Profile → API token |
| `SERPAPI_API_KEY` | hotel prices show as unavailable; the total covers the flight only | free (250 searches a month): serpapi.com → API key |
| `OPENAI_API_KEY` (+ `OPENAI_BASE_URL`, `OPENAI_MODEL`) | the rationale uses the built-in template instead of an LLM | any OpenAI-compatible key; for Gemini see the comment in `.env.example` |
| `GOOGLE_CLIENT_ID` | the Sign in with Google button is hidden | Google Cloud → Google Auth Platform → Clients (Web client ID; no secret needed) |

## 2. Start Postgres + Backend via Docker Compose
```
docker compose up -d
```
This brings up PostgreSQL 16 and the FastAPI backend. The backend container runs `alembic upgrade head` before it starts, so the tables are created automatically. API docs: `http://localhost:8000/docs`.

## 3. Backend outside Docker (for active development)
```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head            # needs DATABASE_URL pointing at a running Postgres
uvicorn app.main:app --reload
```
Always run `alembic upgrade head` after pulling changes that touch `backend/alembic/versions/`.

## 4. Frontend
```
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:3000`. Settings go in `frontend/.env.local`:

| Key | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | the backend, default `http://localhost:8000` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | same value as the backend's `GOOGLE_CLIENT_ID`; empty hides the Google button |
| `NEXT_PUBLIC_DEMO_MODE` | `true` adds a "Try the demo" sign-in that runs entirely in the browser on generated fares, with no backend. Leave it off for real use. |

## 5. Run Tests
```
cd backend
python -m pytest -q             # 153 tests, no network or keys needed

cd frontend
npm run lint
npm run build
```
CI runs the same three checks on every pull request (`.github/workflows/ci.yml`).

## 6. Common Issues
- **Migrations out of sync:** run `alembic upgrade head` again; check with `alembic current`.
- **"No flights found ... on <date>":** the fare feed only has cached fares for some dates. The error names the nearest dates that do have fares; try one of those.
- **CORS errors in the browser:** add the frontend's origin to `CORS_ORIGINS` in the backend's `.env`.
- **Google button doesn't show:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is read at build time; restart `npm run dev` after setting it, and add the origin (e.g. `http://localhost:3000`) under Authorized JavaScript origins in Google Cloud.
