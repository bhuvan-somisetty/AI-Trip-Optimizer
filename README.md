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
Search real flight fares & hotel rates
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
| 3 | **Flight/Stay Search** | Searches real flight fares (Travelpayouts) and live hotel rates (LiteAPI) for the request |
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

-  **Frontend** — Next.js app shell, auth screens, dashboard, and full navigation are live (API mode prices trips from real providers; generated data only in opt-in demo mode)
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

##  Real Travel Data

The app shows no mock, generated or hardcoded flight or hotel data unless demo mode is
switched on. All provider calls run on the backend (`backend/app/travel_data.py`), so API keys
never reach the browser.

| | Provider | What you get | Free? | Limits and caveats |
|---|---|---|---|---|
| Flights | [Travelpayouts Aviasales Data API](https://support.travelpayouts.com/hc/en-us/articles/203956163) (`/aviasales/v3/prices_for_dates`) | Real fares with airline, flight number, departure time, duration, stops and price in INR | Yes, token on signup, no approval | Fares are **cached**: the cheapest tickets Aviasales users found in the last 48 hours. They are not live bookable offers and the API can't re-check a price, so each fare is labelled "Fare seen in last 48 h" with a "Check live price" link. Some routes and dates have no cached fare (you get "No flights found"). Economy only. |
| Hotels | [LiteAPI](https://docs.liteapi.travel) (`POST /v3.0/hotels/rates`) | Live room rates and availability for the chosen dates, in INR | Rate searches are free; a **production key needs a card on file** | Sandbox keys (`sand_…`) return test data, so they are refused. With no production key the itinerary covers the **flight only** and says that hotel prices are unavailable. |

Ruled out (checked October 2026): Amadeus Self-Service (shut down 17 July 2026), Kiwi Tequila
(partners only since 2024), Aviationstack free plan (flight status only, no fares or future
schedules), OpenSky (aircraft tracking only), Duffel live mode (charges per search when there
are no bookings, card required), Booking.com Demand and Expedia Rapid (signed partner contract
required), Hotelbeds (free key covers the test environment only), and any Google Flights or
Google Hotels scraper.

### Setup

1. **Flights:** sign up at <https://www.travelpayouts.com>, then copy the token from Profile → API token.
2. **Hotels (optional):** sign up at <https://dashboard.liteapi.travel>, add a card under Payment
   Methods, then copy the **production** API key.
3. Put both in `backend/.env` (never commit it):

   ```env
   TRAVELPAYOUTS_TOKEN=...
   LITEAPI_API_KEY=...
   SEARCH_CACHE_MINUTES=30   # identical searches reuse the result for this long
   ```

4. Frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`. Leave
   `NEXT_PUBLIC_DEMO_MODE` unset. Set it to `true` only for an offline demo on generated data;
   when it's off, a backend that can't be reached shows an error instead.

### Behaviour

- Each search times out after 25 seconds. Rate limits (HTTP 429), rejected keys, provider
  outages and unreadable responses each become a clear failure reason on the trip. They never
  fall back to other data.
- A fare without a price, time, airline or stop count is dropped. Any other field the provider
  didn't send (arrival time, rating, baggage, refundability) is left empty and hidden in the UI.
- Only the outbound flight is priced for now; the return flight is still a backend TODO.
- Automated tests (`backend/tests/test_travel_data.py`, `conftest.py`) use canned responses and
  never call the real APIs.

---

<div align="center">

Built by **Bhuvan Somisetty** & **Swetalin Rout**

*A decision-support system, not an autonomous agent: the human always has the final say.*

</div>
