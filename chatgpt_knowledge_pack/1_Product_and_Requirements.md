

<!-- ===== FILE: 00_Investigation_Report.md ===== -->

# Investigation & Strategy Report

> **Provenance:** A6 (reference docs) and A3/A4 draw directly from the official brief/PRD. Everything else — problem framing, assumed constraints (A5), competitor analysis (A7), stretch-goal sequencing (A19) — is the team's own research and judgment, not instructor-provided.

## A1. Purpose
This report captures the market research, feasibility reasoning, and strategic decisions behind AI Trip Optimizer, ahead of writing the PRD/BRD. It is the "why" behind scope decisions referenced elsewhere in the docs kit (the PRD's Feature Priorities table points back to sections A7 and A19 here).

## A2. Problem Space
Businesses that send employees on trips today either use a heavyweight enterprise travel-management platform (built for large procurement teams) or handle it manually over email/spreadsheets. Neither gives a mid-sized team a fast, explainable way to see *why* one itinerary beats another against a budget.

## A3. Target User
Internal teams at a business who plan trips for their own people — a "team member" role that creates and reviews trips, and an "admin" role that manages the shared knowledge base and views spend/turnaround analytics. Confirmed end users per the project brief: **Businesses**.

## A4. Product Concept
A B2B decision-support tool: submit a trip request → a LangGraph pipeline searches mock flight/hotel data, checks budget/constraints, composes an explainable itinerary → a human reviews and approves. A separate RAG-grounded assistant answers travel questions from uploaded documents. The system never books or finalizes anything autonomously.

## A5. Assumed Constraints (team's inference, not stated on the brief sheet)
- No live GDS/supplier API access or budget assumed — mock/sample flight and hotel data only. Inferred from the PRD's "without ever finalizing a decision on its own" principle and the general absence of any booking-API budget for a student project — not a literal instruction anywhere in the brief or PRD.
- 12-week build window (confirmed via the instructor's separate milestone deadline table — see `15_Roadmap.md`), 2-person student team (confirmed via the PRD's two listed team members), first substantial GenAI project (the team's own context).
- Must use the officially mandated stack: React/Next.js, FastAPI, PostgreSQL (brief field `tech_stack`), LangGraph (brief field `framework`).

## A6. Reference Materials (per project brief)
- Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (arXiv:2005.11401) — the RAG pattern behind the Trip Knowledge Assistant.
- "Enterprise Knowledge Base & WikiQA" dataset (Microsoft Research) — style reference for building the assistant's evaluation set.

## A7. Competitor Landscape and Differentiator Rationale
The corporate/business travel management space has established players, each with a real gap this project's Must-have features target directly:

| Competitor | Strength | Gap this project targets |
|---|---|---|
| **SAP Concur** | Deep enterprise expense/policy compliance | Enforces policy but doesn't expose a structured "why" — no per-alternative trade-off breakdown |
| **Navan (formerly TripActions)** | Modern UI, AI travel "concierge" | Concierge leans conversational/booking-assist, not an auditable, structured trade-off ledger |
| **TravelPerk** | Strong for SMEs, flexible cancellation | Optimization is largely rule-based filtering, not an explainable AI pipeline with reasoning |
| **Egencia (Amex GBT)** | Deep enterprise integrations | Heavy, sales-led onboarding; not self-serve or transparent about recommendation logic |

**Three differentiators** *(amended 2026-09-09 — was four; CO2-aware optimization cut per instructor instruction, see `03_PRD.md` amendment note)*, chosen because they close a real gap above and need no new infrastructure beyond the mandated stack:

| Feature | Status | Rationale |
|---|---|---|
| Trade-off Ledger | Must | Every rejected alternative states its specific losing reason — none of the competitors reviewed (`19_Competitor_Analysis.md`) expose this |
| Ask This Itinerary | Should | Assistant answers grounded in *one specific* itinerary's own audit data, not just the general knowledge base |
| What-If Simulator | Could (stretch) | Live re-optimization diff without saving — none of the competitors reviewed expose this to an end user directly |

## A8–A18. (Reserved)
Sections A8–A18 are reserved for deeper technical feasibility notes (data volume estimates, LLM cost modeling, latency budgets) to be filled in as Month 1 implementation surfaces real numbers — intentionally left thin at planning time rather than filled with placeholder estimates.

## A19. Stretch Goal Sequencing Rationale
Referenced by the PRD's Feature Priorities table. Build order, cheapest/most demo-visible first:
1. **What-If Simulator** — reuses the existing optimize pipeline with a `persist:false` flag; no new architecture.
2. **Multi-agent expansion** — splitting the single pipeline into coordinating Flight/Stay/Constraints/Composer agents under one orchestrator. Explicit stretch goal in the project brief, not an MVP requirement. Attempt only after the single-pipeline MVP works end-to-end.

## A20. Decision
Proceed with the B2B, single-pipeline-MVP concept described in `01_Project_Overview.md`, scoped exactly to the instructor-approved PRD (`03_PRD.md`).


---


<!-- ===== FILE: 01_Project_Overview.md ===== -->

# AI Trip Optimizer — Project Overview

## Project Identity
*Fields below marked "brief" are verbatim from the official project brief sheet; "PRD" fields are from the instructor-approved PRD; unmarked notes are engineering judgment, not official requirements.*
- **Title (brief):** AI Trip Optimizer
- **Track (brief):** GenAI
- **Industry / Theme (brief):** Travel
- **Course covered (brief):** DSA, DBMS, Fullstack
- **Core learning goals (brief):** AI + Full Stack
- **Expected output (brief):** Working app
- **Problem statement (brief, verbatim):** "Build an enterprise-grade AI solution for AI Trip Optimizer addressing key operational efficiency and automation challenges in the Travel sector."
- **Duration:** 12 weeks (confirmed via the instructor's milestone deadline table, not a labeled "duration" field on the brief sheet itself)
- **Team:** 2 students (Bhuvan Somisetty, Swetalin Rout — per PRD)
- **Primary/end users (brief):** Businesses
- **Skill level:** Not an official field on the brief sheet — noted here only because this is the team's first substantial GenAI project (their own context, not an instructor-assigned label)
- **Operating constraint (engineering judgment, not sourced from the brief):** No live GDS/supplier API access assumed — mock/sample flight and hotel data only, consistent with "no autonomous booking" in the PRD's product principles

## Delivery Format: Web Application, Not a Native Mobile App
This is a **website (web application)**, accessed through a browser — not a native iOS/Android app. This follows directly from the officially mandated stack: `Next.js` is a web framework, not `React Native` (which builds native mobile apps). The brief's `expected_output` field says "Working app," but that's generic terminology for "application," not a literal instruction to build a mobile app. Nothing in the brief or PRD requires a native app, app-store distribution, or offline mobile support.

## Executive Summary
*(Amended 2026-09-09 — CO2-aware optimization removed per instructor instruction; see `17_Risk_Register.md` R-009.)*

AI Trip Optimizer is a B2B decision-support workspace a business uses to plan and optimize trips for its own people. It ingests a trip request, searches mock flight and hotel data, checks the options against budget and constraints, and produces an optimized, explainable itinerary — with a structured trade-off breakdown — for a human to review, edit, and approve.

The platform is intentionally a **decision-support system, not an autonomous booking agent** — a human always reviews and approves the final itinerary; the system never finalizes a decision on its own. A separate RAG-grounded Trip Knowledge Assistant answers travel-related questions with citations, drawn from documents the business uploads (upload is an implementation detail of this feature, not a separately scored one — see MVP list below).

## Core Product Flow
Trip request → traveler & trip details captured → LangGraph pipeline searches mock flight/hotel data → budget & constraint check → itinerary composition with Trade-off Ledger → human review/edit → approve or reject (with reason) → decision/audit record.

Separately: a question to the Trip Knowledge Assistant → retrieval from the uploaded knowledge base (or a specific itinerary's own data, for "Ask This Itinerary") → a cited, evidence-grounded answer.

## MVP
*(Renumbered 2026-09-09 after removing CO2-aware optimization and Knowledge document upload as scored items — see amendment note above.)*
1. Traveler management (add/select travelers per trip).
2. Trip request creation (dates, budget, preferences; starts in DRAFT status).
3. Flight/Stay search against mock supplier data.
4. Budget & constraint check, with each issue naming the specific rule and offending line item.
5. Itinerary composition (flights, stay, total cost).
6. Trade-off Ledger — every alternative considered, with its price and the specific reason it won or lost.
7. Review/edit/approve workflow (editing recalculates total cost; reject requires a stored reason).
8. Trip Knowledge Assistant with citations (says so explicitly if a question isn't covered by any ingested document). Document ingestion is a required implementation detail of this feature, not its own scored line item.
9. Audit trail of every pipeline run and decision.

## Should-Have (built alongside MVP where feasible)
- Ask This Itinerary — the assistant answers questions grounded in one specific itinerary's own data and audit trail, distinct from knowledge-base answers.
- Ops dashboard — total spend, average savings, average turnaround time for a selected period.

## Out of Scope for MVP
- Autonomous booking or payment — the system never finalizes a trip decision itself.
- Real GDS/supplier integrations or live pricing APIs.
- Real employee PII or production payment data.
- Streaming assistant responses (Could-have, not MVP).
- What-If Simulator (Could-have/stretch — build only after the MVP pipeline works end-to-end).
- Multi-agent pipeline expansion (explicit stretch goal in the project brief, not an MVP requirement — the MVP is a single two-stage LangGraph pipeline).
- Training a custom LLM from scratch.


---


<!-- ===== FILE: 02_BRD.md ===== -->

# Business Requirements Document (BRD)

> **Provenance:** §7's requirement list is built directly from the PRD's Must/Should/Could feature table and user stories. Personas, use cases, NFRs, and the risk table are the team's own design layered on top of that. Evaluation metric *names* in §9 (Accuracy, UX) are official (brief field `evaluation_metrics`); their specific operationalization is the team's own.

## 1. Executive Summary
Businesses that send employees on trips need to compare flight and hotel options, check them against budget and internal rules, and be able to explain why a given itinerary was chosen — today this is manual, slow, and offers no structured "why." AI Trip Optimizer automates the search, budget/constraint check, and explanation, while keeping a human reviewer in control of every decision.

## 2. Problem Statement
Teams planning business trips manually compare flights and hotels against a budget and unwritten preferences, with no structured record of what was considered or why an option was rejected. This project accelerates that process while keeping a human approver in control of every itinerary.

## 3. Vision
Build an AI-assisted trip-planning workspace that converts a trip request into structured, auditable evidence — a ranked set of options, a budget/constraint verdict, and an explainable itinerary recommendation — plus a document-grounded assistant for travel questions.

## 4. Objectives
- Reduce manual comparison effort for a simulated business trip-planning workflow.
- Search mock flight/hotel data and check results against budget and constraints deterministically.
- Produce a structured Trade-off Ledger — not just prose — showing why each alternative won or lost.
- Generate an evidence-grounded itinerary rationale that never states a cost figure inconsistent with the code-computed total.
- Maintain an auditable history of every pipeline run and human decision.
- Answer travel-related questions with citations, from an uploaded knowledge base and from a specific itinerary's own data.

## 5. Personas
| Persona | Goals | Pain Points |
|---|---|---|
| Team Member (trip requester) | Get a budget-fitting itinerary quickly, with a trustworthy reason for the recommendation | Manually comparing flights/hotels and budget rules is slow and offers no structured "why" |
| Admin | Oversee spend, turnaround time, and the shared knowledge base across the team | No traceable history of past decisions; no easy way to answer recurring travel-policy questions |

## 6. Business Use Cases
- Add a traveler and create a trip request (dates, budget, preferences).
- Generate an optimized itinerary from mock flight/hotel data.
- View the Trade-off Ledger for a generated itinerary (every alternative considered, with price and win/loss reason).
- View budget/constraint issues, each naming the specific rule and offending line item.
- Edit an itinerary line item (recalculates total cost) and approve or reject it (rejection requires a reason).
- Ask the Trip Knowledge Assistant a travel-related question and receive a cited answer. *(Document upload into the shared knowledge base is a required implementation detail behind this use case, not a separately scored feature — see amendment note in `03_PRD.md`.)*
- Ask a question about one specific itinerary ("why not the earlier flight?") and receive an answer grounded in that itinerary's own data.
- Retrieve audit history of pipeline runs and decisions.
- View dashboard: total spend, average savings, average turnaround time for a selected period.

## 7. Business Requirements
| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| BR-001 | User can add a traveler and select them on a trip | Must | Traveler saved with name/preferences; selectable on trip creation; cannot be deleted if they have existing trips |
| BR-002 | User can create a trip request | Must | Trip receives a unique ID; dates/budget/preferences captured; status starts DRAFT |
| BR-003 | System generates an optimized itinerary | Must | Includes flights, stay, and total cost; budget/constraint result returned alongside it; response within a few seconds |
| BR-004 | System shows why one option was chosen over another | Must | Every alternative listed with price; every rejected alternative states its specific losing reason (price/budget/constraint/preference); winning reason stated in the same structured form |
| BR-005 | System flags budget/constraint issues clearly | Must | Each issue names the specific rule and offending line item; visibly flagged, not buried in prose |
| BR-006 | System generates an explainable rationale | Must | Rationale references the specific flights/stay chosen and the budget/constraint result; never states a cost figure inconsistent with the code-computed total |
| BR-007 | User can edit and approve/reject an itinerary | Must | Editing a line item recalculates total cost; approve sets status DECIDED and records the decision; reject requires a stored reason |
| BR-008 | User can ask a travel question and get a cited answer | Must | Answer cites the specific source document/chunk; assistant states when a question isn't covered instead of guessing |
| BR-009 | User can ask questions about a specific itinerary | Should | Answered using that itinerary's own data/audit trail; response is clearly distinguished from knowledge-base answers |
| BR-010 | Admin can view spend/turnaround history | Should | Dashboard shows total spend, average savings, average turnaround for a selected period; audit history persists independent of the dashboard view |
| BR-011 | User can preview a changed itinerary without saving | Could (stretch) | Changing one input and previewing returns a comparable itinerary; original is untouched until explicitly approved; UI shows what changed |

## 8. Non-Functional Requirements
- **Security:** role-based access (Member, Admin); no live GDS/supplier credentials or real employee PII handled.
- **Performance:** itinerary generation targets a response within a few seconds, per PRD acceptance criteria (US-003).
- **Auditability:** every pipeline run and human decision is retained in the audit trail, independent of any single dashboard view.
- **Explainability/Traceability:** every AI output must be traceable to the underlying data/model context (product principle); no unsupported financial claims.
- **Reliability:** a failed optimization run enters an explicit `OPTIMIZATION_FAILED` state rather than silently erroring.
- **Cost:** mock supplier data and a small/efficient LLM to start, to keep the project runnable on a student budget.

## 9. Success Metrics
Directly from the project brief's evaluation metrics — **Accuracy, UX** — operationalized as:
- Rationale/cost-figure consistency rate (target: 100% match with the code-computed total, per product principle).
- Trade-off Ledger coverage — percentage of generated itineraries where every alternative has a stated reason.
- Trip Knowledge Assistant citation coverage and "don't know" rate on out-of-scope questions.
- Median itinerary generation turnaround time.
- Human approval vs. rejection rate, and average savings shown on the dashboard.

## 10. Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| LLM states a cost/rationale figure inconsistent with the computed total | Medium | High | Compute totals in code, never let the LLM invent numbers; validate rationale against computed values before display |
| RAG assistant answers without real grounding (hallucination) | Medium | High | Require citations on every answer; explicit "not covered" fallback when retrieval confidence is low |
| Mock flight/hotel data too thin or unrealistic to demo well | Medium | Medium | Build out a reasonably sized, varied mock dataset early (Month 1), not as an afterthought |
| Deadline risk — PRD (Aug 30) and GitHub (Sept 6) submission dates may already be passed | Medium | High | Confirm current schedule with mentor immediately; prioritize Week 1 scaffolding over further planning docs |
| 2-person team runs out of time for stretch goals (multi-agent, What-If Simulator) | High | Low | Stretch goals are explicitly deprioritized below all Must/Should items; cut first if behind schedule |

## 11. MVP Scope
*(Amended 2026-09-09: CO2-aware optimization and Knowledge document upload removed as scored features per instructor instruction — see `03_PRD.md` amendment note and `17_Risk_Register.md` R-009.)*

**In scope:** traveler/trip CRUD, mock flight/hotel search, deterministic budget & constraint check, LangGraph-driven itinerary composition, Trade-off Ledger, review/edit/approve workflow, RAG-grounded Trip Knowledge Assistant with citations (document ingestion included as an implementation detail), audit trail, Ask This Itinerary, dashboard.

**Out of scope:** autonomous booking/payment, live GDS/supplier integrations, real employee PII or production payment data, streaming responses, What-If Simulator, multi-agent pipeline expansion, training a custom LLM from scratch, CO2-aware optimization, standalone knowledge-document-upload as a scored feature.

## 12. Future Scope
- What-If Simulator — live re-optimization diff without saving (stretch goal #1).
- Multi-agent expansion — splitting the pipeline into coordinating Flight/Stay/Constraints/Composer agents under one orchestrator (stretch goal #2, explicit in the project brief).
- Streaming assistant responses.
- Real supplier/GDS integrations.
- Richer analytics and policy-compliance reporting.


---


<!-- ===== FILE: 03_PRD.md ===== -->

# Product Requirements Document (PRD)

*This is the instructor-approved PRD, transcribed from `AI Trip Optimizer — PRD final.pdf`, with one amendment below.*

> **Amendment (2026-09-09) — correcting an oversight in the approved PDF, not a new scope change:** The instructor's actual instruction was to remove two **user stories** (old US-005, "CO2 alongside cost," and old US-009, "upload a knowledge document") from an earlier 13-story draft — confirmed by directly diffing that draft against this approved PDF. Both stories were correctly removed. But the corresponding rows in the **Feature Priorities table** — "CO2-aware optimization" and "Knowledge document upload" — should have been removed at the same time and were not; that was a mistake made when finalizing this PDF, not a second instruction from the instructor. This amendment corrects the table below to match what the instructor actually asked for. **The PDF file itself (`AI Trip Optimizer — PRD final.pdf`) still contains the stale rows and was not corrected** — see `17_Risk_Register.md` R-009 for whether that needs fixing/resubmitting. Note: "Trip Knowledge Assistant" remains Must-have and functionally still requires *some* way to ingest documents — that upload mechanism is kept as an implementation detail of the Assistant feature, just no longer tracked as its own separately-scored line item.

## Product Goal
Create a trip-planning workspace that converts a trip request into an optimized, budget-checked, explainable itinerary and answers travel-related questions with cited evidence, without ever finalizing a decision on its own.

## Feature Priorities
| Feature | Priority |
|---|---|
| Traveler management | Must |
| Trip request creation | Must |
| Flight/Stay search | Must |
| Budget & constraint check | Must |
| Itinerary composition | Must |
| Trade-off Ledger | Must |
| Review/edit/approve | Must |
| Trip Knowledge Assistant | Must |
| Audit trail | Must |
| Ask This Itinerary | Should |
| Dashboard | Should |
| Streaming assistant responses | Could |
| What-If Simulator | Could (stretch) |

**Stretch goals, in priority order:** (1) What-If Simulator, (2) multi-agent expansion — splitting the optimization pipeline into coordinating Flight/Stay/Constraints/Composer agents. Full rationale for both is in the Investigation & Strategy Report, sections A7 and A19.

## User Stories

### US-001
As a team member, I want to add a traveler so that I can track a trip on their behalf.

**Acceptance criteria**
- Traveler is saved with a name and any stated preferences.
- Traveler is selectable when creating a trip request.
- A traveler with existing trips cannot be deleted.

### US-002
As a team member, I want to create a trip request so that the optimizer has something to work from.

**Acceptance criteria**
- Trip receives a unique ID.
- Trip metadata (dates, budget, preferences) can be captured.
- Trip status starts as DRAFT.

### US-003
As a team member, I want the system to generate an optimized itinerary so that I don't have to manually compare options.

**Acceptance criteria**
- Itinerary includes flights, stay, and a total cost.
- A budget/constraint check result is returned alongside it.
- Result is returned directly in the response, within a few seconds.

### US-004
As a team member, I want to see why one option was chosen over another so that I trust the result instead of just accepting a black box.

**Acceptance criteria**
- Each alternative the pipeline considered is listed with its price.
- Each rejected alternative states the specific reason it lost (price, budget, constraint, or preference).
- The chosen option's reason for winning is stated in the same structured form, not only in prose.

### US-005
As a team member, I want budget and constraint issues clearly flagged so that I can see why an itinerary does or doesn't fit.

**Acceptance criteria**
- Each issue names the specific rule and the offending line item.
- Issues are visibly flagged, not buried in prose.

### US-006
As a team member, I want an explainable rationale so that I understand why the system produced this itinerary.

**Acceptance criteria**
- Rationale references the specific flights/stay chosen and the budget/constraint result.
- Rationale never states a cost figure that doesn't match the code-computed total.

### US-007
As a team member, I want to edit and approve or reject an itinerary so that human judgment is preserved.

**Acceptance criteria**
- Editing a line item recalculates the total cost.
- Approve sets trip status to DECIDED and records the decision.
- Reject requires a reason, which is stored with the decision.

### US-08
As any team member, I want to ask a travel-related question and get a cited answer so that I don't have to search documents myself.

**Acceptance criteria**
- Answer cites the specific source document/chunk.
- If the answer isn't covered by any ingested document, the assistant says so instead of guessing.

### US-09
As a team member, I want to ask questions about my specific itinerary so that I understand its reasoning without re-reading the whole trade-off ledger myself.

**Acceptance criteria**
- Given an existing itinerary, questions like "why not the earlier flight?" are answered using that itinerary's own data and audit trail.
- The assistant does not confuse itinerary-specific answers with knowledge-base answers — each response is clear about its source.

### US-010
As an admin, I want spend and turnaround history so that the team's workflow is traceable.

**Acceptance criteria**
- Dashboard shows total spend, average savings, and average turnaround time for a selected period.
- Every decision and pipeline run remains in the audit history, independent of the dashboard view.

### US-011 (stretch)
As a team member, I want to preview a changed itinerary without losing the original so that I can compare before committing.

**Acceptance criteria**
- Changing one input (budget or a preference) and previewing returns a comparable itinerary.
- The original saved itinerary is untouched until the preview is explicitly approved.
- The UI shows what changed between the two, not just the new result on its own.

## Product States
`DRAFT → OPTIMIZING → OPTIMIZED → UNDER_REVIEW → DECIDED`

**Failure state:** `OPTIMIZATION_FAILED`

## Product Principles
- Evidence before explanation.
- Human-in-the-loop.
- Clear uncertainty.
- No unsupported financial claims.
- Every AI output is traceable to data/model context.

**Team members:** Bhuvan Somisetty, Swetalin Rout


---


<!-- ===== FILE: 04_TRD.md ===== -->

# Technical Requirements Document (TRD)

> **Provenance:** §2 lists the officially mandated stack (brief fields `tech_stack` + `framework`) verbatim. Every other requirement (performance targets, reliability, security specifics) is the team's own technical judgment applied on top of the PRD's acceptance criteria.

## 1. Purpose
Translates the BRD/PRD's business and product requirements into concrete technical requirements — the constraints and non-functional targets engineering must meet.

## 2. Mandated Stack (from project brief — non-negotiable)
- **Frontend:** React / Next.js
- **Backend:** FastAPI
- **Database:** PostgreSQL
- **AI orchestration framework:** LangGraph

Full stack table with rationale for every supporting choice lives in `22_Tech_Stack_and_Libraries.md`.

## 3. Architecture Style
A conventional 3-tier web app (Next.js frontend → FastAPI backend → PostgreSQL) with one addition: the backend hosts a LangGraph pipeline invoked synchronously from the itinerary-generation endpoint, and a RAG retrieval path (pgvector) invoked from the assistant endpoints. No separate microservices, no message queue — deliberately, for a 2-person team on a 12-week timeline (see ADR-006 in `18_Architecture_Decision_Records.md`).

## 4. Data Requirements
- Relational data (travelers, trips, itineraries, decisions, audit events) in standard Postgres tables.
- Vector embeddings for knowledge-document chunks stored in the same Postgres instance via the `pgvector` extension — one database serves both relational and vector search (see `06_Database_Design.md`).
- Mock flight/hotel supplier data as seed data (see `09_Mock_Data_Spec.md`); no live supplier API calls.

## 5. Performance Requirements
- Itinerary generation: response returned within a few seconds (PRD US-003 acceptance criteria) — meaning the LangGraph pipeline runs synchronously within the HTTP request/response cycle for the MVP, not as a background job.
- Assistant answers: no hard latency target in the PRD; streaming responses are explicitly a Could-have, meaning a simple blocking response is acceptable for MVP.

## 6. Reliability Requirements
- A failed optimization run must land in the explicit `OPTIMIZATION_FAILED` state (PRD Product States), not raise an unhandled 500 with no trace.
- Every pipeline run and human decision persists to the audit trail regardless of what the dashboard currently displays (PRD US-010).

## 7. Security Requirements
- Role-based access: Member and Admin roles only (2 roles — no need for a general-purpose auth framework; see ADR-003).
- JWT-based auth (`passlib[bcrypt]` + `python-jose[cryptography]`); secrets stored in `.env`, never committed (`.env.example` documents required keys with no real values).
- No real employee PII or production payment data — mock/synthetic data only, per Out-of-Scope in `01_Project_Overview.md`.

## 8. Accuracy / Correctness Requirements
- The LLM must never state a cost figure inconsistent with the code-computed total (PRD US-006, product principle "no unsupported financial claims") — totals are always computed in code and passed to the LLM as context, never generated by it.
- Every Trip Knowledge Assistant answer must cite its source document/chunk, or explicitly state the question isn't covered (PRD US-08).

## 9. Deployment Requirements
- Frontend: Vercel. Backend + Postgres: Render or Railway (free-tier friendly for a student project).
- Local development: Docker Compose bringing up Postgres (with pgvector) + backend together, so both team members share one dev setup regardless of OS.

## 10. Traceability
Every technical requirement above maps back to a PRD user story or product principle — see the cross-references inline. No technical requirement here introduces scope beyond what `03_PRD.md` and `02_BRD.md` already define.


---
