# Local Setup Guide

> **Provenance:** Entirely the team's own setup instructions, following from the stack choices explained in `22_Tech_Stack_and_Libraries.md`.

## Prerequisites
- Node.js LTS
- Python 3.11+
- Docker Desktop
- A Postgres client (e.g. TablePlus, or the `psql` CLI) — optional, for inspecting the DB directly

## 1. Clone and Environment
```
git clone https://github.com/bhuvan-somisetty/AI-Trip-Optimizer.git
cd AI-Trip-Optimizer
cp .env.example .env
# then fill in real values in .env — OpenAI API key, JWT secret, DB URL — never commit this file
```

## 2. Start Postgres + Backend via Docker Compose
```
docker compose up -d
```
This should bring up a PostgreSQL container (with the `pgvector` extension enabled) and the FastAPI backend container, per `05_System_Architecture.md`.

## 3. Run Database Migrations
```
cd backend
alembic upgrade head
```

## 4. Backend (if running outside Docker for active development)
```
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API docs available at `http://localhost:8000/docs` once running (see `07_API_Specification.md`).

## 5. Frontend
```
cd frontend
npm install
npm run dev
```
Runs at `http://localhost:3000`, pointed at the local backend via an environment variable (e.g. `NEXT_PUBLIC_API_URL=http://localhost:8000`).

## 6. Seed Mock Data
Run the seed script (once written, per `09_Mock_Data_Spec.md`) to load `data/mock_flights.json` and `data/mock_hotels.json` into the local database.

## 7. Run Tests
```
cd backend
pytest
```

## 8. Common Issues
- **`pgvector` extension not found:** ensure the Postgres image used in Docker Compose includes the extension (e.g. `pgvector/pgvector` image), or run `CREATE EXTENSION IF NOT EXISTS vector;` manually after first start.
- **Migrations out of sync:** always run `alembic upgrade head` after pulling changes that touch `backend/alembic/versions/`.
