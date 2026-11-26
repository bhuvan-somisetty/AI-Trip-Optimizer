<div align="center">

# AI Trip Optimizer

### Explainable AI decision support for business travel

A team enters a trip request, by flight, train, bus or all three, to any airport or **any Indian city or town**. A
LangGraph pipeline searches **real flight fares, live hotel prices and real train and bus schedules**, checks
every option against the budget and the traveler's rules, and composes an itinerary with a **Trade-off Ledger**
that says why each alternative won or lost. A human then edits it, tries what-ifs, and approves or rejects it. Nothing is ever booked
automatically, and every step lands in an **append-only audit trail**.

[![Live](https://img.shields.io/badge/live-ai--trip--optimizer.vercel.app-1a5cff?style=for-the-badge&logo=vercel&logoColor=white)](https://ai-trip-optimizer.vercel.app)
[![API docs](https://img.shields.io/badge/API-Swagger_docs-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://ai-trip-optimizer-api.vercel.app/docs)
[![CI](https://img.shields.io/github/actions/workflow/status/bhuvan-somisetty/AI-Trip-Optimizer/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI)](.github/workflows/ci.yml)

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232a?style=flat-square&logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-0f172a?style=flat-square&logo=tailwindcss&logoColor=38bdf8)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-1c3c3c?style=flat-square&logo=langchain&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-8e75b2?style=flat-square&logo=googlegemini&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169e1?style=flat-square&logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00e599?style=flat-square&logo=neon&logoColor=black)
![pytest](https://img.shields.io/badge/pytest-402_passing-0a9edc?style=flat-square&logo=pytest&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-110_passing-729b1b?style=flat-square&logo=vitest&logoColor=white)

**[Open the app](https://ai-trip-optimizer.vercel.app)** · [Why](#-why-ai-trip-optimizer) · [How it works](#-how-it-works) · [Architecture](#-architecture) · [Tech stack](#-tech-stack) · [Run locally](#-run-it-locally) · [Status](#-project-status) · [Docs](docs/)

<br />

<img src="docs/assets/screenshot.png" alt="Dark dashboard: the greeting in a serif display font, the next approved departure from Bengaluru to Hyderabad shown as a boarding pass, and the key numbers for trips, reviews, approved spend and savings" width="100%" />

</div>

<br />

## ✦ Why AI Trip Optimizer

Most "AI travel planners" hand you an answer and ask you to trust it. A business can't work that way: someone
has to approve the spend, and someone will later ask *why this flight and not the cheaper one?*

- **Every number is computed in code.** The LLM only writes the explanation, and a guardrail fails the run if it states a figure that isn't one of the computed ones.
- **Every alternative is accounted for.** The Trade-off Ledger lists each outbound flight, return flight and hotel the pipeline saw, its price, and the specific reason it won or lost.
- **A human always decides.** The optimizer recommends; a reviewer edits, approves, or rejects with a reason.
- **Nothing is forgotten.** Every traveler change, optimizer run, edit and decision is written to an append-only audit trail in the same transaction as the action itself.

## ✦ At a glance

<div align="center">

| **9 / 9** | **37** | **402 + 110** | **11,818** | **4,007** | **15** |
| :---: | :---: | :---: | :---: | :---: | :---: |
| PRD user stories built, stretch included | API endpoints | backend + frontend tests | Indian cities and towns | airports | migrations |

</div>

## ✦ How it works

```mermaid
flowchart LR
    R[Trip request<br/>route · dates · budget · rules] --> S
    subgraph P["LangGraph pipeline"]
        direction LR
        S[search<br/>real fares + hotels] --> C[check<br/>budget + rules, in code]
        C --> K[compose<br/>pick · total · ledger]
        K --> G{guardrail<br/>numbers match?}
    end
    G -- yes --> I[Itinerary + Trade-off Ledger<br/>+ Gemini rationale]
    G -- no --> F[OPTIMIZATION_FAILED<br/>with the reason]
    I --> H[Human review<br/>swap a line item · what-if · approve · reject]
    H --> A[(Audit trail)]
```

| Step | What happens |
| :--- | :--- |
| **1. Request** | A way to travel (Flights, Trains, Buses or Compare all), a traveler, a route between any airport or Indian town (e.g. `BLR → Ayodhya`), dates, budget, rules (stops, cabin, hotel rating, departure time, red-eyes, airlines, nightly rate, amenities) and a priority: lowest cost, balanced, comfort or fastest. The trip starts as `DRAFT` and can be edited until it goes to review. |
| **2. Search** | Flights both ways from **Google Flights via SerpApi**, with **Travelpayouts** cached fares as the fallback, hotel prices from **Google Hotels via SerpApi**, and trains and buses from **Google Maps transit via SerpApi**, with official **Indian Railways fares** per class. A town without an airport flies from its nearest one. If the start date has no fare, the run fails and names the nearest dates that do; if only the return is missing, the trip is built and flagged. |
| **3. Check** | Pure Python: every option is tested against the trip's rules and the **company travel policy**. Each flag names the rule and the exact line item, e.g. *"Total 41,600 is 29,600 over the 12,000 budget"*. |
| **4. Compose** | Among the options meeting every rule, the trip's priority picks the outbound flight, the return flight and the stay (the cheapest, by default), never spending more than the budget allows. The total and the savings (against the median valid option) are computed in code. Every other option gets a ledger row: *"Price: 1,199 more than HT-c5ed804f"*, *"Slower: 5h 00m vs 2h 15m for FL-…"*, *"Different day: departs 2026-12-19, 3 day(s) before the trip starts"*. |
| **5. Explain** | Gemini writes a short rationale from those facts only. Any number in it that isn't a computed figure fails the run; if the LLM is off or errors, a template rationale is used. |
| **6. Review** | The reviewer can swap the outbound flight, return flight or hotel for any other valid option; the total, flags, savings, ledger and rationale are recomputed on the server. Approve sets the trip to `DECIDED`; reject requires a reason. |
| **7. What-if** | Change the budget, cabin, stops or hotel rating and preview the result next to the saved itinerary. The preview reruns the checks on the saved search, so it is instant and saves nothing until "Save this instead". |

**Trip states:** `DRAFT → OPTIMIZING → OPTIMIZED → UNDER_REVIEW → DECIDED`, with `OPTIMIZATION_FAILED` when a run can't produce an itinerary.

<table>
<tr>
<td width="50%" valign="top">

**Trade-off Ledger**: every option, its price and why it lost

<img src="docs/assets/tradeoff-ledger.png" alt="Trade-off Ledger for Bengaluru to Hyderabad: the chosen IndiGo flight at 5,853 marked best balance of price and time, and each other flight with its price and why it lost" width="100%" />

</td>
<td width="50%" valign="top">

**Explore**: famous places, day trips and restaurants, each with a real photo

<img src="docs/assets/explore.png" alt="Explore tab for Hyderabad: Toli Masjid, Char Minar and Gunfoundry cards, each with a Wikimedia Commons photo and its distance from the city centre" width="100%" />

</td>
</tr>
</table>

### The hard parts, solved

| Problem | How it's handled |
| :--- | :--- |
| **LLMs make up numbers** | Totals, budgets and differences are computed in code. The rationale is checked against them, and a mismatch fails the run instead of saving a wrong explanation. |
| **"Why not the cheaper one?"** | The ledger stores a structured reason for every losing option: a broken rule, a different day, or a price difference against the winner. |
| **Edits that break the numbers** | The client only names the option to swap in. The server re-runs the checks, refuses options that break a rule, and recomputes total, flags, ledger and rationale. |
| **Sparse real-world data** | No fare on the start date → the run fails with the nearest dates that have fares. No return fare, no hotel key or no hotels → the run still succeeds, flags it, and totals what it has. |
| **Savings that mean something** | Savings are measured against the median option that met every rule, not the priciest one, so one luxury hotel can't inflate the figure. |
| **"What if" without side effects** | A preview reruns the same checks on the saved search results: no new search, no LLM call, nothing saved. Applying it is one audited action. |
| **A trail you can trust** | Audit events are written in the same database transaction as the action, never edited, and kept even when a re-run replaces the itinerary. |
| **Towns without an airport** | Every Indian city and town (OpenStreetMap) carries its nearest airport, railway station and bus stand with distances. Flights use the nearest airport and say how far it is; trains and buses are searched by the town itself. |
| **Cheaper than direct** | The journeys search (multi-criteria Dijkstra) compares direct trips with routes through other cities, including stopovers the traveler names, and shows the saving and the extra time. |
| **Which way to go?** | Compare all ranks flight, train and bus on fare and time together (each hour of travel counted as a fixed rupee value) and names the recommended one with its reason. |
| **Real data only** | No estimated fares or driving times: a fare is shown only when a provider or the official rail fare table gives it, otherwise "Not available". |
| **Privacy between users** | Every trip and traveler is owner-checked; someone else's ID returns 404, so IDs can't be probed. Admins see everyone's audit events, members only their own. |

## ✦ Features

<table>
<tr>
<td width="33%" valign="top">

### Plan
- Travelers with saved preferences
- Trip requests with route, dates, budget, rules and a priority, editable until review
- Company travel policy, set by admins and applied on every run
- Four ways to travel: Flights, Trains, Buses or Compare all, with a recommended pick
- Any Indian city or town as a trip end, searched by the way of travel, with its nearest airport, station and bus stand
- Real fares and live hotel prices, with layovers, price level and optional flexible dates
- Cheaper routes through other cities, including your own stopovers
- Official Indian Railways fares for every class, and a festival rush notice
- Explore: famous places, day trips, famous stays, restaurants and local dishes with photos
- Shortest road routes from the hotel to attractions (Dijkstra on OpenStreetMap roads)
- Sign in with Google, or email and password, on an animated split-card page

</td>
<td width="33%" valign="top">

### Decide
- Round-trip itinerary with total, savings, headroom and flags
- Trade-off Ledger for outbound, return and stay
- Swap any valid line item, totals recalculate
- What-if simulator, side by side
- Approve, or reject with a stored reason

</td>
<td width="33%" valign="top">

### Track
- Append-only audit trail with filters and CSV export
- Analytics: spend, average savings, turnaround and approval rate per period
- `GET /dashboard` for the same figures by year, quarter or month
- Trip status timeline
- Dark, editorial dashboard: next departure as a boarding pass, key numbers with trends
- Optional in-browser demo mode

</td>
</tr>
</table>

## ✦ Tech stack

<img src="docs/assets/tech-stack.svg" alt="AI Trip Optimizer tech stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, React Query, FastAPI, SQLModel and Alembic, Pydantic, JWT, Google sign-in, Python 3.11, LangGraph, Gemini, a numbers guardrail, PostgreSQL 16, Neon, Docker, pytest, Vitest, ESLint, Vercel and GitHub Actions" width="100%" />

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack React Query, Zod, `@react-oauth/google` |
| **API** | FastAPI, SQLModel, Alembic, Pydantic, `python-jose` JWT + `passlib` bcrypt, `google-auth` |
| **AI** | LangGraph (`search → check → compose`), `langchain-openai` against Gemini's OpenAI-compatible endpoint (`gemini-3.5-flash-lite`) |
| **Data** | PostgreSQL 16 (Neon in production), Google Flights, Google Hotels and Google Maps transit via SerpApi, Travelpayouts fares as the flight fallback, OurAirports and OpenStreetMap (bundled), Indian Railways fare tables, Wikidata and OpenTripMap |
| **Quality** | pytest (402 tests, no network or keys needed), Vitest + Testing Library (110 component and unit tests), ESLint, TypeScript, GitHub Actions on every pull request |
| **Delivery** | Frontend and API as two Vercel projects (API in `sin1`), Neon Postgres, Docker Compose for local dev |

## ✦ Architecture

```mermaid
flowchart LR
    U[Reviewers · admins] --> FE[Next.js 16 app<br/>Vercel]
    FE -- "REST · JWT" --> API
    FE -. "ID token" .-> GI[Google Identity]
    subgraph API["FastAPI · Vercel Python runtime"]
        direction TB
        AU[auth · travelers · trips · what-if · settings · dashboard · audit] --> PL[LangGraph pipeline<br/>search · check · compose]
    end
    API --> PG[(PostgreSQL · Neon<br/>8 tables)]
    PL --> SA[SerpApi<br/>Google Flights + Hotels]
    PL --> TP[Travelpayouts<br/>fallback flight fares]
    API --> GT[SerpApi<br/>Google Maps transit]
    API --> DS[Bundled data<br/>OurAirports · OpenStreetMap · rail fares]
    PL --> GM[Gemini<br/>rationale only]
    GH[GitHub Actions] -- "pytest · vitest · lint · build" --> API
```

### API

| Area | Endpoints |
| :--- | :--- |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/google` |
| Travelers | `POST /traveler` · `GET /travelers` · `PUT /traveler/{id}` · `DELETE /traveler/{id}` |
| Trips | `POST /trip` · `GET /trips` · `GET /trips/{id}` · `PATCH /trips/{id}` |
| Optimizer | `POST /trips/{id}/optimize` · `GET /trips/{id}/itinerary` · `PATCH /trips/{id}/itinerary` |
| What-if | `POST /trips/{id}/preview` · `POST /trips/{id}/preview/apply` |
| Review | `POST /trips/{id}/review` · `POST /trips/{id}/decision` · `GET /trips/{id}/decision` |
| Settings | `GET /me` · `PATCH /me` · `GET /policy` · `PUT /policy` (admins) |
| Places | `GET /airports` · `GET /airports/{code}` · `GET /locations` (`mode`: `flight`, `train`, `bus`, `all`) · `GET /locations/{code}` |
| Transport & routes | `GET /trips/{id}/transport` (trains, buses, ferries and the recommended way) · `GET /journeys` · `GET /trips/{id}/journeys` (cheaper routes through other cities) |
| Discover | `GET /destinations/{code}` · `GET /places/nearby` |
| Explore & route | `GET /trips/{id}/explore` (places, restaurants, dishes) · `GET /trips/{id}/route` (`stops`: 1 to 10) |
| Dashboard & audit | `GET /dashboard` (`period`: `2026`, `2026-Q4`, `2026-11`) · `GET /audit` (filters: `trip_id`, `event_type`, `limit`) |

Full request and response examples: [`docs/07_API_Specification.md`](docs/07_API_Specification.md) · live Swagger: [ai-trip-optimizer-api.vercel.app/docs](https://ai-trip-optimizer-api.vercel.app/docs)

## ✦ Run it locally

**Prerequisites:** Python 3.11+, Node.js 24, Docker Desktop (optional).

```bash
git clone https://github.com/bhuvan-somisetty/AI-Trip-Optimizer.git
cd AI-Trip-Optimizer
cp .env.example .env          # set JWT_SECRET; the other keys are optional
docker compose up -d          # PostgreSQL 16 + the API (runs migrations on start)
```

```bash
cd frontend
npm install
npm run dev                   # app → http://localhost:3000, API → http://localhost:8000/docs
```

Every key except `JWT_SECRET` and `DATABASE_URL` switches on one feature and can be left empty:

| Key | Turns on |
| :--- | :--- |
| `SERPAPI_API_KEY` | live flights (Google Flights) and hotel prices (free: 250 searches a month; one trip uses about 3) |
| `OPENTRIPMAP_API_KEY` | tourist attractions and restaurants on the Explore tab (free: 5,000 requests a day, non-commercial) |
| `TRAVELPAYOUTS_TOKEN` | cached flight fares, used when Google Flights is off or finds nothing |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | LLM rationale (Gemini or any OpenAI-compatible model); otherwise a template |
| `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Sign in with Google |
| `NEXT_PUBLIC_DEMO_MODE=true` | a "Try the demo" sign-in that runs in the browser on generated fares |

| Command | What it does |
| :--- | :--- |
| `cd backend && python -m pytest -q` | 402 backend tests on in-memory SQLite, with fixture fares and no LLM |
| `cd frontend && npm run lint && npm test && npm run build` | the frontend checks CI runs (Vitest in jsdom, no backend needed) |
| `cd backend && alembic upgrade head` | apply migrations when running the API outside Docker |

The full guide is in [`docs/23_Setup_Guide.md`](docs/23_Setup_Guide.md), and deployment in [`docs/13_CICD_and_Deployment.md`](docs/13_CICD_and_Deployment.md).

## ✦ Project structure

```text
AI-Trip-Optimizer/
├── backend/                  # FastAPI API
│   ├── app/
│   │   ├── pipeline/         # LangGraph graph: search, check, compose, guardrail, edits
│   │   ├── routers/          # auth, travelers, trips (+ what-if), settings, dashboard, audit
│   │   ├── travel_data.py    # SerpApi (Google Flights, Hotels) and Travelpayouts clients; airports and Indian places
│   │   ├── ground.py         # trains, buses and ferries from Google Maps transit, with official rail fares
│   │   ├── journeys.py       # cheaper multi-city routes (multi-criteria Dijkstra)
│   │   ├── data/             # airports, Indian places, rail fares and distances
│   │   ├── audit.py          # writes audit events in the caller's transaction
│   │   └── models.py         # 8 SQLModel tables
│   ├── alembic/versions/     # 15 migrations
│   ├── scripts/              # builds the airport and Indian place data
│   └── tests/                # 402 tests, fixture fares in tests/fixtures
├── frontend/                 # Next.js 16 app
│   └── src/
│       ├── app/              # dashboard, planning, trips, analytics, audit, travelers, settings
│       ├── components/
│       └── lib/              # API client, mappers, store (tests sit next to the code as *.test.tsx)
├── docs/                     # 25 planning, design and evaluation documents
├── scripts/brand/            # tech-stack image generator
├── .github/workflows/ci.yml  # tests, lint and build on every PR
└── docker-compose.yml
```

## ✦ Documentation

| Doc | What's inside |
| :--- | :--- |
| [Project overview](docs/01_Project_Overview.md) · [BRD](docs/02_BRD.md) · [PRD](docs/03_PRD.md) | Problem, scope, user stories and their amendments |
| [TRD](docs/04_TRD.md) · [System architecture](docs/05_System_Architecture.md) · [Database design](docs/06_Database_Design.md) | How it's built, the schema and every migration |
| [API specification](docs/07_API_Specification.md) · [GenAI architecture](docs/08_GenAI_Architecture.md) | Every endpoint with real examples; the pipeline and its guardrail |
| [Security](docs/11_Security_Design.md) · [Testing](docs/12_Testing_Strategy.md) · [CI/CD and deployment](docs/13_CICD_and_Deployment.md) | Auth, ownership checks, secrets; what the tests cover; how it ships |
| [Evaluation metrics](docs/14_Evaluation_Metrics.md) · [Usability check](docs/25_Usability_Check.md) | Accuracy and UX targets with a measured self-assessment; the user-test script and SUS form |
| [Roadmap](docs/15_Roadmap.md) · [Risk register](docs/17_Risk_Register.md) · [ADRs](docs/18_Architecture_Decision_Records.md) | Plan vs. delivery, open risks, why each big choice was made |
| [**Project status**](docs/24_Project_Status.md) | Every PRD item with its evidence, and what's left |

## ✦ Project status

- [x] Traveler management (US-001)
- [x] Trip requests that start as `DRAFT` (US-002)
- [x] Optimized itinerary from real fares, in seconds (US-003)
- [x] Trade-off Ledger with a structured reason for every option (US-004)
- [x] Budget and constraint flags naming the rule and the line item (US-005)
- [x] LLM rationale behind a numbers guardrail (US-006)
- [x] Edit a line item, approve, or reject with a reason (US-007)
- [x] Append-only audit trail (US-010)
- [x] Dashboard: spend, average savings and turnaround per period (US-010)
- [x] Round-trip totals: outbound, return and stay
- [x] What-If Simulator (US-011, stretch)
- [x] Trains, buses and Compare all, with a recommended way to travel
- [x] Any Indian city or town as a trip end, with its nearest airport, station and bus stand
- [x] Cheaper routes through other cities, and official Indian Railways fares
- [x] Dark editorial dashboard and an animated sign-in page
- [x] Deployed on Vercel + Neon, CI with backend and frontend tests on every pull request
- [ ] Demo video (due Nov 25)
- [ ] Usability sessions with 2–3 outside users (kit ready in `docs/25_Usability_Check.md`)

Details and evidence: [`docs/24_Project_Status.md`](docs/24_Project_Status.md).

## ✦ Team

| | Role |
| :--- | :--- |
| **Swetalin Rout** · [@swetalin-10](https://github.com/swetalin-10) | Backend, data and AI pipeline: FastAPI, schema and migrations, real fares, LangGraph pipeline, Trade-off Ledger, guardrail, decisions, audit trail |
| **Bhuvan Somisetty** · [@bhuvan-somisetty](https://github.com/bhuvan-somisetty) | Frontend and delivery: every screen and its API wiring, analytics, Sign in with Google, line-item editing, Vercel + Neon deployment, CI, docs |

<div align="center">

*A decision-support system, not an autonomous agent: the human always has the final say.*

</div>
