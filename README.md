<div align="center">

# ✈️ AI Trip Optimizer

**An enterprise-grade, explainable AI decision-support system for business travel planning.**

*Every itinerary comes with a reason. Every AI decision waits for a human to approve it.*

</div>

---

## 🌍 What This Is

AI Trip Optimizer is a **B2B decision-support workspace** — a tool a company uses to plan and optimize trips for its own employees. It's not a booking site, and it's not an autonomous agent that books flights on its own.

Here's the flow, end to end:

```
Trip request created
        │
        ▼
Search mock flight & hotel data
        │
        ▼
Budget & constraint check          ──▶  flags exactly which rule, which line item
        │
        ▼
Itinerary composed (LLM + LangGraph)
        │
        ▼
Trade-off Ledger generated         ──▶  every option considered, price, why it won/lost
        │
        ▼
Human reviews → edits → approves or rejects (with a reason)
        │
        ▼
Decision + full audit trail stored
```

Separately, a **Trip Knowledge Assistant** answers travel-policy questions — grounded in documents the business uploads, with citations, and an honest "not covered" answer when it doesn't know.

### Why it's built this way
The core design principle is **explainability over automation**. The system never finalizes a booking or a decision by itself — a human always has the final word. Every number the AI shows can be traced back to a specific rule, a specific alternative, or a specific source document. That's the whole point: an AI system a business can actually trust and audit, not a black box.

---

## 🧠 Core Features (MVP)

| # | Feature | What it does |
|---|---|---|
| 1 | **Traveler Management** | Add/select the travelers going on a trip |
| 2 | **Trip Request Creation** | Capture dates, budget, and preferences — starts as `DRAFT` |
| 3 | **Flight/Stay Search** | Searches mock flight & hotel data against the request |
| 4 | **Budget & Constraint Check** | Flags issues by naming the exact rule and offending line item |
| 5 | **Itinerary Composition** | Flights + stay + total cost, composed via the LangGraph pipeline |
| 6 | **Trade-off Ledger** | Every alternative considered, its price, and why it won or lost — full transparency |
| 7 | **Review / Edit / Approve** | Editing recalculates cost live; rejecting requires a stored reason |
| 8 | **Trip Knowledge Assistant** | Cited, RAG-grounded Q&A over uploaded documents |
| 9 | **Audit Trail** | Every pipeline run and every decision, logged |

**Stretch goals (should-have):** *Ask This Itinerary* (chat grounded in one specific itinerary), an Ops Dashboard (spend, savings, turnaround time).

**Explicitly out of scope:** autonomous booking/payment, live GDS/supplier APIs, real employee PII, streaming responses, multi-agent pipelines. This is a decision-support tool — on purpose.

---

## 👥 Who's Building What

This project runs on a **strict backend/frontend split** — one person owns each side end to end, not a mixed division by topic.

<table>
<tr>
<th width="50%">🎨 Frontend — Bhuvan Somisetty</th>
<th width="50%">⚙️ Backend — Swetalin Rout</th>
</tr>
<tr valign="top">
<td>

- Next.js app shell, routing, layout
- Every screen's UI:
  - Auth (login/register)
  - Trip Request Form
  - Itinerary Result View (Trade-off Ledger panel, budget/constraint flags, rationale)
  - Trip Knowledge Assistant + Ask This Itinerary chat panel
  - Ops Dashboard
- State/data-fetching (React Query), validation (Zod)
- Component library setup (shadcn/ui + Tailwind CSS)
- Wiring every screen to the live API once endpoints exist

</td>
<td>

- FastAPI backend — every API endpoint (auth, travelers, trips, optimize, decision, documents, assistant, dashboard, audit)
- Database schema design + Alembic migrations
- Mock flight/hotel data generation
- The LangGraph optimization pipeline (search → check → compose)
- Trade-off Ledger data structure + cost-consistency guardrail
- Document ingestion (`pypdf` → chunk → embed) and RAG retrieval/generation
- Dashboard aggregation queries, audit trail writes

</td>
</tr>
</table>

**Shared, done together:** weekly sync points (agreeing on data shapes before either side builds against them), integration testing, security review, deployment, and documentation — because both of us need to be able to explain the *entire* system, not just our own half.

---

## 🏗️ Tech Stack

<table>
<tr>
<td valign="top" width="50%">

### Frontend
- **Next.js** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **TanStack React Query** — data fetching/caching
- **Zod** — schema validation
- Hosted on **Vercel**

</td>
<td valign="top" width="50%">

### Backend
- **FastAPI** (Python)
- **SQLModel** + **Alembic** migrations
- **PostgreSQL** + **pgvector** (relational + vector search, one database)
- **LangGraph** + `langchain-core` — AI orchestration
- **OpenAI** (`gpt-4o-mini`) — swappable behind one interface
- **passlib** + **python-jose** — auth (hand-rolled JWT)
- **pypdf** — document ingestion
- Hosted on **Render/Railway**

</td>
</tr>
</table>

**Local dev:** Docker Compose (Postgres + backend together, zero environment drift).
**Testing:** `pytest` + `httpx` on the backend, component tests on the frontend.

Full rationale for every choice — including what we deliberately *didn't* install — lives in [`docs/22_Tech_Stack_and_Libraries.md`](docs/22_Tech_Stack_and_Libraries.md).

---

## 📚 Documentation

This project is documented like a real product, not just a class assignment. The `docs/` folder has 28 files covering everything from the business requirements to individual architecture decisions. Start here:

| Doc | Covers |
|---|---|
| [`01_Project_Overview.md`](docs/01_Project_Overview.md) | The elevator pitch, MVP scope, what's out of scope |
| [`03_PRD.md`](docs/03_PRD.md) | Product requirements, user stories |
| [`05_System_Architecture.md`](docs/05_System_Architecture.md) | How the pieces fit together |
| [`06_Database_Design.md`](docs/06_Database_Design.md) | Schema |
| [`07_API_Specification.md`](docs/07_API_Specification.md) | Every endpoint |
| [`08_GenAI_Architecture.md`](docs/08_GenAI_Architecture.md) | The LangGraph pipeline in detail |
| [`10_UI_UX_Design.md`](docs/10_UI_UX_Design.md) | What every screen must contain |
| [`16_Team_Responsibilities.md`](docs/16_Team_Responsibilities.md) | The full ownership breakdown |
| [`23_Setup_Guide.md`](docs/23_Setup_Guide.md) | Local environment setup |
| [`26_Day_by_Day_Build_Plan.md`](docs/26_Day_by_Day_Build_Plan.md) | The 12-week execution plan |
| [`27_Day_by_Day_Checklist.md`](docs/27_Day_by_Day_Checklist.md) | The same plan as a flat checklist |

---

## 🚀 Getting Started

```bash
# clone
git clone https://github.com/bhuvan-somisetty/AI-Trip-Optimizer.git
cd AI-Trip-Optimizer

# frontend
cd frontend && npm install && npm run dev

# backend + database (from project root)
docker compose up -d
```

Full setup steps (env vars, migrations, seeding mock data): [`docs/23_Setup_Guide.md`](docs/23_Setup_Guide.md).

---

<div align="center">

Built by **Bhuvan Somisetty** & **Swetalin Rout**

*A decision-support system, not an autonomous agent — the human always has the final say.*

</div>
