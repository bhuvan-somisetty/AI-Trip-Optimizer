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
