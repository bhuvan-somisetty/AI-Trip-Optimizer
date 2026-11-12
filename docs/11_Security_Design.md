# Security Design

> **Provenance:** Entirely the team's own security design — no security requirements are specified in the brief or PRD beyond the general product principles (e.g. auditability, no unsupported claims).

> **Amended 2026-09-16:** §6's prompt-injection-via-uploaded-documents risk removed — it applied only to the RAG-based Trip Knowledge Assistant, cut from scope per instructor instruction ("RAG is not needed," see `03_PRD.md` amendment, `17_Risk_Register.md` R-011). No document upload exists anymore.

## 1. Authentication
Hand-rolled JWT auth using `passlib[bcrypt]` (password hashing) and `python-jose[cryptography]` (JWT issuance/verification). A full auth framework (e.g. `fastapi-users`) is deliberately not used — with only 2 roles, it adds more surface area to learn and debug than it saves (see ADR-003).

- Tokens are HS256, signed with `JWT_SECRET`, and expire after 24 hours. The token carries the user id and role.
- **Sign in with Google** (added 2026-11-12): the browser gets an ID token from Google Identity Services and sends it to `POST /auth/google`. The backend verifies its signature, audience (`GOOGLE_CLIENT_ID`) and expiry with `google-auth`, requires a verified email, then finds or creates the user and returns the same JWT as a password login. No Google access token or client secret is ever stored. Accounts created this way have no password, and `/auth/login` refuses them.

## 2. Authorization
Role-based access control with exactly two roles: **Member** and **Admin**.
- Members can create/manage their own trips and travelers.
- Admin-only: seeing every user's audit events (`GET /audit`); members see only their own.
- Every trip-scoped endpoint (`/trips/{id}/...`) verifies the requesting user owns that trip — implemented as the `get_owned_trip` FastAPI dependency, not repeated inline per-route. Someone else's trip or traveler returns **404, not 403**, so the API doesn't reveal which IDs exist. Tested in `test_trips.py`, `test_travelers.py`, `test_edit_itinerary.py` and `test_audit.py`.
- New accounts are always `member`; the register endpoint takes no role (an earlier draft let a caller pick `admin`).

## 3. Secrets Management
- All secrets (OpenAI API key, DB credentials, JWT signing secret) live in `.env`, loaded via `python-dotenv` locally and via the hosting platform's environment variable settings in deployment.
- `.env.example` documents every required key name with placeholder/empty values — never a real value.
- `.env` is gitignored; verified before every commit (see `13_CICD_and_Deployment.md`).
- In production every secret (`JWT_SECRET`, `DATABASE_URL`, `OPENAI_API_KEY`, `TRAVELPAYOUTS_TOKEN`, `SERPAPI_API_KEY`) is a Vercel **sensitive** environment variable: write-only, it can't be read back from the dashboard or `vercel env pull`. `GOOGLE_CLIENT_ID` is public by design.
- CORS only allows the deployed frontend's origin (`CORS_ORIGINS`) and localhost in development.

## 4. Data Handling
- No real employee PII or production payment data is ever handled — synthetic/mock data only (see Out of Scope, `01_Project_Overview.md`). This removes most compliance surface area for a student project.
- Fares and hotel prices come from public price feeds (Travelpayouts, Google Hotels via SerpApi); nothing is booked or paid for.
- The data a user enters (traveler names and preferences) is only visible to that user, and to admins through the audit trail. The live site's privacy policy is at `/privacy`.

## 5. Input Validation
- Pydantic/SQLModel schemas validate all API input server-side; Zod schemas mirror them client-side for early feedback, but server-side validation is the actual security boundary (client-side is UX only).

## 6. LLM-Specific Risks
- **Cost/rationale mismatch (not a security issue but a trust one):** enforced via the guardrail in `08_GenAI_Architecture.md` §2 — any number in the LLM's rationale that isn't one of the computed figures fails the run rather than returning an inconsistent answer (`test_compose_fails_when_llm_invents_a_number`). On a line-item edit the template rationale is used instead.
- **Prompt content:** the LLM only sees the computed facts (chosen options, totals, flags, ledger reasons), never user credentials or other users' data. It writes prose only; it cannot change a price, a pick or a status.

## 7. Out of Scope
Penetration testing, formal security certification, production-grade rate limiting/WAF — not required for a student OJT MVP; flagged here so it's a documented decision, not an oversight.
