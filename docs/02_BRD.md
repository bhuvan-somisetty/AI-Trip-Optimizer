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
