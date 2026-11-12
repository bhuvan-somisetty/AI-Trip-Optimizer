# Database Design

> **Amended 2026-09-09:** `itineraries.co2_estimate_kg` removed — CO2-aware optimization was cut per instructor instruction. See `03_PRD.md` amendment note.

> **Amended 2026-09-16:** `documents` and `document_chunks` tables removed, and the `pgvector` extension dropped — the instructor cut the RAG-based Trip Knowledge Assistant / Ask This Itinerary from scope ("RAG is not needed," see `03_PRD.md` amendment, `17_Risk_Register.md` R-011). PostgreSQL alone (no vector extension) now covers every remaining table.

> **Provenance:** Entirely the team's own schema design. PostgreSQL is the only officially mandated database technology (brief field `tech_stack`); the specific tables and columns are engineering choices, not instructor-specified.

## 1. Engine
PostgreSQL. No vector extension is needed — every table below is plain relational/JSON data.

## 2. Core Tables (as built)

> **Amended 2026-11-12:** this section now describes the schema as built (`backend/app/models.py`), not the original plan. Differences from the plan: trips store `origin`/`destination` IATA codes and `start_date`/`end_date` instead of a `daterange`; the Trade-off Ledger is a JSON column on `itineraries` rather than its own table (it is always read and written whole, with its itinerary); itineraries also keep the run's search results so a reviewer can swap a line item (US-007).

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | text, unique, indexed | |
| hashed_password | text, nullable | bcrypt via passlib; `NULL` for accounts created with Sign in with Google (migration `20261112_100000`), which can't use `/auth/login` |
| role | `member` / `admin` | new accounts are always `member`; admins see every user's audit events |
| created_at | timestamptz | |

### `travelers`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | text | |
| preferences | json | free-form preference fields |
| created_by | UUID FK → users.id, indexed | owner; other users get 404 |

### `trips`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| traveler_id | UUID FK → travelers.id, indexed | |
| origin, destination | varchar(3) | IATA airport codes, e.g. `BLR`, `DEL` |
| start_date, end_date | date | |
| budget | numeric(12,2) | |
| preferences | json | e.g. `max_stops`, `cabin`, `min_hotel_rating` |
| status | `DRAFT`, `OPTIMIZING`, `OPTIMIZED`, `UNDER_REVIEW`, `DECIDED`, `OPTIMIZATION_FAILED` | mirrors PRD Product States, indexed |
| failure_reason | text, nullable | why the last optimizer run failed; cleared on the next run |
| created_by | UUID FK → users.id, indexed | |
| created_at | timestamptz | |

### `itineraries`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id, unique | one itinerary per trip; re-optimizing replaces it (earlier runs stay in `audit_events`) |
| flight | json | chosen outbound flight |
| return_flight | json, nullable | chosen flight back on the end date; `NULL` when no return fare was found (a flag says so) and on itineraries saved before 2026-11-13 (migration `20261113_100000`) |
| hotel | json, nullable | chosen stay; `NULL` for a same-day trip |
| total_cost | numeric(12,2) | outbound + return + stay, code-computed, never LLM-generated |
| savings | numeric(12,2), nullable | PRD US-010: per line item, the median price of the options that met every rule minus the chosen price, summed (`14_Evaluation_Metrics.md`); `NULL` on itineraries saved before 2026-11-13 |
| within_budget | boolean | |
| flags | json | budget/constraint issues, each naming the rule and the line item (US-005) |
| rationale | text | LLM-written, checked against the computed numbers before it is saved (US-006) |
| tradeoff_ledger | json | every option considered: `kind`, `alternative`, `price`, `won`, `reason` (US-004) |
| search_results | json, nullable | the run's outbound, return and hotel options, so a line item can be swapped, or a What-If previewed, without searching again (migration `20261112_110000`) |
| picked | json | line items (`flight` / `return` / `stay`) a reviewer swapped in by hand |
| created_at | timestamptz | |

### `decisions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id | |
| decided_by | UUID FK → users.id | |
| outcome | `APPROVED` / `REJECTED` | |
| reason | text | required when outcome = REJECTED (PRD US-007) |
| decided_at | timestamptz | |

### `audit_events`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id, nullable | nullable to also cover non-trip events (traveler changes) |
| user_id | UUID FK → users.id | who did it — added when built (2026-11-11) so admins can see who acted and members only see their own events |
| event_type | text | `TRAVELER_CREATED`, `TRAVELER_UPDATED`, `TRAVELER_DELETED`, `TRIP_CREATED`, `PIPELINE_RUN`, `PIPELINE_FAILED`, `REVIEW_STARTED`, `ITINERARY_EDITED`, `DECISION` |
| summary | text | one readable line — added when built (2026-11-11), e.g. "Optimized BLR→DEL: total 11,667, within budget 25,000" |
| payload | jsonb | the details: what was chosen and why for a pipeline run (with `run_ms`), before/after for a traveler update or an edit, etc. |
| created_at | timestamptz | |

Built 2026-11-11 (migration `20261111_100000`). Append-only: no endpoint edits or deletes these rows. Each event is written in the same transaction as the action it records.

## 3. Relationships
`users 1—N travelers`, `travelers 1—N trips`, `trips 1—1 itineraries`, `trips 1—N decisions` (append-only decision history), `trips 1—N audit_events`, `users 1—N audit_events`.

## 4. Migrations
Every schema change ships as an Alembic migration file — no manual/ad-hoc schema edits, so both team members and any deployment stay in sync (see `04_TRD.md` §2 and `13_CICD_and_Deployment.md`).

| Migration | What it does |
|---|---|
| `20260916_151547` | `users` |
| `20260917_162509` | `travelers` |
| `20260921_100000` | `trips` |
| `20260927_100000` | index on `travelers.created_by` |
| `20261007_100000` | `trips.origin` / `trips.destination` |
| `20261008_100000` | `itineraries` |
| `20261008_110000` | `decisions` |
| `20261111_100000` | `audit_events` |
| `20261112_100000` | nullable `users.hashed_password`, for Sign in with Google |
| `20261112_110000` | `itineraries.search_results` and `itineraries.picked`, for line-item edits |
| `20261112_120000` | aligns an `audit_events` table made by an earlier draft (production only; does nothing on a fresh database) |
| `20261113_100000` | `itineraries.return_flight` and `itineraries.savings`, for round-trip totals and the savings metric |

Production (Neon) is at `20261112_120000` until `20261113_100000` is applied, which has to happen before the backend with return flights is deployed. Vercel doesn't run migrations, so they are applied by hand before a backend deploy (`13_CICD_and_Deployment.md`).
