# Architecture Decision Records (ADRs)

> **Provenance:** Every ADR below documents the team's own technical decision-making. None of these specific choices (auth approach, PDF library, job-queue decision, etc.) are mandated by the brief or PRD — only the 4 stack technologies and LangGraph are official (see `04_TRD.md` §2).

Short, numbered records of decisions that could plausibly have gone another way — so the reasoning is preserved, not just the outcome.

## ADR-001: Single Postgres instance for both relational and vector data
**Decision:** Use `pgvector` inside the mandated PostgreSQL database rather than a dedicated vector DB (Pinecone, Weaviate, etc.).
**Why:** The stack (PostgreSQL) is already mandated by the project brief; adding a second database is unnecessary operational complexity for a 2-person team, and `pgvector` is mature enough for the data volumes here (a handful of knowledge documents, not millions of vectors).
**Status:** Accepted.

## ADR-002: (see ADR-001 — merged, no separate vector DB)
*(Number reserved to keep IDs stable if this list is extended; ADR-001 covers the decision.)*

## ADR-003: Hand-rolled JWT auth instead of a full auth framework
**Decision:** Use `passlib[bcrypt]` + `python-jose[cryptography]` directly rather than `fastapi-users` or similar.
**Why:** Only 2 roles (Member, Admin) are required. A full framework adds configuration surface and abstractions to learn that don't pay for themselves at this scale, for a first-time GenAI/backend team.
**Status:** Accepted.

## ADR-004: Deterministic budget/constraint checks in code, not the LLM
**Decision:** The `check_node` in the LangGraph pipeline is pure Python, not an LLM call.
**Why:** Budget/constraint rules need to be reproducible and auditable — an LLM re-deriving "is $6,200 under a $6,000 budget" is both unnecessary and a trust risk. The LLM's role is explaining a result computed elsewhere, not computing it.
**Status:** Accepted — directly enforces the PRD principle "no unsupported financial claims."

## ADR-005: One LLM call per itinerary generation, not one per candidate
**Decision:** A single structured-output LLM call in `compose_node` produces both the rationale and the full Trade-off Ledger.
**Why:** Keeps latency within the PRD's "a few seconds" target and keeps per-request cost predictable; candidate evaluation itself is deterministic and doesn't need per-candidate LLM calls.
**Status:** Accepted.

## ADR-006: No job queue (Celery/RQ/Redis) for the MVP
**Decision:** The optimization pipeline runs synchronously within the HTTP request.
**Why:** The PRD requires a response within a few seconds, which a synchronous call comfortably meets at this data scale; introducing a queue adds infrastructure and failure modes (worker crashes, queue backlogs) disproportionate to the actual latency problem.
**Status:** Accepted — revisit only if real latency measurements exceed the target.

## ADR-007: `langchain-core` + one provider package, not the full `langchain` meta-package
**Decision:** Install `langchain-core` and `langchain-openai` specifically, not the umbrella `langchain` package.
**Why:** The umbrella package pulls in many integrations the project doesn't use, bloating dependency resolution and install time for no benefit.
**Status:** Accepted.

## ADR-008: `pypdf` for PDF text extraction
**Decision:** Use `pypdf` over `pdfplumber` or `unstructured`.
**Why:** Pure Python, no OS-level dependency (e.g. Poppler) to install separately — the most accessible option for a beginner 2-person team on Windows/macOS mixed environments. The project only needs plain text extraction, not table/layout preservation.
**Status:** Accepted.
