# GenAI Architecture

> **Provenance:** LangGraph is the only officially mandated framework (brief field `framework`); the node design, guardrail implementation, and prompting details below are the team's own design. The brief field `reference_docs` also names a RAG paper (Lewis et al., arXiv:2005.11401) and a WikiQA-style evaluation approach — those grounded the Trip Knowledge Assistant / Ask This Itinerary features, which the instructor cut from scope 2026-09-16 (see `03_PRD.md` amendment, `17_Risk_Register.md` R-011). This file now covers only the surviving GenAI surface, the optimization pipeline.

## 1. The One GenAI Surface
This project has one GenAI component: the **LangGraph optimization pipeline** (structured, deterministic-checks-plus-LLM-explanation). A RAG-grounded Trip Knowledge Assistant and its itinerary-scoped variant "Ask This Itinerary" were originally planned as a second surface but were removed from scope by the instructor 2026-09-16 ("RAG is not needed") — see `17_Risk_Register.md` R-011.

## 2. LangGraph Optimization Pipeline

### State
A `TypedDict` carrying: the trip request (dates/budget/preferences), the candidate flight/stay options found, the budget/constraint check result, and the final composed itinerary.

### Nodes
1. **`search_node`** — pure Python; queries mock flight/hotel data, no LLM call.
2. **`check_node`** — pure Python; deterministically checks each candidate against budget and constraint rules. No LLM call — this keeps the "why it failed budget" reasoning trustworthy and reproducible.
3. **`compose_node`** — the only LLM call in the pipeline. Uses `.with_structured_output()` (via `langchain-openai`) so the model returns a typed object: `{rationale: str, tradeoff_ledger: [{alternative, price, won, reason}]}`. The prompt explicitly passes the code-computed totals and instructs the model never to introduce a different number.

### Why one LLM call, not one per candidate
Keeps latency within the PRD's "a few seconds" target (US-003) and keeps cost predictable — evaluating candidates is cheap deterministic logic; only the final explanation needs the LLM.

### Guardrail
Before returning the response, the backend validates that every dollar figure in `rationale` matches a value already present in the structured response. A mismatch is treated as a pipeline error (`OPTIMIZATION_FAILED`), not silently returned — this directly enforces the PRD's "no unsupported financial claims" principle.

## 3. Prompting Principles
- Evidence before explanation — computed facts go into the prompt context before the model is asked to explain.
- Structured output over free-form prose wherever a UI needs to render specific fields (Trade-off Ledger entries).
- Explicit "I don't know" instruction is not needed here since the pipeline never asks the model open-ended questions — every generation call is grounded in code-computed candidates and totals (see the guardrail in §2).

## 4. Stretch: Multi-Agent Expansion
If pursued (only after the single pipeline works end-to-end — see `00_Investigation_Report.md` A19), the `compose_node` above splits into a `FlightAgent`, `StayAgent`, `BudgetConstraintsAgent`, and `ComposerAgent`, coordinated by an `Orchestrator` node with conditional routing (e.g., looping back to a specialist when a constraint check fails). This is additive to, not a replacement of, the guardrail described in §2.
