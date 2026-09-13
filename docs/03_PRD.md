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
