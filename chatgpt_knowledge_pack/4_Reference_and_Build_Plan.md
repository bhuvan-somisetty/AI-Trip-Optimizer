

<!-- ===== FILE: 19_Competitor_Analysis.md ===== -->

# Competitor Analysis

> **Provenance:** This entire analysis is the team's own market research. It is not provided, named, or requested anywhere in the official brief or PRD — included because it strengthens the differentiation rationale in `20_Differentiators.md`, not because it was assigned. Every website link below was **live-verified by fetching it on 2026-09-08** — status noted per entry. Feature lists are drawn from each company's own live website content at that time, not assumed.
>
> **Amended 2026-09-09:** CO2-aware optimization was removed as one of our own features (cut per instructor instruction — see `03_PRD.md` amendment note). Entries below that originally compared competitors' carbon-tracking features against our own CO2 feature have been reframed around other genuine gaps instead — we no longer compete on that axis.

Expands the summary in `00_Investigation_Report.md` A7. This project sits in the **corporate/business travel management** category — tools a company uses to plan and manage trips for its own employees, distinct from consumer trip planners (Expedia, Google Flights, etc.), which are out of scope for comparison since they don't serve the same B2B buyer.

## SAP Concur
**Website:** https://www.concur.com — ✅ live-verified

- **What it is:** The enterprise incumbent, combining travel booking with expense management and policy compliance.
- **Known features:** Integrated travel booking + expense management; automated policy-compliance engine that flags out-of-policy bookings; TripIt itinerary integration; mobile app for receipt capture and itinerary viewing; multi-level approval workflows; corporate card integration; reporting/analytics dashboards for finance teams.
- **Strength:** Deep enterprise integrations, mature policy-enforcement rules, wide adoption.
- **Gap:** Enforces policy as a pass/fail gate rather than explaining trade-offs — a user sees "this is out of policy," not a structured breakdown of what was considered and why each alternative lost.
- **Why a user would pick AI Trip Optimizer instead:** Every option considered is shown with its price and the specific reason it won or lost (Trade-off Ledger) — the user sees the reasoning, not just a verdict.

## Navan (formerly TripActions)
**Website:** https://navan.com — ✅ live-verified

- **What it is:** A modern travel + expense platform with an AI "concierge" for booking assistance.
- **Known features:** Fast self-serve booking flow; AI concierge ("Ava") for conversational trip search and booking help; real-time policy enforcement during booking; virtual and physical corporate cards; expense management; analytics dashboard; mobile app.
- **Strength:** Strong UI/UX, fast booking flow, AI-assisted search. **Notable:** the Indian corporate travel startup Tripeur has been folded into Navan — `tripeur.com` now redirects straight to `navan.com` (live-verified) — a sign of ongoing consolidation in this market.
- **Gap:** The AI concierge is conversational/booking-oriented, not a structured, auditable trade-off ledger — no persistent record of "here are all the options considered and the specific reason each was rejected."
- **Why a user would pick AI Trip Optimizer instead:** Ask This Itinerary gives a grounded, cited answer about one *specific already-generated recommendation*, backed by a persistent audit trail — not a one-off chat reply that disappears from the decision record.

## Perk (formerly TravelPerk)
**Website:** https://www.perk.com — ✅ live-verified (`travelperk.com` now 301-redirects here; live site confirms same positioning — "the intelligent platform for travel and spend" — same company, rebranded)

- **What it is:** Corporate travel booking + spend management, historically known for SME focus and flexible cancellation ("FlexiPay").
- **Known features:** Flight/hotel/train booking; travel policy setup and approval workflows; 24/7 customer support; corporate event organization; positions itself as an "intelligent platform" (AI-powered per current site).
- **Strength:** Fast to adopt for smaller teams, strong customer support reputation, actively expanding scope (per the rebrand and mention of an "AmTrav" integration on its current site).
- **Gap:** No mention of a structured, per-alternative trade-off breakdown shown at decision time — the platform surfaces booking options and policy rules, not a reasoned comparison of why one option beat another.
- **Why a user would pick AI Trip Optimizer instead:** Every option considered is shown with its price and the specific reason it won or lost (Trade-off Ledger), not just a filtered results list.

## Egencia / CWT — now both under American Express Global Business Travel
**Website:** https://www.amexglobalbusinesstravel.com — ⚠️ blocked automated access (403); check manually. `mycwt.com` — ✅ live-verified, confirms **CWT (Carlson Wagonlit Travel) is now also American Express Global Business Travel**, alongside Egencia.

