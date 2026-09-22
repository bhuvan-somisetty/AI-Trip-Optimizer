# Security Design

> **Provenance:** Entirely the team's own security design — no security requirements are specified in the brief or PRD beyond the general product principles (e.g. auditability, no unsupported claims).

> **Amended 2026-09-16:** §6's prompt-injection-via-uploaded-documents risk removed — it applied only to the RAG-based Trip Knowledge Assistant, cut from scope per instructor instruction ("RAG is not needed," see `03_PRD.md` amendment, `17_Risk_Register.md` R-011). No document upload exists anymore.

## 1. Authentication
Hand-rolled JWT auth using `passlib[bcrypt]` (password hashing) and `python-jose[cryptography]` (JWT issuance/verification). A full auth framework (e.g. `fastapi-users`) is deliberately not used — with only 2 roles, it adds more surface area to learn and debug than it saves (see ADR-003).

## 2. Authorization
Role-based access control with exactly two roles: **Member** and **Admin**.
- Members can create/manage their own trips and travelers.
- Admin-only: dashboard aggregates.
- Every trip-scoped endpoint (`/trips/{id}/...`) must verify the requesting user has access to that trip — implemented as a FastAPI dependency, not repeated inline per-route.

## 3. Secrets Management
- All secrets (OpenAI API key, DB credentials, JWT signing secret) live in `.env`, loaded via `python-dotenv` locally and via the hosting platform's environment variable settings in deployment.
- `.env.example` documents every required key name with placeholder/empty values — never a real value.
- `.env` is gitignored; verified before every commit (see `13_CICD_and_Deployment.md`).

## 4. Data Handling
- No real employee PII or production payment data is ever handled — synthetic/mock data only (see Out of Scope, `01_Project_Overview.md`). This removes most compliance surface area for a student project.

## 5. Input Validation
- Pydantic/SQLModel schemas validate all API input server-side; Zod schemas mirror them client-side for early feedback, but server-side validation is the actual security boundary (client-side is UX only).

## 6. LLM-Specific Risks
- **Cost/rationale mismatch (not a security issue but a trust one):** enforced via the guardrail in `08_GenAI_Architecture.md` §2 — any mismatch fails the pipeline rather than returning an inconsistent answer.

## 7. Out of Scope
Penetration testing, formal security certification, production-grade rate limiting/WAF — not required for a student OJT MVP; flagged here so it's a documented decision, not an oversight.
