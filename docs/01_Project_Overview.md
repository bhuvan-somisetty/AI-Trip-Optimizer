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

*(Amended 2026-09-16 — Trip Knowledge Assistant and Ask This Itinerary removed entirely; the instructor said RAG is not needed. See `03_PRD.md` amendment and `17_Risk_Register.md` R-011.)*

AI Trip Optimizer is a B2B decision-support workspace a business uses to plan and optimize trips for its own people. It ingests a trip request, searches mock flight and hotel data, checks the options against budget and constraints, and produces an optimized, explainable itinerary — with a structured trade-off breakdown — for a human to review, edit, and approve.

The platform is intentionally a **decision-support system, not an autonomous booking agent** — a human always reviews and approves the final itinerary; the system never finalizes a decision on its own.

## Core Product Flow
Trip request → traveler & trip details captured → LangGraph pipeline searches mock flight/hotel data → budget & constraint check → itinerary composition with Trade-off Ledger → human review/edit → approve or reject (with reason) → decision/audit record.

## MVP
*(Renumbered 2026-09-09 after removing CO2-aware optimization and Knowledge document upload as scored items — see amendment note above. Renumbered again 2026-09-16 after removing the Trip Knowledge Assistant.)*
1. Traveler management (add/select travelers per trip).
2. Trip request creation (dates, budget, preferences; starts in DRAFT status).
3. Flight/Stay search against mock supplier data.
4. Budget & constraint check, with each issue naming the specific rule and offending line item.
5. Itinerary composition (flights, stay, total cost).
6. Trade-off Ledger — every alternative considered, with its price and the specific reason it won or lost.
7. Review/edit/approve workflow (editing recalculates total cost; reject requires a stored reason).
8. Audit trail of every pipeline run and decision.

## Should-Have (built alongside MVP where feasible)
- Ops dashboard — total spend, average savings, average turnaround time for a selected period.

## Out of Scope for MVP
- Autonomous booking or payment — the system never finalizes a trip decision itself.
- Real GDS/supplier integrations or live pricing APIs.
- Real employee PII or production payment data.
- Streaming assistant responses (Could-have, not MVP).
- What-If Simulator (Could-have/stretch — build only after the MVP pipeline works end-to-end).
- Multi-agent pipeline expansion (explicit stretch goal in the project brief, not an MVP requirement — the MVP is a single two-stage LangGraph pipeline).
- Training a custom LLM from scratch.
- RAG-based question answering (Trip Knowledge Assistant, Ask This Itinerary) — cut from scope per instructor instruction, see `03_PRD.md` amendment.
