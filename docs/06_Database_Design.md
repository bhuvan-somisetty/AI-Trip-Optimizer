# Database Design

> **Amended 2026-09-09:** `itineraries.co2_estimate_kg` removed — CO2-aware optimization was cut per instructor instruction. See `03_PRD.md` amendment note.

> **Provenance:** Entirely the team's own schema design. PostgreSQL is the only officially mandated database technology (brief field `tech_stack`); the specific tables, columns, and use of `pgvector` are engineering choices, not instructor-specified.

## 1. Engine
PostgreSQL with the `pgvector` extension enabled — one database serves both relational tables and vector similarity search, so no second vector database is needed (see ADR-002).

## 2. Core Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | text, unique | |
| hashed_password | text | via passlib/bcrypt |
| role | enum(`member`, `admin`) | |
| created_at | timestamptz | |

### `travelers`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | text | |
| preferences | jsonb | free-form preference fields |
| created_by | UUID FK → users.id | |

### `trips`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| traveler_id | UUID FK → travelers.id | |
| dates | daterange | |
| budget | numeric | |
| preferences | jsonb | |
| status | enum(`DRAFT`,`OPTIMIZING`,`OPTIMIZED`,`UNDER_REVIEW`,`DECIDED`,`OPTIMIZATION_FAILED`) | mirrors PRD Product States |
| created_by | UUID FK → users.id | |
| created_at | timestamptz | |

### `itineraries`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id | |
| flight_option | jsonb | chosen flight line item |
| stay_option | jsonb | chosen stay line item |
| total_cost | numeric | code-computed, never LLM-generated |
| rationale | text | LLM-generated, references the fields above |
| created_at | timestamptz | |

### `tradeoff_ledger_entries`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| itinerary_id | UUID FK → itineraries.id | |
| alternative | jsonb | one candidate option considered |
| price | numeric | |
| won | boolean | |
| reason | text | specific structured reason, per PRD US-004 |

### `decisions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id | |
| decided_by | UUID FK → users.id | |
| outcome | enum(`APPROVED`,`REJECTED`) | |
| reason | text | required when outcome = REJECTED (PRD US-007) |
| decided_at | timestamptz | |

### `audit_events`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → trips.id, nullable | nullable to also cover non-trip events |
| event_type | text | e.g. `PIPELINE_RUN`, `DECISION`, `DOCUMENT_UPLOAD` |
| payload | jsonb | |
| created_at | timestamptz | |

### `documents`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| title | text | |
| uploaded_by | UUID FK → users.id | |
| uploaded_at | timestamptz | |

### `document_chunks`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| document_id | UUID FK → documents.id | |
| chunk_text | text | |
| embedding | vector(1536) | pgvector column, dimension matches the embedding model used |

## 3. Relationships
`users 1—N travelers`, `travelers 1—N trips`, `trips 1—1 itineraries` (MVP: one active itinerary per trip; What-If Simulator previews do not persist a row unless approved), `itineraries 1—N tradeoff_ledger_entries`, `trips 1—N decisions` (append-only decision history), `trips 1—N audit_events`, `documents 1—N document_chunks`.

## 4. Migrations
Every schema change ships as an Alembic migration file — no manual/ad-hoc schema edits, so both team members and any deployment stay in sync (see `04_TRD.md` §2 and `13_CICD_and_Deployment.md`).

## 5. Notes on the `pgvector` Column
The embedding dimension (1536 above) assumes an OpenAI embedding model; if the provider changes, update the column dimension and re-embed existing chunks — tracked as a migration, not a silent schema drift.