- **What it is:** Two formerly-independent major travel management companies (Egencia, acquired 2021; CWT, more recently) both now operate under the Amex GBT umbrella — evidence of heavy consolidation among traditional enterprise players.
- **Known features (from CWT's live site):** Traveler login portal for booking/managing trips; local office network across countries; mobile + web access; dedicated traveler support center; meetings & events, consultancy services.
- **Strength:** Deep enterprise integration, global support infrastructure, decades of service relationships.
- **Gap:** Heavy, sales-led/service-led onboarding — not self-serve. Recommendation logic is not exposed to the end user; delivered as a managed service, not an interrogable tool.
- **Why a user would pick AI Trip Optimizer instead:** Fully self-serve, no sales call or account manager needed, every recommendation directly explainable by the user themselves.

## Deem
**Website:** https://www.deem.com — ✅ live-verified

- **What it is:** Corporate travel management software for organizations with 300+ employees.
- **Known features:** Customizable cloud/mobile platform; corporate card + expense integration; travel policy compliance enforcement; Deem Ground (ground transportation booking); EcoCheck (sustainability/carbon tracking); Travel SafetyCheck; Uber for Business integration.
- **Strength:** Award-winning usability (G2 "Best Usability"), broad feature set, strong enterprise integrations.
- **Gap:** Built for organizations with 300+ employees — no self-serve path for a smaller team to just start using it; no structured, per-alternative reasoning shown to the end traveler at decision time.
- **Why a user would pick AI Trip Optimizer instead:** Self-serve from day one regardless of company size, with every recommendation's reasoning (Trade-off Ledger) shown directly to the traveler, not just to a travel manager via a dashboard.

## Spotnana
**Website:** https://www.spotnana.com — ✅ live-verified

- **What it is:** A "Travel-as-a-Service" infrastructure platform — sells API access and white-label travel tech to other companies, rather than a direct end-user product.
- **Known features:** Open API platform; white-labeling; global content aggregation; consumer-grade self-service traveler experience; configurable policy controls; described AI architecture for "enhanced booking and management functions."
- **Strength:** Modern infrastructure, positions itself as more flexible/composable than legacy TMCs.
- **Gap:** Being infrastructure-first, it doesn't itself expose an end-user-facing explainability feature like a Trade-off Ledger — that's left to whoever builds on top of its API. Its AI claims are described in general marketing language, not a specific auditable reasoning feature.
- **Why a user would pick AI Trip Optimizer instead:** A direct, ready-made explainable decision surface (Trade-off Ledger, Ask This Itinerary) rather than raw infrastructure someone else would still need to build a UI on top of.

## Emburse
**Website:** https://www.emburse.com — ✅ live-verified

- **What it is:** Travel + expense management with an AI-driven compliance/fraud-prevention focus.
- **Known features:** "Emburse AI Platform" for expense categorization and spend visibility; "Emburse Assurance" — AI compliance layer that flags policy violations/fraud in real time; combines travel, expense, AP automation, invoice, and payment handling; strong security certifications (ISO 27001, SOC 2, PCI DSS).
- **Strength:** Strong finance/compliance angle, real enterprise customers (Toyota, Microsoft, GM per its own site), broad global coverage.
- **Gap:** Its AI is oriented toward catching problems *after* a decision (fraud/policy violations), not explaining *why* a specific itinerary was recommended over alternatives in the first place.
- **Why a user would pick AI Trip Optimizer instead:** Explainability is built into the recommendation itself, upfront — not a compliance layer checking work after the fact.

## BCD Travel
**Website:** https://www.bcdtravel.com — ✅ live-verified

- **What it is:** A large traditional Travel Management Company (TMC) — service-led, not primarily a self-serve software product.
- **Known features:** "TripSource" (tailored end-to-end travel management), "GetGoing" (a more self-serve travel + expense product), meetings & events, travel consulting, API-based "open ecosystem" integrations, 24/7 customer care, 15,000+ employees across 170+ countries.
- **Strength:** Massive scale, high client retention (95%+ per its own site), deep service relationships.
- **Gap:** Fundamentally a services company with software attached, not a lightweight self-serve optimizer — no mention of structured per-alternative reasoning shown to the end traveler.
- **Why a user would pick AI Trip Optimizer instead:** No consulting engagement or TMC relationship required — self-serve from day one, with reasoning exposed directly in the product.

## ITILITE (India)
**Website:** https://www.itilite.com — ✅ live-verified

- **What it is:** An India-based unified corporate travel and expense management platform — the closest direct India-market comparison for this project.
- **Known features:** Negotiated corporate flight/hotel rates; OCR-based automated expense capture with AI GL-code tagging; virtual corporate cards with cashback; **"Iris"** — a conversational AI travel analyst for instant insights (closest analog to Navan's "Ava" and to our Trip Knowledge Assistant); **"Mastermind"** — AI spend benchmarking and savings analysis; 24/7 human support with sub-30-second response guarantee; ERP integrations (NetSuite, SAP, Oracle, etc.).
- **Strength:** Strong India-market presence, claims 20–30% travel spend reduction, genuinely close in ambition to this project (an AI analyst + savings analysis).
- **Gap:** "Iris" is conversational (same pattern as Navan's Ava — no persistent structured ledger a user can audit later), and "Mastermind" is retrospective spend benchmarking, not a live, per-itinerary structured breakdown shown at the moment of choosing.
- **Why a user would pick AI Trip Optimizer instead:** The Trade-off Ledger is generated *with* the recommendation, not as a separate after-the-fact benchmarking report — and Ask This Itinerary is scoped to one specific trip's own audit data, not a general conversational analyst.

## Could Not Verify (flagged, not included as confirmed)
Two more India-market players were checked but **timed out repeatedly on automated fetch** (likely bot-blocking, common for these sites) — genuinely unverified, not guessed:
- **MakeMyTrip for Business ("myBiz")** — `mybiz.makemytrip.com`
- **Yatra Corporate** — `yatra.com` (corporate/business travel section)

If you want these in your final submission, open them yourself in a browser and note their features — I won't state specifics I couldn't confirm.

## Summary: Why Users Would Choose AI Trip Optimizer Over Any of These
| What competitors do | What AI Trip Optimizer does instead |
|---|---|
| Policy pass/fail flag (Concur) or none at all | Structured Trade-off Ledger: every alternative, its price, and the specific reason it won or lost |
| Filtered results or a policy-compliant list, no per-alternative reasoning (Perk, Deem) | Structured Trade-off Ledger with a specific won/lost reason per alternative |
| Conversational AI concierge/analyst with no persistent reasoning record (Navan's Ava, ITILITE's Iris) | Ask This Itinerary — cited answers grounded in one specific recommendation's own audit trail |
| Enterprise sales-led/service-led onboarding, opaque logic (Egencia/CWT/Amex GBT, BCD Travel) | Self-serve, fully explainable to the end user directly |
| Infrastructure/API without an end-user explainability layer (Spotnana) | A ready-made, explainable decision surface out of the box |
| Compliance AI that checks work after the fact (Emburse Assurance) | Explainability built into the recommendation itself, upfront |
| No live re-optimization preview | What-If Simulator (stretch) — change one input, see a live diff, without committing |

## Where AI Trip Optimizer Differentiates
Across all nine reviewed players, none treat "why was this chosen over that" as a first-class, structured UI element shown *at decision time* — it's either absent, buried in a policy pass/fail flag, handled conversationally with no persistent record, or delivered as a retrospective report/benchmark. The Must-have Trade-off Ledger in this project's PRD targets exactly that gap, and Ask This Itinerary / What-If Simulator extend it further than any of them expose to an end user directly. Full feature-to-gap mapping is in `20_Differentiators.md`.

## Honest Caveat
This analysis is based on each product's own live website content as of 2026-09-08, not a hands-on trial of every competitor's actual product — appropriate rigor for a student project's competitive framing, not a claim of exhaustive hands-on benchmarking. Company websites change; re-verify before final submission if significant time has passed.


---


<!-- ===== FILE: 20_Differentiators.md ===== -->

# Differentiators

> **Provenance:** The three features below ARE official — they appear directly in the PRD's Feature Priorities table (Trade-off Ledger = Must; Ask This Itinerary = Should; What-If Simulator = Could/stretch). The competitor-gap framing and positioning statement below are the team's own analysis, not instructor-provided.
>
> **Amended 2026-09-09:** CO2-aware optimization removed from this list — cut as a scored feature per the instructor's verbal instruction. See `03_PRD.md` amendment note and `17_Risk_Register.md` R-009. It was previously differentiator #2 here; the list below is renumbered.

Three features exist specifically because no competitor reviewed in `19_Competitor_Analysis.md` has them in this form, and none require infrastructure beyond what `04_TRD.md` already specifies. One is Must-have in the approved PRD; two are Should/Could.

## 1. Trade-off Ledger — Must
**What:** Every alternative the optimization pipeline considered is shown with its price and a specific structured reason it won or lost (price, budget, constraint, or preference) — not just the final chosen option.
**Why it's differentiated:** Competitors show a result or a pass/fail policy flag; none expose the full considered set with reasons in a structured, persistent form.
**PRD reference:** US-004.

## 2. Ask This Itinerary — Should
**What:** The Trip Knowledge Assistant can answer questions grounded in one specific itinerary's own data and audit trail ("why not the earlier flight?"), distinct from its general knowledge-base mode.
**Why it's differentiated:** Competitor AI assistants (e.g. Navan's concierge, ITILITE's Iris) are conversational booking/analyst aids drawing on general knowledge or retrospective benchmarking, not scoped to explain a specific already-generated recommendation.
**PRD reference:** US-09.

## 3. What-If Simulator — Could (stretch)
**What:** Change one input (budget or a preference) and preview a re-optimized itinerary without saving, with a diff against the original.
**Why it's differentiated:** None of the competitors reviewed in `19_Competitor_Analysis.md` expose live re-optimization previews directly to an end user — it's at best an internal ops tool.
**PRD reference:** US-011. Build only after the MVP pipeline works end-to-end (see `15_Roadmap.md` Week 11, `00_Investigation_Report.md` A19).

## Positioning Statement
For the PRD/viva framing: *"Enterprise travel tools treat explainability as a compliance afterthought — a policy pass/fail flag. AI Trip Optimizer treats it as the core UX: every recommendation comes with a structured, auditable record of what was considered and why."* This is an honest differentiation — it doesn't claim competitors entirely lack these capabilities, it identifies a genuine gap in how they present optimization reasoning to the end user.


---


<!-- ===== FILE: 21_Glossary.md ===== -->

# Glossary

> **Provenance:** Terms drawn directly from the PRD (Product States, Member/Admin, MoSCoW) are official. Terms describing the team's own design (Guardrail, ADR) are the team's own naming, included here for clarity.

| Term | Meaning |
|---|---|
| **Trade-off Ledger** | The structured record of every alternative an itinerary optimization considered, with price and a specific reason it won or lost. |
| **Ask This Itinerary** | The mode of the Trip Knowledge Assistant that answers questions grounded in one specific trip's own itinerary and audit data, rather than the general knowledge base. |
| **What-If Simulator** | Stretch feature: re-running the optimizer with one changed input and previewing the diff, without saving, until explicitly approved. |
| **RAG (Retrieval-Augmented Generation)** | Pattern where an LLM answer is grounded in retrieved source chunks rather than the model's own unguided knowledge; see Lewis et al., arXiv:2005.11401. |
| **LangGraph** | The stateful graph-based orchestration framework used to build the optimization pipeline as explicit nodes and state, rather than one large prompt. |
| **pgvector** | A PostgreSQL extension adding a vector column type and similarity search, used here to store and query document-chunk embeddings in the same database as relational data. |
| **Product States** | The trip lifecycle defined in the PRD: `DRAFT → OPTIMIZING → OPTIMIZED → UNDER_REVIEW → DECIDED`, with failure state `OPTIMIZATION_FAILED`. |
| **Guardrail (cost-consistency check)** | The backend validation that every dollar figure in the LLM's rationale matches a value already computed in code, failing the pipeline on mismatch rather than returning an inconsistent answer. |
| **Member / Admin** | The two user roles in the system — Member creates/manages trips; Admin additionally manages the knowledge base and views dashboard aggregates. |
| **MoSCoW** | Prioritization scheme used in the PRD's Feature Priorities table: Must, Should, Could, Won't (this project doesn't use an explicit Won't column, but Out of Scope in `01_Project_Overview.md` serves the same purpose). |
| **ADR (Architecture Decision Record)** | A short, numbered record of a technical decision and its rationale — see `18_Architecture_Decision_Records.md`. |


---


<!-- ===== FILE: 22_Tech_Stack_and_Libraries.md ===== -->

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


---


<!-- ===== FILE: 23_Setup_Guide.md ===== -->

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


---


<!-- ===== FILE: 24_Submission_Checklist.md ===== -->

# Submission Checklist

> **Provenance:** The milestone table below is **official** — transcribed directly from the instructor's "Important OJT Project Milestones & Evaluation Schedule." **Confirm these dates are current before relying on them** — see `17_Risk_Register.md` R-004; as of this doc's writing, the PRD and GitHub deadlines below may already be past. The "What Must Exist by..." sections further down are the **team's own interpretation** of what a working submission needs — the brief itself only specifies `expected_output` = "Working app," not an itemized deliverable list.

| Milestone | Deadline | Fixed or Tentative | Status |
|---|---|---|---|
| PRD Submission | Aug 30 | Fixed | ⬜ Confirm actual status |
| GitHub Submission | Sept 6 | Fixed | ⬜ Confirm actual status |
| Viva 1 | Sept 15–22 | Tentative window | ⬜ |
| Viva 2 | Oct 15–22 | Tentative window | ⬜ |
| Viva 3 | Nov 15–22 | Tentative window | ⬜ |
| Project Demo Video | Nov 25 | Fixed | ⬜ |
| Deployment Link | Nov 25 | Fixed | ⬜ |
| External Final Viva | Dec 10–15 | Tentative window | ⬜ |

## Instructor's Stated Rules
- PRD Submission, GitHub Submission, Project Demo Video, and Deployment Link deadlines are fixed.
- Viva 1/2/3 exact dates/times are communicated separately — the windows above are tentative.
- Development, documentation, testing, and deployment should be planned around this timeline — avoid last-minute submissions.
- The instructor's brief states verbatim: *"While preparing your PRD, you must specifically refer to the document titled 'Complete Documentation', which contains the required format and guidelines for preparing the PRD."* **We have not located a file with that exact title.** The instructor's reference Drive folder (`18SMxz-wMWJPXkvrT6kkT4y4Pna3Uc6Kl`) currently contains only `01_Project_Overview.md` and `02_BRD.md` — themselves a different project's template (AI Credit Underwriting Platform), not literally named "Complete Documentation." This docs kit (`00`–`25`) mirrors the structure of those 2 available files, but that is **not the same** as having checked against the actual "Complete Documentation" file. Locating and checking against it is an open item — see `17_Risk_Register.md` R-007.

## What Must Exist by GitHub Submission
- This full `docs/` kit.
- A working repo skeleton (frontend + backend, even if MVP features aren't complete) — per `15_Roadmap.md` Week 1–2 scope, at minimum.
- `.gitignore`, `.env.example` (no real secrets committed).
- `README.md` describing the project and how to run it (see `23_Setup_Guide.md` for the content to summarize there).

## What Must Exist by Deployment Link / Demo Video
- Live Vercel (frontend) + Render/Railway (backend+DB) deployment, per `13_CICD_and_Deployment.md`.
- A demo video walking through the MVP flow end-to-end, recorded against the deployed instance.
- All Must-have PRD features functional; Should-haves ideally complete; Could-haves/stretch only if time allowed (`17_Risk_Register.md` R-005).

## Open Items Needing the Mentor (carry over from `17_Risk_Register.md`)
1. Whether the deadline dates above are the current/live schedule.
2. Whether a formal scoring rubric will be used, and if so, its criteria.
3. **Where the "Complete Documentation" file is** — the brief requires referring to it by that exact name for PRD format, and it hasn't been located (R-007).
4. **Whether the submitted PRD PDF needs to be corrected/re-uploaded.** The Feature Priorities table in `AI Trip Optimizer — PRD final.pdf` still lists "CO2-aware optimization" and "Knowledge document upload" as Must — this was a leftover mistake from when the corresponding user stories were removed, not the instructor's actual intent (R-009/R-010). If this exact PDF was already submitted, ask whether a corrected version is needed.


---


<!-- ===== FILE: 25_Project_Score.md ===== -->

# Project Self-Assessment

> **Provenance:** The two evaluation categories (Accuracy, UX) are official (brief field `evaluation_metrics`). The feature checklist in §1 is sourced from the PRD; the specific measurable sub-metrics in §2/§3 are the team's own operationalization.

This file is intentionally left as a template, not filled with estimated scores — the project brief's evaluation metrics (**Accuracy, UX**) can only be honestly assessed once the MVP is functional, not at planning time. Fill each section in during Month 3 (Week 11–12), using real measurements from `14_Evaluation_Metrics.md`.

## 1. Feature Completion Against the PRD
| PRD Item | Priority | Status | Notes |
|---|---|---|---|
| Traveler management (US-001) | Must | ⬜ Not started | |
| Trip request creation (US-002) | Must | ⬜ Not started | |
| Optimized itinerary generation (US-003) | Must | ⬜ Not started | |
| Trade-off Ledger (US-004) | Must | ⬜ Not started | |
| Budget/constraint flags (US-005) | Must | ⬜ Not started | |
| Explainable rationale (US-006) | Must | ⬜ Not started | |
| Review/edit/approve (US-007) | Must | ⬜ Not started | |
| Trip Knowledge Assistant (US-08) | Must | ⬜ Not started | |
| Ask This Itinerary (US-09) | Should | ⬜ Not started | |
| Dashboard (US-010) | Should | ⬜ Not started | |
| What-If Simulator (US-011) | Could/stretch | ⬜ Not started | |
| Multi-agent expansion | Stretch | ⬜ Not started | |

*(Update statuses to In Progress / Done as work proceeds — don't mark Done until the PRD's acceptance criteria for that item are actually met.)*

## 2. Accuracy Metrics (fill in from `14_Evaluation_Metrics.md` §1)
- Cost-figure consistency rate: ___
- Trade-off Ledger completeness: ___
- RAG citation accuracy: ___
- RAG "don't know" precision: ___

## 3. UX Metrics (fill in from `14_Evaluation_Metrics.md` §2)
- Median itinerary generation turnaround: ___
- Approval rate: ___
- Informal usability findings: ___

## 4. Honest Retrospective (fill in at the end)
- What went well:
- What was cut and why (cross-reference `17_Risk_Register.md`):
- What would be done differently with more time:
- How the Must-have differentiator (Trade-off Ledger) actually held up in practice:

## 5. Rubric Alignment
Once the mentor confirms whether a formal scoring rubric applies (`24_Submission_Checklist.md`, open item 2), map this self-assessment to that rubric here rather than inventing scoring categories in advance.


---


<!-- ===== FILE: 26_Day_by_Day_Build_Plan.md ===== -->

# Day-by-Day Build Plan (12 Weeks, Both Team Members)

> **Provenance:** This is the team's own execution plan — no day-by-day schedule is mandated by the brief or PRD. It operationalizes the official month themes (`15_Roadmap.md`) and the officially mandated/suggested tech (`22_Tech_Stack_and_Libraries.md`) into concrete daily tasks. Week numbers are relative (Week 1, Week 2...), NOT tied to specific calendar dates — the real start date depends on resolving `17_Risk_Register.md` R-004 (deadline confirmation) with the mentor first. Map Week 1 = your actual first working week once that's confirmed.
>
> **Amended 2026-09-09:** CO2 tasks removed from Week 5–6 below — CO2-aware optimization was cut per instructor instruction (see `03_PRD.md` amendment note, `17_Risk_Register.md` R-009).

## How to Read This Doc
Each week has a goal, a **How to build it** section per feature (concrete steps — function names, endpoints, files touched), then a **Day 1–5** breakdown per person. Assumes a standard 5-day working week; compress or stretch days as your real schedule requires, but keep the task order — later days depend on earlier ones.

**Roles** (swap if you divide differently — task content doesn't change):
- **Workstream A — Bhuvan:** Product, Data & Optimizer (DB, mock data, LangGraph pipeline, Trade-off Ledger logic, dashboard queries).
- **Workstream B — Swetalin:** App, RAG & Assistant (Next.js UI, auth UI, document ingestion, Trip Knowledge Assistant, Ask This Itinerary).

**PDF library, since it keeps coming up:** `pypdf` — pure Python, `pip install pypdf`, no separate system install (unlike `pdfplumber`/`pdf2image`, which need Poppler installed on the OS). Used in Week 9 for knowledge-document text extraction. Full reasoning in `18_Architecture_Decision_Records.md` ADR-008.

**Full library list** (don't reinstall per-week — install what's needed as you reach it): see `22_Tech_Stack_and_Libraries.md`.

## UI/UX Design Approach (added 2026-09-09, per the user's explicit ask)
Every screen gets a quick **low-fidelity wireframe before it gets built** — not all screens upfront, not skipped entirely. This is scheduled below, day by day, at the point each screen is first built.

- **Tool:** Figma (free tier is enough — one shared file, both of you as editors). Paper/whiteboard photographed and shared works too if Figma feels like overhead this early.
- **What "low-fidelity" means:** boxes, labels, and arrows — no colors, no real components, no pixel-perfect spacing. The goal is agreeing on *what's on the screen and where*, not finishing the visual design. Real styling comes from Tailwind + shadcn/ui during the build step itself.
- **Reference material:** `10_UI_UX_Design.md` already specifies what each screen must contain (per PRD acceptance criteria) — wireframe *that*, don't invent new content. For visual inspiration (layout patterns, not copying), the closest competitor UIs already reviewed in `19_Competitor_Analysis.md` are worth a quick look before wireframing:
  - **Navan** (navan.com) — cleanest modern layout, good reference for the trip request flow and overall nav structure.
  - **ITILITE** (itilite.com) — closest feature match to this project; useful for the assistant chat panel layout.
  - **Deem** (deem.com) — useful for dashboard/reporting layout ideas.
- **Where each screen's wireframe happens:** Day 0 below covers the 4 core screens jointly, upfront, so both of you share one visual vocabulary before splitting work; anything not covered there gets a quick wireframe pass on the day it's first built (marked inline in the tables below).

---

# Month 1 — Setup (Weeks 1–4)
No AI/LLM code this month — pure plumbing, so Month 2 isn't fighting infrastructure and AI logic at once.

## Day 0 — Joint UI/UX Wireframing Session (before Week 1 Day 1)
**Do this together, in one sitting, ~2–3 hours, before either of you writes any frontend code.**

1. Open `10_UI_UX_Design.md` together and read each screen's required content out loud.
2. In Figma (or paper), sketch low-fidelity wireframes for the 4 core screens: **Trip Request Form**, **Itinerary Result View** (the most important one — Trade-off Ledger panel, budget/constraint flags, rationale text, approve/reject actions), **Trip Knowledge Assistant chat panel** (including the mode toggle for Ask This Itinerary), and **Dashboard**.
3. Briefly look at Navan, ITILITE, and Deem's live sites (links above) for layout inspiration — 5–10 minutes each, not a deep audit.
4. Agree on a shared visual language: nav structure, spacing rhythm, where primary actions (Approve/Reject/Ask) live on the page — so Bhuvan and Swetalin's later, separately-built screens still feel like one product.
5. Save the Figma file link somewhere both of you can find it again (e.g. pinned in your shared chat, or a link in `README.md`).

**Deliverable:** One shared Figma file (or photographed sketches) covering all 4 core screens, agreed by both of you, referenced when building each screen later.

## Week 1 — App Shell + Backend Skeleton + Docker Compose

**How to build it:**
- Frontend: `npx create-next-app@latest` → TypeScript, App Router, Tailwind, `src/` directory. Install `@tanstack/react-query`, `zod`. Init shadcn/ui (`npx shadcn@latest init`).
- Backend: create `backend/` with `fastapi`, `uvicorn[standard]`, `sqlmodel`, `python-dotenv` in `requirements.txt`. A minimal `app/main.py` with a `/health` endpoint.
- Docker Compose: `docker-compose.yml` with a `postgres` service (use the `pgvector/pgvector` image so the extension is available from day one) and a `backend` service.

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | Create repo structure (`backend/`, `frontend/`, `data/`, `docs/` already exists); write `docker-compose.yml` with Postgres (`pgvector/pgvector` image) | `create-next-app` scaffold; confirm dev server runs at `localhost:3000` |
| 2 | FastAPI skeleton (`app/main.py`, `/health` endpoint); confirm `uvicorn app.main:app --reload` runs | Install Tailwind + shadcn/ui; build a basic layout shell (nav, page container) — follow the Day 0 wireframe's nav structure |
| 3 | Wire backend container into Docker Compose; confirm `docker compose up -d` brings up Postgres + backend together | Install React Query; set up a `lib/api.ts` fetch wrapper pointed at `NEXT_PUBLIC_API_URL` |
| 4 | Write `.env.example` (DB URL, JWT secret placeholder, OpenAI key placeholder) per `11_Security_Design.md` §3 | Confirm frontend can call `/health` through the API wrapper and render the result |
| 5 | **Sync:** both confirm `docker compose up -d` + `npm run dev` run side by side without conflicts; commit Week 1 skeleton | Same sync; write `README.md` stub with setup steps (mirrors `23_Setup_Guide.md`) |

**Deliverable:** Next.js dev server + FastAPI (in Docker) running side by side, frontend successfully calls `/health`.

## Week 2 — Auth, RBAC, DB Schema, First Migrations

**How to build it:**
- DB: create the `users` table per `06_Database_Design.md` (id, email, hashed_password, role, created_at). First Alembic migration.
- Auth: `passlib[bcrypt]` for hashing, `python-jose[cryptography]` for JWT. `POST /auth/register`, `POST /auth/login` per `07_API_Specification.md`. A FastAPI dependency (`get_current_user`) that decodes the JWT and loads the user; a second dependency (`require_admin`) for admin-only routes — see `11_Security_Design.md` §2.

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | Install `alembic`, `sqlmodel`, `psycopg2-binary`; `alembic init`; write the `users` SQLModel | Quick wireframe (15 min) of login/register forms — these weren't in the Day 0 set since they're simple; then build with shadcn/ui form components |
| 2 | First Alembic migration (`users` table); run `alembic upgrade head` against the Docker Postgres | Zod schemas mirroring the register/login request shapes |
| 3 | Implement `passlib` password hashing + `POST /auth/register` | Wire the register form to `POST /auth/register` via React Query mutation |
| 4 | Implement JWT issuance (`python-jose`) + `POST /auth/login`; write `get_current_user` dependency | Wire login form; store JWT (e.g. httpOnly-friendly approach or a simple client store) |
| 5 | **Sync:** agree on the JWT payload shape (user id, role, expiry) so frontend and backend interpret it identically; write `require_admin` dependency | Add auth state to the app (protected routes redirect to login if no valid token) |

**Deliverable:** A user can register, log in, and the frontend holds a valid JWT for subsequent calls.

## Week 3 — Traveler + Trip CRUD, Mock Data Seeded

**How to build it:**
- DB: `travelers` and `trips` tables per `06_Database_Design.md` (trip `status` enum starts at `DRAFT`, per PRD US-002).
- Endpoints: `POST/GET/DELETE /travelers`, `POST/GET /trips` per `07_API_Specification.md` — the traveler-delete endpoint must return 409 if the traveler has existing trips (PRD US-001 acceptance criteria).
- Mock data: build `data/mock_flights.json` and `data/mock_hotels.json` per `09_Mock_Data_Spec.md`, plus a seed script.

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | SQLModel + migration for `travelers` table | Traveler creation form UI (build from the Day 0 wireframe) |
| 2 | SQLModel + migration for `trips` table (status enum) | Trip request form UI (dates, budget, preferences) — build from the Day 0 wireframe |
| 3 | `POST/GET/DELETE /travelers` incl. the 409-on-existing-trips check | Wire traveler form to the API; traveler list view |
| 4 | `POST/GET /trips` (status starts `DRAFT`) | Wire trip request form to the API; trip list view |
| 5 | **Sync:** confirm the trip JSON shape (dates/budget/preferences) both sides agree on; write `data/mock_flights.json` + `data/mock_hotels.json` per spec, plus the seed script | Trip detail page skeleton (shows DRAFT trips, no optimization yet) |

**Deliverable:** Full traveler/trip CRUD working end-to-end in the UI; mock flight/hotel data seeded in the DB.

## Week 4 — Trip Request UI End-to-End (No Optimization Yet)

**How to build it:** Polish the create → list → detail flow so it's demo-ready even before the optimizer exists — this is the last "plumbing only" week per `15_Roadmap.md`.

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | Review/clean up DB indices and FK constraints across `travelers`/`trips` | Loading/error states on all forms and lists (React Query states) |
| 2 | Write backend integration tests for traveler/trip endpoints (`12_Testing_Strategy.md`) | Form validation polish (Zod error messages surfaced in UI) |
| 3 | Add `GET /trips` status filter | Trip list filtering UI by status |
| 4 | Code review of Workstream B's endpoints wiring | Code review of Workstream A's schema/migrations |
| 5 | **Sync:** both walk through the full create-traveler → create-trip → view-trip flow together end-to-end; fix anything broken | Same; tag/commit `end-of-month-1` |

**Deliverable:** A working, demoable CRUD app — no AI yet, but a solid foundation. Matches Month 1's official theme "Setup."

---

# Month 2 — Core Features (Weeks 5–8)

## Week 5–6 — LangGraph Optimization Pipeline

**How to build it** (full detail in `08_GenAI_Architecture.md` §2):
1. Define the pipeline `TypedDict` state (trip request, candidate options, check result, composed itinerary).
2. `search_node` — pure Python, queries mock flight/hotel data by trip dates/preferences. No LLM.
3. `check_node` — pure Python, deterministic budget/constraint checks. No LLM (ADR-004).
4. `compose_node` — the only LLM call, using `.with_structured_output()` via `langchain-openai`, returning `{rationale, tradeoff_ledger}`. Prompt passes code-computed totals; instructs the model never to invent a different number.
5. Guardrail: after the LLM call, validate every dollar figure in `rationale` matches a value already in the structured response; on mismatch, set status `OPTIMIZATION_FAILED` instead of returning an inconsistent answer.
6. Wire `POST /trips/{id}/optimize` to run the graph and persist to `itineraries` + `tradeoff_ledger_entries`.

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| Week5 Day1 | Define `TypedDict` state; scaffold the `StateGraph` with 3 empty nodes | Set up an OpenAI account/API key in `.env` (not committed); install `langgraph`, `langchain-core`, `langchain-openai` |
| Week5 Day2 | Implement `search_node` against mock data | Read up on `.with_structured_output()` — write a tiny standalone script to test it against a sample prompt |
| Week5 Day3 | Implement `check_node` (budget/constraint rules) | Draft the `compose_node` prompt (evidence-before-explanation, structured output schema) |
| Week5 Day4 | Unit test `check_node` against hand-crafted edge cases (`12_Testing_Strategy.md`) | Implement `compose_node` calling the LLM with `check_node`'s output as context |
| Week5 Day5 | **Sync:** review the full state shape flowing through all 3 nodes together | Implement the cost-consistency guardrail; test it fails correctly on a mocked inconsistent response |
| Week6 Day1 | Wire `POST /trips/{id}/optimize` end-to-end; persist `itineraries` + `tradeoff_ledger_entries` | Build the itinerary result API response shape per `07_API_Specification.md` |
| Week6 Day2 | Add `OPTIMIZING`/`OPTIMIZED`/`OPTIMIZATION_FAILED` status transitions | Pipeline integration test: fixed mock data in, assert response structure (not exact LLM prose) |
| Week6 Day3 | Tune `check_node` rules against a few realistic trip scenarios | Tune the `compose_node` prompt for rationale quality/clarity |
| Week6 Day4 | Performance check: confirm `/optimize` responds within a few seconds (PRD US-003) | Same check from the client side; add a loading state for the optimize call |
| Week6 Day5 | **Sync:** run the full pipeline together against 3–4 different trip scenarios, review output quality | Same; fix any Trade-off Ledger entries with missing/unclear reasons |

**Deliverable:** `POST /trips/{id}/optimize` returns a real itinerary with Trade-off Ledger + guardrailed rationale. Matches PRD US-003, US-004, US-005, US-006.

## Week 7 — Review/Edit/Approve Workflow + Audit Trail

**How to build it:** `PATCH /trips/{id}/itinerary` (recalculates total cost), `POST /trips/{id}/decision` (approve → `DECIDED`; reject requires a reason) per PRD US-007. Every pipeline run and decision writes an `audit_events` row (event_type `PIPELINE_RUN` / `DECISION`).

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | Design `audit_events` writes — hook into `/optimize` and `/decision` | Approve/Reject UI (reject requires a reason field) |
| 2 | Implement `PATCH /trips/{id}/itinerary` (recalculate total on edit) | Edit-line-item UI, live total recalculation on the client too (server is source of truth) |
| 3 | Implement `POST /trips/{id}/decision` (status → `DECIDED`) | Wire approve/reject buttons to the endpoint |
| 4 | `GET /audit?trip_id=...` endpoint | Audit history view (simple timeline/list) |
| 5 | **Sync:** confirm audit events capture everything needed to reconstruct "what happened and why" for a trip | Same; test the full review→edit→approve flow manually |

**Deliverable:** Full itinerary lifecycle working: generate → review → edit → approve/reject, with an audit trail.

## Week 8 — Itinerary Result UI Polish

**How to build it:** Per `10_UI_UX_Design.md` — Trade-off Ledger panel as a first-class element (not an accordion afterthought), budget/constraint flags visibly tagged, rationale text that never states an unshown number. This screen matters most — revisit the Day 0 wireframe first, since by now you have real data shapes from Weeks 5–7 that may not match what was sketched blind.

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | Backend support for any UI-driven query needs (e.g. sorting ledger entries by price) | Refine the Day 0 wireframe for this screen against real API response data (30 min), then build the Trade-off Ledger panel component |
| 2 | Review data completeness — every alternative has price + reason populated | Build budget/constraint flag components (rule + offending line item) |
| 3 | — | Rationale display component |
| 4 | Fix any backend gaps found during UI integration | Full itinerary result page assembly |
| 5 | **Sync:** demo the full result page together against 2–3 saved trips; polish based on what looks unclear | Same; end-of-month-2 commit |

**Deliverable:** A demo-ready itinerary review screen. Matches Month 2's official theme "Core features."

---

# Month 3 — AI & Deploy (Weeks 9–12)

## Week 9 — Knowledge Document Ingestion + Trip Knowledge Assistant v1

**How to build it** (full detail in `08_GenAI_Architecture.md` §3):
1. `documents` + `document_chunks` tables (pgvector `embedding` column) per `06_Database_Design.md`.
2. `POST /documents` — multipart upload → `pypdf` text extraction → chunk (~500 tokens, overlap) → embed each chunk → store.
3. `POST /assistant/ask` — embed the question → pgvector similarity search (top-k) → LLM answers only from retrieved chunks, cites source, says "not covered" if insufficient (PRD US-08).

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | `documents` + `document_chunks` migrations (pgvector column) | Install `pypdf`; write a standalone script extracting text from a sample PDF |
| 2 | Write the sample knowledge documents per `09_Mock_Data_Spec.md` §3 | Implement chunking logic |
| 3 | — | Implement embedding + storing chunks (`POST /documents`) |
| 4 | Review chunk quality against the sample documents | Implement pgvector similarity search for a question |
| 5 | **Sync:** test retrieval quality together — does the right chunk come back for an obvious question? | Implement `POST /assistant/ask` with citation + "not covered" fallback |

**Deliverable:** Upload a document, ask a question, get a cited answer. Matches PRD US-08.

## Week 10 — Ask This Itinerary + Authorization Checks

**How to build it:** `POST /trips/{id}/ask` — same retrieve-then-generate pattern, but source is that trip's own itinerary/ledger/audit data, not the knowledge base (PRD US-09). Every `/trips/{id}/...` endpoint must verify the requesting user has access (`11_Security_Design.md` §2).

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | Write the trip-ownership-check FastAPI dependency; apply to all trip-scoped routes | Design the itinerary-scoped retrieval (what data counts as "this itinerary's own data") |
| 2 | Audit trip-scoped endpoints for missing auth checks (review pass) | Implement `POST /trips/{id}/ask` |
| 3 | Fix any gaps found in Day 1 review | Ensure responses are clearly labeled itinerary-scoped vs. knowledge-base (never confused — PRD US-09 acceptance criteria) |
| 4 | Write authz integration tests (a user can't access another user's trip) | Quick wireframe (15 min) refining the assistant chat panel from Day 0 with the mode toggle; then build Ask This Itinerary UI |
| 5 | **Sync:** verify together that a logged-in user genuinely cannot see another user's trip data | Same; test a few "why not the earlier flight?"-style questions |

**Deliverable:** Ask This Itinerary working and clearly distinguished from the general assistant; authorization holes closed.

## Week 11 — Dashboard, Eval Harness, Security Review, Stretch Goals

**How to build it:** `GET /dashboard?period=...` aggregating spend/savings/turnaround (PRD US-010). Eval harness per `14_Evaluation_Metrics.md`. Security review per `11_Security_Design.md`. Stretch goals only if on schedule — What-If Simulator first (cheaper), multi-agent only if time remains (`17_Risk_Register.md` R-005).

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | `GET /dashboard` aggregation query | Quick wireframe (15 min) refining the dashboard from Day 0 against real metrics available by now; then build Dashboard UI |
| 2 | Build the accuracy eval harness (cost-consistency, ledger completeness checks) | Build the RAG citation eval set (WikiQA-style triples) |
| 3 | Security review: secrets, auth, input validation pass (`11_Security_Design.md`) | Accessibility pass on forms/dashboard (`10_UI_UX_Design.md` §4) |
| 4 | **If on schedule:** `POST /trips/{id}/preview` (What-If Simulator, `persist:false`) | **If on schedule:** What-If diff UI |
| 5 | **Sync:** go/no-go decision on stretch goals based on actual progress; if behind, cut per `17_Risk_Register.md` R-005 | Same; run the full eval harness and record results into `25_Project_Score.md` |

**Deliverable:** Dashboard live, eval numbers captured, security reviewed, stretch goals attempted only if genuinely on schedule.

## Week 12 — Deployment, Demo Video, Final Documentation Pass

**How to build it:** Vercel (frontend) + Render/Railway (backend+DB) per `13_CICD_and_Deployment.md`. Alembic migrations run as a deploy step. Demo video recorded against the live deployment, not localhost.

| Day | Bhuvan (Workstream A) | Swetalin (Workstream B) |
|---|---|---|
| 1 | Set up Render/Railway backend + Postgres; configure env vars | Set up Vercel frontend deployment |
| 2 | Run Alembic migrations against production DB; seed mock data | Point frontend at the production API URL; smoke test |
| 3 | Fix any deploy-specific bugs (env var mismatches, CORS) | Same |
| 4 | Record demo video walkthrough (shared or split by workstream) | Same |
| 5 | **Sync:** final full walkthrough together against the live deployment; submit per `24_Submission_Checklist.md` | Final docs pass — update `25_Project_Score.md` with real numbers |

**Deliverable:** Live, working deployment; demo video; all submission checklist items complete.

---

## A Note on This Being Your First GenAI Project
The only genuinely new-to-you concept in this whole plan is Weeks 5–6 and 9 — everything in Month 1 is standard CRUD/auth work you may already recognize from other web projects. Don't front-load anxiety onto Week 1 thinking it's the "AI part" — it isn't. The real learning curve starts at Week 5, and by then you'll have a working app to build the AI features into, not a blank page.


---


<!-- ===== FILE: 27_Day_by_Day_Checklist.md ===== -->

# Single Day-by-Day Checklist (Day 0 – Day 60, Both Team Members)

> **Provenance:** This is the team's own execution plan, laid out as one continuous day list (not grouped by week) plus a master checklist, per the user's explicit request. It restates `26_Day_by_Day_Build_Plan.md` in a flatter, checkbox-friendly format — see that file for the "how to build it" technical detail behind each task. Day numbers are relative working days (Day 1 = your actual first working day, once confirmed with your mentor — see `17_Risk_Register.md` R-004), assuming a 5-day week.

**Roles:** Bhuvan = Workstream A (Product, Data & Optimizer). Swetalin = Workstream B (App, RAG & Assistant). Swap if you divide differently.

---

## Day 0 — Joint UI/UX Wireframing (before Day 1, ~2–3 hours, both together)
**Feature/Part:** UI/UX Wireframing — all 4 core screens (prep work, not a scored PRD feature itself)
- [ ] Read `10_UI_UX_Design.md` together, out loud, screen by screen
- [ ] Wireframe (Figma, low-fidelity) — **Trip Request Form**
- [ ] Wireframe — **Itinerary Result View** (Trade-off Ledger panel, budget/constraint flags, rationale, approve/reject) — the most important screen
- [ ] Wireframe — **Trip Knowledge Assistant chat panel** (incl. mode toggle for Ask This Itinerary)
- [ ] Wireframe — **Dashboard**
- [ ] Both: skim Navan (navan.com), ITILITE (itilite.com), Deem (deem.com) for layout inspiration, 5–10 min each
- [ ] Agree on shared visual language (nav structure, spacing, where primary actions live)
- [ ] Save the Figma link somewhere both can find (pin in chat / put in `README.md`)

**Deliverable:** ☐ One shared Figma file covering all 4 core screens.

---

**Feature/Part (Day 1–5):** App Shell + Backend Skeleton + Docker Compose — Infrastructure setup, not a scored PRD feature yet (official brief: `tech_stack` = React/Next.js, FastAPI, PostgreSQL)

## Day 1
- [ ] Bhuvan: Create repo structure (`backend/`, `frontend/`, `data/`); write `docker-compose.yml` with Postgres (`pgvector/pgvector` image)
- [ ] Swetalin: `npx create-next-app@latest`; confirm dev server runs at `localhost:3000`

## Day 2
- [ ] Bhuvan: FastAPI skeleton (`app/main.py`, `/health` endpoint); confirm `uvicorn` runs
- [ ] Swetalin: Install Tailwind + shadcn/ui; build layout shell (nav, page container) following the Day 0 wireframe

## Day 3
- [ ] Bhuvan: Wire backend container into Docker Compose; confirm `docker compose up -d` brings up both
- [ ] Swetalin: Install React Query; set up `lib/api.ts` fetch wrapper

## Day 4
- [ ] Bhuvan: Write `.env.example` (DB URL, JWT secret placeholder, OpenAI key placeholder)
- [ ] Swetalin: Confirm frontend calls `/health` through the wrapper and renders it

## Day 5 — Sync
- [ ] Both: Confirm `docker compose up -d` + `npm run dev` run side by side; commit Week 1 skeleton
- [ ] Swetalin: Write `README.md` stub

**Deliverable:** ☐ Next.js + FastAPI running side by side, frontend calls `/health` successfully.

---

**Feature/Part (Day 6–10):** Auth & RBAC — official Must-have feature (brief field `must_have_features` includes "Auth")

## Day 6
- [ ] Bhuvan: Install `alembic`, `sqlmodel`, `psycopg2-binary`; write the `users` SQLModel
- [ ] Swetalin: Quick wireframe (15 min) of login/register forms; build with shadcn/ui form components

## Day 7
- [ ] Bhuvan: First Alembic migration (`users` table); `alembic upgrade head`
- [ ] Swetalin: Zod schemas mirroring register/login request shapes

## Day 8
- [ ] Bhuvan: `passlib` password hashing + `POST /auth/register`
- [ ] Swetalin: Wire register form to `POST /auth/register` (React Query mutation)

## Day 9
- [ ] Bhuvan: JWT issuance (`python-jose`) + `POST /auth/login`; write `get_current_user` dependency
- [ ] Swetalin: Wire login form; store JWT

## Day 10 — Sync
- [ ] Both: Agree on the JWT payload shape (user id, role, expiry)
- [ ] Bhuvan: Write `require_admin` dependency
- [ ] Swetalin: Add auth state (protected routes redirect to login)

**Deliverable:** ☐ A user can register, log in, frontend holds a valid JWT.

---

**Feature/Part (Day 11–15):** Traveler Management (US-001, Must) + Trip Request Creation (US-002, Must) + mock data — official Must-have feature (brief field `must_have_features` includes "CRUD")

## Day 11
- [ ] Bhuvan: SQLModel + migration for `travelers` table
- [ ] Swetalin: Traveler creation form UI (build from Day 0 wireframe)

## Day 12
- [ ] Bhuvan: SQLModel + migration for `trips` table (status enum)
- [ ] Swetalin: Trip request form UI — dates, budget, preferences (build from Day 0 wireframe)

## Day 13
- [ ] Bhuvan: `POST/GET/DELETE /travelers` incl. 409-on-existing-trips check
- [ ] Swetalin: Wire traveler form to API; traveler list view

## Day 14
- [ ] Bhuvan: `POST/GET /trips` (status starts `DRAFT`)
- [ ] Swetalin: Wire trip request form to API; trip list view

## Day 15 — Sync
- [ ] Both: Confirm the trip JSON shape (dates/budget/preferences) agreed
- [ ] Bhuvan: Write `data/mock_flights.json` + `data/mock_hotels.json` + seed script
- [ ] Swetalin: Trip detail page skeleton

**Deliverable:** ☐ Full traveler/trip CRUD working; mock data seeded.

---

**Feature/Part (Day 16–20):** Trip Request UI hardening — polishing/testing US-001 + US-002 (no new feature this block, closes out Month 1 "Setup")

## Day 16
- [ ] Bhuvan: Review DB indices/FK constraints
- [ ] Swetalin: Loading/error states on all forms and lists

## Day 17
- [ ] Bhuvan: Backend integration tests for traveler/trip endpoints
- [ ] Swetalin: Form validation polish (Zod error messages)

## Day 18
- [ ] Bhuvan: `GET /trips` status filter
- [ ] Swetalin: Trip list filtering UI by status

## Day 19
- [ ] Bhuvan: Code review Swetalin's endpoint wiring
- [ ] Swetalin: Code review Bhuvan's schema/migrations

## Day 20 — Sync (End of Month 1)
- [ ] Both: Walk through create-traveler → create-trip → view-trip flow end-to-end; fix anything broken
- [ ] Swetalin: Tag/commit `end-of-month-1`

**Deliverable:** ☐ Working, demoable CRUD app — no AI yet. Matches official Month 1 theme "Setup."

---

**Feature/Part (Day 21–25):** LangGraph Optimization Pipeline, node-by-node — Itinerary Composition (US-003, Must) + Budget & Constraint Check (US-005, Must)

## Day 21
- [ ] Bhuvan: Define `TypedDict` state; scaffold `StateGraph` with 3 empty nodes
- [ ] Swetalin: Set up OpenAI account/API key in `.env`; install `langgraph`, `langchain-core`, `langchain-openai`

## Day 22
- [ ] Bhuvan: Implement `search_node` against mock data
- [ ] Swetalin: Read up on `.with_structured_output()`; test script against a sample prompt

## Day 23
- [ ] Bhuvan: Implement `check_node` (budget/constraint rules)
- [ ] Swetalin: Draft the `compose_node` prompt

## Day 24
- [ ] Bhuvan: Unit test `check_node` against hand-crafted edge cases
- [ ] Swetalin: Implement `compose_node` (LLM call using `check_node`'s output as context)

## Day 25 — Sync
- [ ] Both: Review the full state shape flowing through all 3 nodes together
- [ ] Swetalin: Implement the cost-consistency guardrail; test it fails correctly on a mocked bad response

**Deliverable:** ☐ All 3 pipeline nodes exist and connect (not fully wired to an endpoint yet).

---

**Feature/Part (Day 26–30):** LangGraph Pipeline wired end-to-end — Trade-off Ledger (US-004, Must) + Explainable Rationale (US-006, Must), on top of US-003/US-005 from the last block

## Day 26
- [ ] Bhuvan: Wire `POST /trips/{id}/optimize` end-to-end; persist `itineraries` + `tradeoff_ledger_entries`
- [ ] Swetalin: Build the itinerary result API response shape

## Day 27
- [ ] Bhuvan: Add `OPTIMIZING`/`OPTIMIZED`/`OPTIMIZATION_FAILED` status transitions
- [ ] Swetalin: Pipeline integration test (fixed mock data, assert structure)

## Day 28
- [ ] Bhuvan: Tune `check_node` rules against realistic scenarios
- [ ] Swetalin: Tune the `compose_node` prompt for rationale quality

## Day 29
- [ ] Bhuvan: Performance check — confirm `/optimize` responds within a few seconds
- [ ] Swetalin: Client-side check + loading state for the optimize call

## Day 30 — Sync
- [ ] Both: Run the full pipeline together against 3–4 trip scenarios; review output quality
- [ ] Swetalin: Fix any Trade-off Ledger entries with missing/unclear reasons

**Deliverable:** ☐ `POST /trips/{id}/optimize` returns a real itinerary with Trade-off Ledger + guardrailed rationale. Matches PRD US-003, US-004, US-005, US-006.

---

**Feature/Part (Day 31–35):** Review/Edit/Approve Workflow (US-007, Must) + Audit Trail (Must)

## Day 31
- [ ] Bhuvan: Design `audit_events` writes (hook into `/optimize` and `/decision`)
- [ ] Swetalin: Approve/Reject UI (reject requires a reason field)

## Day 32
- [ ] Bhuvan: Implement `PATCH /trips/{id}/itinerary` (recalculate total on edit)
- [ ] Swetalin: Edit-line-item UI, live total recalculation

## Day 33
- [ ] Bhuvan: Implement `POST /trips/{id}/decision` (status → `DECIDED`)
- [ ] Swetalin: Wire approve/reject buttons

## Day 34
- [ ] Bhuvan: `GET /audit?trip_id=...` endpoint
- [ ] Swetalin: Audit history view

## Day 35 — Sync
- [ ] Both: Confirm audit events capture everything needed to reconstruct "what happened and why"
- [ ] Swetalin: Test the full review→edit→approve flow manually

**Deliverable:** ☐ Full itinerary lifecycle working: generate → review → edit → approve/reject, with audit trail.

---

**Feature/Part (Day 36–40):** Itinerary Result UI polish — the Trade-off Ledger (US-004) as a real, demo-ready screen, closes out Month 2 "Core features"

## Day 36
- [ ] Bhuvan: Backend support for UI-driven query needs (e.g. sorting ledger by price)
- [ ] Swetalin: Refine Day 0 wireframe for this screen against real API data (30 min); build Trade-off Ledger panel component

## Day 37
- [ ] Bhuvan: Review data completeness (every alternative has price + reason)
- [ ] Swetalin: Build budget/constraint flag components

## Day 38
- [ ] Swetalin: Rationale display component

## Day 39
- [ ] Bhuvan: Fix any backend gaps found during UI integration
- [ ] Swetalin: Full itinerary result page assembly

## Day 40 — Sync (End of Month 2)
- [ ] Both: Demo the full result page together against 2–3 saved trips; polish
- [ ] Swetalin: End-of-month-2 commit

**Deliverable:** ☐ Demo-ready itinerary review screen. Matches official Month 2 theme "Core features."

---

**Feature/Part (Day 41–45):** Trip Knowledge Assistant v1 (US-08, Must) — document ingestion + RAG retrieval + cited Q&A

## Day 41
- [ ] Bhuvan: `documents` + `document_chunks` migrations (pgvector column)
- [ ] Swetalin: Install `pypdf`; standalone script extracting text from a sample PDF

## Day 42
- [ ] Bhuvan: Write sample knowledge documents (per `09_Mock_Data_Spec.md` §3)
- [ ] Swetalin: Implement chunking logic

## Day 43
- [ ] Swetalin: Implement embedding + storing chunks (`POST /documents`)

## Day 44
- [ ] Bhuvan: Review chunk quality against sample documents
- [ ] Swetalin: Implement pgvector similarity search for a question

## Day 45 — Sync
- [ ] Both: Test retrieval quality together — right chunk for an obvious question?
- [ ] Swetalin: Implement `POST /assistant/ask` with citation + "not covered" fallback

**Deliverable:** ☐ Upload a document, ask a question, get a cited answer. Matches PRD US-08.

---

**Feature/Part (Day 46–50):** Ask This Itinerary (US-09, Should) + authorization/security hardening around it

## Day 46
- [ ] Bhuvan: Write trip-ownership-check FastAPI dependency; apply to all trip-scoped routes
- [ ] Swetalin: Design the itinerary-scoped retrieval (what counts as "this itinerary's own data")

## Day 47
- [ ] Bhuvan: Audit trip-scoped endpoints for missing auth checks
- [ ] Swetalin: Implement `POST /trips/{id}/ask`

## Day 48
- [ ] Bhuvan: Fix any gaps found in Day 46 review
- [ ] Swetalin: Ensure responses clearly labeled itinerary-scoped vs. knowledge-base

## Day 49
- [ ] Bhuvan: Write authz integration tests (a user can't access another user's trip)
- [ ] Swetalin: Quick wireframe (15 min) refining the assistant chat panel with the mode toggle; build Ask This Itinerary UI

## Day 50 — Sync
- [ ] Both: Verify a logged-in user genuinely cannot see another user's trip data
- [ ] Swetalin: Test a few "why not the earlier flight?"-style questions

**Deliverable:** ☐ Ask This Itinerary working, clearly distinguished from general assistant; authorization holes closed.

---

**Feature/Part (Day 51–55):** Dashboard (US-010, Should) + Eval Harness + Security Review, plus What-If Simulator (US-011, Could/stretch) only if on schedule

## Day 51
- [ ] Bhuvan: `GET /dashboard` aggregation query
- [ ] Swetalin: Quick wireframe (15 min) refining dashboard against real metrics; build Dashboard UI

## Day 52
- [ ] Bhuvan: Build accuracy eval harness (cost-consistency, ledger completeness checks)
- [ ] Swetalin: Build RAG citation eval set (WikiQA-style triples)

## Day 53
- [ ] Bhuvan: Security review — secrets, auth, input validation pass
- [ ] Swetalin: Accessibility pass on forms/dashboard

## Day 54
- [ ] Bhuvan (if on schedule): `POST /trips/{id}/preview` — What-If Simulator
- [ ] Swetalin (if on schedule): What-If diff UI

## Day 55 — Sync
- [ ] Both: Go/no-go decision on stretch goals based on actual progress
- [ ] Swetalin: Run the full eval harness; record results into `25_Project_Score.md`

**Deliverable:** ☐ Dashboard live, eval numbers captured, security reviewed, stretch goals attempted only if on schedule.

---

**Feature/Part (Day 56–60):** Deployment, Demo Video, Final Documentation Pass — Submission Deliverables (no PRD feature; wraps up all of Month 3 "AI & Deploy")

## Day 56
- [ ] Bhuvan: Set up Render/Railway backend + Postgres; configure env vars
- [ ] Swetalin: Set up Vercel frontend deployment

## Day 57
- [ ] Bhuvan: Run Alembic migrations against production DB; seed mock data
- [ ] Swetalin: Point frontend at production API URL; smoke test

## Day 58
- [ ] Both: Fix any deploy-specific bugs (env var mismatches, CORS)

## Day 59
- [ ] Both: Record demo video walkthrough (shared or split by workstream)

## Day 60 — Final Sync
- [ ] Both: Final full walkthrough together against the live deployment; submit per `24_Submission_Checklist.md`
- [ ] Swetalin: Final docs pass — update `25_Project_Score.md` with real numbers

**Deliverable:** ☐ Live, working deployment; demo video; all submission checklist items complete.

---

# Master Checklist

## A. PRD Features (Must/Should/Could)
- [ ] Traveler management — **Must** (US-001)
- [ ] Trip request creation — **Must** (US-002)
- [ ] Flight/Stay search — **Must**
- [ ] Budget & constraint check — **Must** (US-005)
- [ ] Itinerary composition — **Must** (US-003)
- [ ] Trade-off Ledger — **Must** (US-004)
- [ ] Explainable rationale — **Must** (US-006)
- [ ] Review/edit/approve — **Must** (US-007)
- [ ] Trip Knowledge Assistant — **Must** (US-08)
- [ ] Audit trail — **Must**
- [ ] Ask This Itinerary — **Should** (US-09)
- [ ] Dashboard — **Should** (US-010)
- [ ] Streaming assistant responses — **Could**
- [ ] What-If Simulator — **Could (stretch)** (US-011)
- [ ] Multi-agent expansion — **Stretch**

## B. Infrastructure & Setup
- [ ] GitHub repo created, both team members as collaborators
- [ ] Docker Compose (Postgres + pgvector, backend)
- [ ] Next.js app shell (App Router, TypeScript, Tailwind, shadcn/ui)
- [ ] FastAPI skeleton
- [ ] Auth: JWT issuance/verification, RBAC (Member/Admin)
- [ ] DB schema + Alembic migrations for all tables (`users`, `travelers`, `trips`, `itineraries`, `tradeoff_ledger_entries`, `decisions`, `audit_events`, `documents`, `document_chunks`)
- [ ] Mock flight data seeded (`data/mock_flights.json`)
- [ ] Mock hotel data seeded (`data/mock_hotels.json`)
- [ ] Sample knowledge documents ready
- [ ] `.env.example`, `.gitignore`, `README.md`
- [ ] GitHub Actions CI (backend tests + frontend type check)
- [ ] Frontend deployed (Vercel)
- [ ] Backend + DB deployed (Render or Railway)

## C. UI/UX Wireframing
- [ ] Trip Request Form — wireframed Day 0
- [ ] Itinerary Result View — wireframed Day 0, refined Day 36
- [ ] Trip Knowledge Assistant chat panel — wireframed Day 0, refined Day 49
- [ ] Dashboard — wireframed Day 0, refined Day 51
- [ ] Login/Register forms — wireframed Day 6
- [ ] What-If diff UI — wireframed Day 54 (only if stretch goal attempted)

## D. Testing & Quality
- [ ] Unit tests: budget/constraint check logic, total-cost recalculation
- [ ] Integration tests: all API endpoints (happy path + documented error cases)
- [ ] Pipeline test: LangGraph response structure (not exact LLM prose)
- [ ] Guardrail test: cost-consistency check fails correctly on bad input
- [ ] RAG citation eval set built and run
- [ ] Frontend component tests: trip form, review/approve flow, chat panel
- [ ] Security review complete (secrets, auth, input validation)
- [ ] Accessibility pass on forms/dashboard

## E. Submission Deliverables
- [ ] PRD Submission (confirm date with mentor — `17_Risk_Register.md` R-004)
- [ ] GitHub Submission (full `docs/` kit + working repo skeleton)
- [ ] Viva 1
- [ ] Viva 2
- [ ] Viva 3
- [ ] Project Demo Video (recorded against deployed instance)
- [ ] Deployment Link (live, working)
- [ ] External Final Viva
- [ ] Open item resolved: where is the "Complete Documentation" file? (`17_Risk_Register.md` R-007)
- [ ] Open item resolved: does the submitted PRD PDF need correcting? (`17_Risk_Register.md` R-009/R-010)


---


<!-- ===== FILE: 28_Master_Build_Prompt.md ===== -->

# Master Build Prompt — AI Trip Optimizer

*Copy everything below this line and paste it as your first message to a fresh Claude Code session in a new project folder. It is fully self-contained — Claude does not need any other file from this repo to start building.*

---

## What You're Building

**AI Trip Optimizer** — a B2B web app a business uses to plan and optimize trips for its own people. It is **not** a consumer trip planner (like Expedia) and **not** a policy-compliance engine — it's a workspace where a team member submits a trip request, an AI pipeline searches mock flight/hotel data, checks it against budget/constraints, and produces an itinerary with a fully transparent, structured explanation of *why* it chose what it chose. A human always reviews and approves/rejects — nothing auto-finalizes. Separately, there's a RAG-grounded "Trip Knowledge Assistant" that answers travel-policy questions from uploaded documents, with citations.

**Product goal (verbatim from the approved PRD):** Create a trip-planning workspace that converts a trip request into an optimized, budget-checked, explainable itinerary and answers travel-related questions with cited evidence, without ever finalizing a decision on its own.

**Product principles — apply these to every feature you build:**
- Evidence before explanation (show the data before/alongside the prose).
- Human-in-the-loop (nothing auto-finalizes; approve/reject is always explicit).
- Clear uncertainty (the assistant visibly distinguishes a cited answer from "not covered").
- No unsupported financial claims (every number the AI states must already exist elsewhere in the response — never invented).
- Every AI output is traceable to data/model context.

Build this as a **working, runnable local demo** — Next.js frontend + FastAPI backend + Postgres (with pgvector) via Docker Compose, seeded with mock data, with every Must-have feature below functional end-to-end. Ask me clarifying questions only if something here is genuinely ambiguous; otherwise scaffold and implement incrementally, and tell me exactly how to run it when you're done with each phase.

---

## Tech Stack (use exactly this)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| Styling/UI | Tailwind CSS + shadcn/ui |
| Data fetching | TanStack React Query |
| Frontend validation | Zod |
| Backend | FastAPI (Python) |
| ORM | SQLModel |
| Migrations | Alembic |
| DB driver | psycopg2-binary (sync) |
| Database | PostgreSQL + `pgvector` extension |
| AI orchestration | LangGraph + `langchain-core` + `langchain-openai` (not the full `langchain` meta-package) |
| LLM | OpenAI `gpt-4o-mini` to start (swappable behind one interface) |
| PDF parsing | `pypdf` (pure Python, no OS-level dependency) |
| Auth | `passlib[bcrypt]` + `python-jose[cryptography]` — hand-rolled JWT, not a full auth framework |
| Testing | `pytest` + `httpx` (backend), component tests (frontend) |
| Local dev | Docker Compose (Postgres + backend together) |

**Backend `requirements.txt`:** fastapi, uvicorn[standard], sqlmodel, psycopg2-binary, alembic, passlib[bcrypt], python-jose[cryptography], langgraph, langchain-core, langchain-openai, pgvector, pypdf, pytest, httpx, python-dotenv

**Frontend deps:** next, react, react-dom, typescript, tailwindcss, @tanstack/react-query, zod, plus shadcn/ui via its CLI

**Deliberately do NOT install:** the full `langchain` meta-package, Celery/RQ/Redis (no job queue needed), a general auth framework like `fastapi-users`, heavier PDF tools like `pdfplumber`/`unstructured`.

---

## Repo Structure

```
backend/        FastAPI app, SQLModel models, Alembic migrations, LangGraph pipeline
frontend/       Next.js app
data/           mock_flights.json, mock_hotels.json, sample knowledge documents
docker-compose.yml
.env.example
README.md
```

---

## Database Schema (PostgreSQL + pgvector)

**users** — id (UUID PK), email (unique), hashed_password, role (enum: member/admin), created_at

**travelers** — id (UUID PK), name, preferences (jsonb), created_by (FK → users)

**trips** — id (UUID PK), traveler_id (FK → travelers), dates (daterange), budget (numeric), preferences (jsonb), status (enum: DRAFT/OPTIMIZING/OPTIMIZED/UNDER_REVIEW/DECIDED/OPTIMIZATION_FAILED), created_by (FK → users), created_at

**itineraries** — id (UUID PK), trip_id (FK → trips), flight_option (jsonb), stay_option (jsonb), total_cost (numeric, code-computed, NEVER LLM-generated), rationale (text, LLM-generated), created_at

**tradeoff_ledger_entries** — id (UUID PK), itinerary_id (FK → itineraries), alternative (jsonb, one candidate option considered), price (numeric), won (boolean), reason (text, specific structured reason)

**decisions** — id (UUID PK), trip_id (FK → trips), decided_by (FK → users), outcome (enum: APPROVED/REJECTED), reason (text, required when REJECTED), decided_at

**audit_events** — id (UUID PK), trip_id (FK → trips, nullable), event_type (text, e.g. PIPELINE_RUN/DECISION/DOCUMENT_UPLOAD), payload (jsonb), created_at

**documents** — id (UUID PK), title, uploaded_by (FK → users), uploaded_at

**document_chunks** — id (UUID PK), document_id (FK → documents), chunk_text (text), embedding (vector(1536), pgvector column)

**Relationships:** users 1—N travelers, travelers 1—N trips, trips 1—1 itineraries (one active itinerary per trip — What-If previews don't persist unless approved), itineraries 1—N tradeoff_ledger_entries, trips 1—N decisions (append-only), trips 1—N audit_events, documents 1—N document_chunks.

Every schema change must be an Alembic migration file — no manual/ad-hoc schema edits.

---

## API Endpoints

**Auth:** `POST /auth/register`, `POST /auth/login` (returns JWT)

**Travelers:** `POST /travelers`, `GET /travelers`, `DELETE /travelers/{id}` (409 if traveler has existing trips)

**Trips:**
- `POST /trips` — create; status starts DRAFT
- `GET /trips/{id}` — detail incl. current itinerary + status
- `GET /trips` — list, filterable by status
- `POST /trips/{id}/optimize` — runs the LangGraph pipeline; returns itinerary + Trade-off Ledger + budget/constraint result; sets status OPTIMIZING → OPTIMIZED or OPTIMIZATION_FAILED
- `PATCH /trips/{id}/itinerary` — edit a line item; recalculates total cost server-side
- `POST /trips/{id}/decision` — body `{outcome: "APPROVED"|"REJECTED", reason?: string}`; reason required when rejecting; sets status DECIDED
- `POST /trips/{id}/preview` *(stretch)* — What-If Simulator; body: one changed input; re-runs pipeline with `persist:false`, returns a diff without saving

**Knowledge Assistant:**
- `POST /documents` — upload (multipart); triggers pypdf extraction → chunk → embed
- `GET /documents` — list
- `POST /assistant/ask` — body `{question: string}`; cited answer or explicit "not covered"
- `POST /trips/{id}/ask` — Ask This Itinerary; body `{question: string}`; answers grounded in that trip's own itinerary/audit data only

**Dashboard & Audit:**
- `GET /dashboard?period=...` — total spend, average savings, average turnaround time
- `GET /audit?trip_id=...` — audit event history

**Conventions:** errors return `{detail: string}` with standard HTTP codes (401/403 auth, 404 missing, 409 conflict, 422 validation). All monetary figures in `/trips/{id}/optimize` are code-computed — the LLM's `rationale` field must never introduce a number not already present elsewhere in the response.

---

## GenAI Architecture

There are **two separate AI surfaces** — don't conflate them.

### 1. LangGraph Optimization Pipeline

**State (TypedDict):** trip request (dates/budget/preferences), candidate flight/stay options found, budget/constraint check result, final composed itinerary.

**Nodes:**
1. `search_node` — pure Python, queries mock flight/hotel data. No LLM call.
2. `check_node` — pure Python, deterministically checks each candidate against budget/constraint rules. No LLM call — this is what keeps "why it failed budget" trustworthy and reproducible.
3. `compose_node` — the **only** LLM call. Use `.with_structured_output()` (via `langchain-openai`) so the model returns a typed object: `{rationale: str, tradeoff_ledger: [{alternative, price, won, reason}]}`. The prompt must pass the code-computed totals explicitly and instruct the model to never introduce a different number.

**Why one LLM call, not one per candidate:** keeps latency to a few seconds and cost predictable — deterministic logic evaluates candidates; only the final explanation needs the LLM.

**Guardrail (must implement):** before returning the response, validate that every dollar figure in `rationale` matches a value already present in the structured response. On mismatch, treat it as a pipeline failure (set status `OPTIMIZATION_FAILED`) — never silently return an inconsistent answer.

### 2. RAG — Trip Knowledge Assistant

Standard RAG pattern (grounded in Lewis et al., RAG paper arXiv:2005.11401):
1. **Ingest:** uploaded document → `pypdf` text extraction → chunk (~500 tokens, with overlap) → embed each chunk → store in `document_chunks.embedding` (pgvector).
2. **Retrieve:** embed the question → pgvector cosine similarity search → top-k chunks.
3. **Generate:** pass retrieved chunks + question to the LLM with an explicit instruction: answer only from the provided chunks, cite the source document/chunk, and say "not covered" if the chunks don't actually answer the question.

### 3. Ask This Itinerary (itinerary-scoped RAG)

Same retrieve-then-generate pattern, but the retrieval source is a single trip's own stored data (itinerary, Trade-off Ledger entries, audit events) — not the general knowledge base. The response must make clear which source it drew from.

### Prompting principles (apply to both surfaces)
- Evidence before explanation — retrieved/computed facts go into the prompt context before the model explains.
- Structured output over free-form prose wherever the UI needs to render specific fields.
- Explicit "I don't know" instruction — tell the model directly to decline rather than guess when evidence is insufficient.

### LLM-specific security
- Prompt injection via uploaded documents: system prompt must explicitly separate instructions from retrieved content; retrieved chunks are never treated as instructions.
- The cost/rationale guardrail above is the primary trust mechanism — treat mismatches as failures, not soft warnings.

---

## Mock Data

**`data/mock_flights.json`** — records like:
```json
{"id": "FL-1001", "origin": "BLR", "destination": "DEL", "departure_time": "2026-10-12T06:15:00", "arrival_time": "2026-10-12T08:45:00", "airline": "Sample Air", "price": 6200, "cabin_class": "economy", "stops": 0}
```
Include multiple price points per route (budget vs. premium), at least one red-eye and one daytime option, a mix of direct/connecting — so the Trade-off Ledger has genuinely different rejection reasons (price, timing, stops), not just one dimension.

**`data/mock_hotels.json`** — records like:
```json
{"id": "HT-2001", "city": "DEL", "name": "Sample Central Hotel", "price_per_night": 3800, "rating": 4.2, "amenities": ["wifi", "breakfast_included"], "distance_to_center_km": 1.5}
```
Spread across budget/mid/premium tiers per city used in flight data.

**Sample knowledge documents:** at least one visa/entry-requirements summary, one travel-policy document (e.g. "flights over ₹X require manager approval"), one general FAQ (baggage, expense process) — short (1–3 pages), ingestable via the pypdf pipeline.

**Volume:** at least 3–4 flight options and 3–4 hotel options per route/city used in the demo — enough for non-trivial reasoning, not a full production catalog.

---

## UI/UX — Core Screens

**Trip Request Form** — traveler selection (or create new), dates, budget, preferences (free text + structured tags). Submit creates a DRAFT trip.

**Itinerary Result View** *(the most important screen)*:
- Chosen flight + stay + total cost, shown as data first.
- **Trade-off Ledger panel** — every alternative considered, with price and a one-line structured reason (won/lost + why). This is the core differentiator UI — a first-class panel, not an accordion afterthought.
- Budget/constraint flags — each issue visibly tagged with the specific rule and offending line item, not buried in prose.
- Rationale text — references the specific chosen items, never states a number not already shown above it.
- Approve / Reject (reason required) / Edit line item (recalculates total live).

**Trip Knowledge Assistant (chat panel)** — general mode (knowledge base) and itinerary-scoped mode ("Ask This Itinerary") must be visually distinct (e.g. a mode toggle) so the user always knows which source is being queried. Every answer shows its citation inline, or an explicit "I don't have information on that" state.

**Dashboard (Admin)** — total spend, average savings, average turnaround time for a selected period; link through to full audit history rather than duplicating it.

**What-If Simulator (stretch, build only if time remains)** — side-by-side/diff view: original vs. previewed change, changed fields highlighted, explicit "Save this instead" action.

**Component library:** Tailwind CSS + shadcn/ui — copy components into the project rather than building from scratch. Baseline accessibility (label associations, keyboard nav, contrast) on forms/dashboard.

---

## Auth & Security

- Two roles only: **Member** (create/manage own trips/travelers, use both assistant modes) and **Admin** (also: dashboard aggregates, knowledge-document management).
- Hand-rolled JWT: `passlib[bcrypt]` for hashing, `python-jose[cryptography]` for issuance/verification.
- Every `/trips/{id}/...` endpoint must verify the requesting user has access to that trip — implement as a reusable FastAPI dependency, not repeated inline per route.
- All secrets in `.env` (never committed); `.env.example` documents required keys with empty placeholders.
- Pydantic/SQLModel validates all input server-side (source of truth); Zod mirrors client-side for UX only.

---

## Product States

`DRAFT → OPTIMIZING → OPTIMIZED → UNDER_REVIEW → DECIDED`, with failure state `OPTIMIZATION_FAILED`.

---

## Full Feature List (build Must-haves first, in this order)

| Feature | Priority | User story |
|---|---|---|
| Traveler management | Must | US-001: add/list/delete a traveler; can't delete one with existing trips |
| Trip request creation | Must | US-002: create a trip, status starts DRAFT |
| Flight/Stay search | Must | (part of the pipeline `search_node`) |
| Itinerary composition | Must | US-003: generate an optimized itinerary with flights, stay, total cost, returned in a few seconds |
| Trade-off Ledger | Must | US-004: every alternative shown with price + specific won/lost reason |
| Budget & constraint check | Must | US-005: each issue names the specific rule + offending line item, visibly flagged |
| Explainable rationale | Must | US-006: rationale references specific chosen items; never states an unmatched cost figure |
| Review/edit/approve | Must | US-007: editing recalculates total; approve → DECIDED; reject requires a stored reason |
| Trip Knowledge Assistant | Must | US-08: cited answer, or explicit "not covered" if not in any document |
| Audit trail | Must | every pipeline run and decision writes an audit_events row |
| Ask This Itinerary | Should | US-09: answers about one specific itinerary, using its own data; never confused with knowledge-base answers |
| Dashboard | Should | US-010: total spend, average savings, average turnaround for a period; audit history independently intact |
| Streaming assistant responses | Could | nice-to-have, not required for MVP |
| What-If Simulator | Could (stretch) | US-011: preview a changed input without losing the original; explicit diff shown |

**Stretch, in priority order (only after all Must/Should work end-to-end):** (1) What-If Simulator, (2) multi-agent expansion — splitting `compose_node` into coordinating `FlightAgent`/`StayAgent`/`BudgetConstraintsAgent`/`ComposerAgent` nodes with an `Orchestrator`.

**Explicitly out of scope for this demo:** mobile-native app, offline mode, multi-language UI, live/real supplier data (mock data only), production-grade rate limiting/WAF, formal security certification.

---

## Suggested Build Order

1. **Foundation:** repo structure, Docker Compose (Postgres+pgvector, backend), Next.js shell, FastAPI skeleton with `/health`, confirm both run side by side.
2. **Auth:** `users` table + migration, register/login, JWT issuance/verification, protected routes on the frontend.
3. **Core CRUD:** `travelers` + `trips` tables/migrations/endpoints, seed `data/mock_flights.json` + `data/mock_hotels.json`, build the Trip Request Form and trip list/detail UI.
4. **Optimization pipeline:** LangGraph state + 3 nodes (`search_node`, `check_node`, `compose_node`), the cost-consistency guardrail, wire `POST /trips/{id}/optimize`, persist `itineraries` + `tradeoff_ledger_entries`.
5. **Review workflow:** `PATCH /trips/{id}/itinerary`, `POST /trips/{id}/decision`, `audit_events` writes, approve/reject/edit UI.
6. **Itinerary Result UI:** build out the full Trade-off Ledger panel, budget/constraint flags, rationale display — this screen matters most.
7. **Knowledge Assistant:** `documents`/`document_chunks` tables, ingestion pipeline (pypdf → chunk → embed), `POST /assistant/ask`, chat UI.
8. **Ask This Itinerary:** itinerary-scoped retrieval, `POST /trips/{id}/ask`, trip-ownership authorization checks, mode-toggle UI.
9. **Dashboard:** `GET /dashboard` aggregation, Dashboard UI.
10. **Polish & stretch (if time remains):** What-If Simulator, security/accessibility pass, tests.
11. **Wrap-up:** README with setup/run instructions, confirm the whole flow works end-to-end from a clean `docker compose up`.

## Definition of Done for This Demo

- `docker compose up` brings up Postgres (with pgvector) + backend; `npm run dev` runs the frontend.
- A user can register, log in, add a traveler, create a trip, run the optimizer, see a real Trade-off Ledger with genuinely different won/lost reasons, edit a line item, approve or reject with a reason, and see it in the audit history.
- The Trip Knowledge Assistant answers a question from an uploaded sample document with a citation, and says "not covered" for something outside the documents.
- Ask This Itinerary answers a question about one specific trip's own data, clearly distinguished from the knowledge-base assistant.
- Every dollar figure the LLM states matches a number already computed in code — verify this holds by testing at least one deliberately awkward trip (tight budget, multiple close-priced options).


---
