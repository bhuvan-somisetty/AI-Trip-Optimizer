<div align="center">

#  AI Trip Optimizer

**An enterprise-grade, explainable AI decision-support system for business travel planning.**

*Every itinerary comes with a reason. Every AI decision waits for a human to approve it.*

</div>

---

##  What This Is

AI Trip Optimizer is a **B2B decision-support workspace**: a tool a company uses to plan and optimize trips for its own employees. It's not a booking site, and it's not an autonomous agent that books flights on its own.

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

Separately, a **Trip Knowledge Assistant** answers travel-policy questions, grounded in documents the business uploads, with citations, and an honest "not covered" answer when it doesn't know.

### Why it's built this way
The core design principle is **explainability over automation**. The system never finalizes a booking or a decision by itself; a human always has the final word. Every number the AI shows can be traced back to a specific rule, a specific alternative, or a specific source document. That's the whole point: an AI system a business can actually trust and audit, not a black box.

---

##  Core Features (MVP)

| # | Feature | What it does |
|---|---|---|
| 1 | **Traveler Management** | Add/select the travelers going on a trip |
| 2 | **Trip Request Creation** | Capture dates, budget, and preferences; starts as `DRAFT` |
| 3 | **Flight/Stay Search** | Searches mock flight & hotel data against the request |
| 4 | **Budget & Constraint Check** | Flags issues by naming the exact rule and offending line item |
| 5 | **Itinerary Composition** | Flights + stay + total cost, composed via the LangGraph pipeline |
| 6 | **Trade-off Ledger** | Every alternative considered, its price, and why it won or lost: full transparency |
| 7 | **Review / Edit / Approve** | Editing recalculates cost live; rejecting requires a stored reason |
| 8 | **Trip Knowledge Assistant** | Cited, RAG-grounded Q&A over uploaded documents |
| 9 | **Audit Trail** | Every pipeline run and every decision, logged |

**Stretch goals (should-have):** *Ask This Itinerary* (chat grounded in one specific itinerary), an Ops Dashboard (spend, savings, turnaround time).

**Explicitly out of scope:** autonomous booking/payment, live GDS/supplier APIs, real employee PII, streaming responses, multi-agent pipelines. This is a decision-support tool, on purpose.

---

##  Tech Stack

<table>
<tr>
<td valign="top" width="50%">

### Frontend
- **Next.js** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **TanStack React Query**: data fetching/caching
- **Zod**: schema validation
- Hosted on **Vercel**

</td>
<td valign="top" width="50%">

### Backend
- **FastAPI** (Python)
- **SQLModel** + **Alembic** migrations
- **PostgreSQL** + **pgvector** (relational + vector search, one database)
- **LangGraph** + `langchain-core`: AI orchestration
- **OpenAI** (`gpt-4o-mini`): swappable behind one interface
- **passlib** + **python-jose**: auth (hand-rolled JWT)
- **pypdf**: document ingestion
- Hosted on **Render/Railway**

</td>
</tr>
</table>

**Local dev:** Docker Compose (Postgres + backend together, zero environment drift).
**Testing:** `pytest` + `httpx` on the backend, component tests on the frontend.

---

##  Current Status

We're in **Month 1 — Setup**, per our 12-week plan 

-  **Frontend** — Next.js app shell, auth screens, dashboard, and full navigation are live (currently running on mock data)
-  **Backend** — FastAPI + database setup in progress
-  **AI pipeline** (LangGraph optimizer, RAG assistant) — starts Month 2, once the backend foundation is in place

---

##  Getting Started

```bash
# clone
git clone https://github.com/bhuvan-somisetty/AI-Trip-Optimizer.git
cd AI-Trip-Optimizer

# frontend
cd frontend && npm install && npm run dev
```

---

<div align="center">

Built by **Bhuvan Somisetty** & **Swetalin Rout**

*A decision-support system, not an autonomous agent: the human always has the final say.*

</div>
