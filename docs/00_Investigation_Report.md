# Investigation & Strategy Report

> **Provenance:** A6 (reference docs) and A3/A4 draw directly from the official brief/PRD. Everything else — problem framing, assumed constraints (A5), competitor analysis (A7), stretch-goal sequencing (A19) — is the team's own research and judgment, not instructor-provided.

## A1. Purpose
This report captures the market research, feasibility reasoning, and strategic decisions behind AI Trip Optimizer, ahead of writing the PRD/BRD. It is the "why" behind scope decisions referenced elsewhere in the docs kit (the PRD's Feature Priorities table points back to sections A7 and A19 here).

## A2. Problem Space
Businesses that send employees on trips today either use a heavyweight enterprise travel-management platform (built for large procurement teams) or handle it manually over email/spreadsheets. Neither gives a mid-sized team a fast, explainable way to see *why* one itinerary beats another against a budget.

## A3. Target User
Internal teams at a business who plan trips for their own people — a "team member" role that creates and reviews trips, and an "admin" role that manages the shared knowledge base and views spend/turnaround analytics. Confirmed end users per the project brief: **Businesses**.

## A4. Product Concept
A B2B decision-support tool: submit a trip request → a LangGraph pipeline searches mock flight/hotel data, checks budget/constraints, composes an explainable itinerary → a human reviews and approves. The system never books or finalizes anything autonomously. ~~A separate RAG-grounded assistant answers travel questions from uploaded documents.~~ *(That RAG-grounded assistant — Trip Knowledge Assistant / Ask This Itinerary — was cut from scope by the instructor 2026-09-16, "RAG is not needed." See `03_PRD.md` amendment, `17_Risk_Register.md` R-011. Kept here struck through for the historical record of the original concept.)*

## A5. Assumed Constraints (team's inference, not stated on the brief sheet)
- No live GDS/supplier API access or budget assumed — mock/sample flight and hotel data only. Inferred from the PRD's "without ever finalizing a decision on its own" principle and the general absence of any booking-API budget for a student project — not a literal instruction anywhere in the brief or PRD.
- 12-week build window (confirmed via the instructor's separate milestone deadline table — see `15_Roadmap.md`), 2-person student team (confirmed via the PRD's two listed team members), first substantial GenAI project (the team's own context).
- Must use the officially mandated stack: React/Next.js, FastAPI, PostgreSQL (brief field `tech_stack`), LangGraph (brief field `framework`).

## A6. Reference Materials (per project brief)
- Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (arXiv:2005.11401) — the RAG pattern originally behind the Trip Knowledge Assistant.
- "Enterprise Knowledge Base & WikiQA" dataset (Microsoft Research) — style reference originally for building the assistant's evaluation set.

*(Note 2026-09-16: the brief's `reference_docs` field named this RAG paper, so RAG was a reasonable original reading of the brief — but the instructor later gave a direct verbal instruction that RAG is not needed, cutting the Trip Knowledge Assistant/Ask This Itinerary from scope. See `03_PRD.md` amendment and `17_Risk_Register.md` R-011. Kept here for the historical record of why RAG was originally chosen.)*

## A7. Competitor Landscape and Differentiator Rationale
The corporate/business travel management space has established players, each with a real gap this project's Must-have features target directly:

| Competitor | Strength | Gap this project targets |
|---|---|---|
| **SAP Concur** | Deep enterprise expense/policy compliance | Enforces policy but doesn't expose a structured "why" — no per-alternative trade-off breakdown |
| **Navan (formerly TripActions)** | Modern UI, AI travel "concierge" | Concierge leans conversational/booking-assist, not an auditable, structured trade-off ledger |
| **TravelPerk** | Strong for SMEs, flexible cancellation | Optimization is largely rule-based filtering, not an explainable AI pipeline with reasoning |
| **Egencia (Amex GBT)** | Deep enterprise integrations | Heavy, sales-led onboarding; not self-serve or transparent about recommendation logic |

**Two differentiators** *(amended 2026-09-09 — was four; CO2-aware optimization cut per instructor instruction, see `03_PRD.md` amendment note. Amended again 2026-09-16 — was three; Ask This Itinerary cut along with the rest of the RAG-based features, "RAG is not needed," see `17_Risk_Register.md` R-011)*, chosen because they close a real gap above and need no new infrastructure beyond the mandated stack:

| Feature | Status | Rationale |
|---|---|---|
| Trade-off Ledger | Must | Every rejected alternative states its specific losing reason — none of the competitors reviewed (`19_Competitor_Analysis.md`) expose this |
| What-If Simulator | Could (stretch) | Live re-optimization diff without saving — none of the competitors reviewed expose this to an end user directly |

## A8–A18. (Reserved)
Sections A8–A18 are reserved for deeper technical feasibility notes (data volume estimates, LLM cost modeling, latency budgets) to be filled in as Month 1 implementation surfaces real numbers — intentionally left thin at planning time rather than filled with placeholder estimates.

## A19. Stretch Goal Sequencing Rationale
Referenced by the PRD's Feature Priorities table. Build order, cheapest/most demo-visible first:
1. **What-If Simulator** — reuses the existing optimize pipeline with a `persist:false` flag; no new architecture.
2. **Multi-agent expansion** — splitting the single pipeline into coordinating Flight/Stay/Constraints/Composer agents under one orchestrator. Explicit stretch goal in the project brief, not an MVP requirement. Attempt only after the single-pipeline MVP works end-to-end.

## A20. Decision
Proceed with the B2B, single-pipeline-MVP concept described in `01_Project_Overview.md`, scoped exactly to the instructor-approved PRD (`03_PRD.md`).
