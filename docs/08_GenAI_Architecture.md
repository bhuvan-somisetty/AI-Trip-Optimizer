# GenAI Architecture

> **Provenance:** The RAG pattern is grounded in the official brief field `reference_docs` (Lewis et al., arXiv:2005.11401) and its named WikiQA-style evaluation approach. The specific LangGraph node design, guardrail implementation, and prompting details below are the team's own design — LangGraph itself is the only officially mandated framework (brief field `framework`).

## 1. Two Separate AI Surfaces
This project has two distinct GenAI components — don't conflate them:
1. The **LangGraph optimization pipeline** (structured, deterministic-checks-plus-LLM-explanation).
2. The **RAG-grounded Trip Knowledge Assistant** (retrieval + cited generation), including its itinerary-scoped variant, "Ask This Itinerary."

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

## 3. RAG — Trip Knowledge Assistant

Standard RAG pattern, following Lewis et al. (arXiv:2005.11401):
1. **Ingest:** uploaded document → `pypdf` text extraction → chunk (e.g. ~500-token chunks with overlap) → embed each chunk → store in `document_chunks.embedding` (pgvector).
2. **Retrieve:** on a question, embed the question, run a pgvector similarity search (cosine distance), take top-k chunks.
3. **Generate:** pass the retrieved chunks plus the question to the LLM with an explicit instruction: answer only from the provided chunks, cite the source document/chunk, and say "not covered" if the retrieved chunks don't actually answer the question (PRD US-08 acceptance criteria).

The assistant's evaluation set should be built in the style of the WikiQA dataset (Microsoft Research) — question/answer/supporting-evidence triples — per the project's reference docs, to make citation accuracy measurable (see `14_Evaluation_Metrics.md`).

## 4. Ask This Itinerary (itinerary-scoped RAG)
Same retrieve-then-generate pattern, but the retrieval source is a single trip's own stored data — its itinerary, Trade-off Ledger entries, and audit events — not the general knowledge base. The response must make clear which source it drew from, so it's never confused with a knowledge-base answer (PRD US-09 acceptance criteria).

## 5. Prompting Principles (apply to both surfaces)
- Evidence before explanation — retrieved/computed facts go into the prompt context before the model is asked to explain.
- Structured output over free-form prose wherever a UI needs to render specific fields (Trade-off Ledger entries, citations).
- Explicit "I don't know" instruction — the model is told directly to decline rather than guess when evidence is insufficient.

## 6. Stretch: Multi-Agent Expansion
If pursued (only after the single pipeline works end-to-end — see `00_Investigation_Report.md` A19), the `compose_node` above splits into a `FlightAgent`, `StayAgent`, `BudgetConstraintsAgent`, and `ComposerAgent`, coordinated by an `Orchestrator` node with conditional routing (e.g., looping back to a specialist when a constraint check fails). This is additive to, not a replacement of, the guardrail described in §2.
