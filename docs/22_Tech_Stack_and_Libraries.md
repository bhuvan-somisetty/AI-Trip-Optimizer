# Tech Stack and Libraries

> **Provenance:** Only 4 rows below are officially mandated (brief field `tech_stack` = React/Next.js, FastAPI, PostgreSQL; brief field `framework` = LangGraph). 2 more are officially *suggested*, not mandated (brief field `suggested_libraries_tools` = React Query, Tailwind CSS). Every other row is the team's own selection to fill gaps the brief leaves open — see the **Source** column.

## Full Stack Table

| Layer | Choice | Source | Why |
|---|---|---|---|
| Frontend framework | Next.js (App Router) + TypeScript | **Official** (`tech_stack`) | App Router is the current standard; TypeScript is the team's addition |
| Styling/UI | Tailwind CSS + shadcn/ui | Tailwind: **Official-suggested**; shadcn/ui: **Team choice** | Tailwind per brief; shadcn/ui adds pre-built accessible components on top |
| Data fetching | TanStack React Query | **Official-suggested** (`suggested_libraries_tools`) | Handles loading/error/caching automatically |
| Frontend validation | Zod | Team choice | Mirrors backend Pydantic/SQLModel schemas |
| Backend framework | FastAPI (Python) | **Official** (`tech_stack`) | Auto-generates OpenAPI docs |
| ORM / models | SQLModel | Team choice | Pydantic + SQLAlchemy combined, less boilerplate |
| Migrations | Alembic | Team choice | Every schema change is a versioned file |
| DB driver | psycopg2-binary | Team choice | Sync driver — matches the synchronous pipeline design (ADR-006) |
| Database | PostgreSQL + `pgvector` | PostgreSQL: **Official** (`tech_stack`); `pgvector`: Team choice | One database for relational + vector search (ADR-001) |
| AI orchestration | LangGraph + `langchain-core` + `langchain-openai` | LangGraph: **Official** (`framework`); the rest: Team choice | Not the full `langchain` meta-package (ADR-007) |
| LLM | OpenAI `gpt-4o-mini` to start | Team choice | Swappable behind one interface later if needed |
| PDF parsing | `pypdf` | Team choice | Pure Python, no OS-level dependency (ADR-008) |
| Auth | `passlib[bcrypt]` + `python-jose[cryptography]` | Team choice | Hand-rolled JWT, sufficient for 2 roles (ADR-003) |
| Testing | `pytest` + `httpx` (backend), component tests (frontend) | Team choice | See `12_Testing_Strategy.md` |
| Frontend hosting | Vercel | Team choice | Free-tier friendly, auto-deploy from `main` |
| Backend + DB hosting | Render or Railway | Team choice | Free-tier friendly, Postgres + pgvector support |
| Local dev | Docker Compose | Team choice | Postgres + backend together, avoids environment drift |

## Frontend — `package.json` dependencies
```
next, react, react-dom, typescript, @types/react, @types/node
tailwindcss, postcss, autoprefixer
@tanstack/react-query
zod
```
Add shadcn/ui via its CLI (`npx shadcn@latest init`) — it copies component source into the project rather than installing as a managed dependency.

## Backend — `requirements.txt`
```
fastapi
uvicorn[standard]        # ASGI server that actually runs the app
sqlmodel
psycopg2-binary
alembic
passlib[bcrypt]
python-jose[cryptography]
langgraph
langchain-core
langchain-openai         # swap for langchain-anthropic / langchain-google-genai if the provider changes
pgvector                 # Python client for the Postgres extension
pypdf
pytest
httpx
python-dotenv
```

## Deliberately Not Installed
- The full `langchain` meta-package (ADR-007).
- Celery/RQ/Redis — no job queue for the MVP (ADR-006).
- A general-purpose auth framework like `fastapi-users` (ADR-003).
- `pdfplumber` / `unstructured` — heavier PDF tools not needed for plain text extraction (ADR-008).

## Before Week 1 — Setup Checklist
- Confirm the current submission schedule with the mentor (see `17_Risk_Register.md` R-004).
- Create a shared GitHub repo (both team members as collaborators).
- Create an OpenAI account and API key; add to `.env` (never commit).
- Both install: Node.js LTS, Python 3.11+, Docker Desktop, a Postgres client.
- Agree on branch strategy (see `13_CICD_and_Deployment.md`).
- Both read `03_PRD.md` and `08_GenAI_Architecture.md` together — each person should be able to explain the product in one paragraph before writing code.
