# API Specification

> **Provenance:** All endpoints below are the team's own design, built to satisfy the PRD's user stories and acceptance criteria (cited inline per endpoint). No specific API shape is mandated by the brief or PRD. Route naming (singular `POST /traveler`, `POST /trip` vs. plural `GET`s) is per the instructor's instruction on API conventions, 2026-09-16. Endpoint layout follows the format the instructor showed the team as an example, 2026-09-16/17.

> **Amended 2026-09-16:** `/documents`, `/assistant/ask`, and `/trips/{id}/ask` removed — the instructor cut the RAG-based Trip Knowledge Assistant / Ask This Itinerary from scope ("RAG is not needed"). See `03_PRD.md` amendment and `17_Risk_Register.md` R-011.

FastAPI auto-generates interactive OpenAPI docs at `/docs` once the backend is running — treat that as the live, authoritative spec. This file is the human-readable summary for planning, review, and the viva.

**Labeling:** sections marked **Verified** were captured by actually calling the running backend (against the SQLite dev stand-in) — `app/routers/auth.py` on 2026-09-16, `app/routers/travelers.py` on 2026-09-17, `app/routers/trips.py` on 2026-09-22 — every example JSON in those sections is real output, not invented. Sections marked **Planned** describe endpoints with no backend code yet (the `dashboard` and `audit` routers, and the trip `optimize`/`itinerary`/`decision`/`preview` endpoints, don't exist as of 2026-09-22 — `auth.py`, `travelers.py` and the trip create/list/get endpoints in `trips.py` are built). Their 401/403 examples reuse the exact error strings from the real, already-written `app/security.py` dependencies (`get_current_user` → 401 "Not authenticated" / "Could not validate credentials"; `require_admin` → 403 "Admin access required") since those functions will guard these routes once built. Their 404/400/422 examples are the team's design, grounded in `06_Database_Design.md` and the PRD's acceptance criteria — not yet runnable, but not arbitrary either.

---

## Auth
*(Verified — captured from the live backend, not invented.)*

### POST /auth/register
Creates a user account. Role defaults to `member` if not provided in the request.

**Request:**
```json
{
  "email": "demo.viva@example.com",
  "password": "Trip@2026"
}
```

**Response (201 Created):**
```json
{
  "id": "5023eab5-2f4d-4244-868f-34fb1155ffe0",
  "email": "demo.viva@example.com",
  "role": "member"
}
```

**Response (409 Conflict)** — email already registered:
```json
{
  "detail": "Email already registered"
}
```

**Response (422 Unprocessable Entity)** — malformed email:
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "email"],
      "msg": "value is not a valid email address: An email address must have an @-sign.",
      "input": "not-an-email"
    }
  ]
}
```

**Response (422 Unprocessable Entity)** — missing password field:
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "password"],
      "msg": "Field required",
      "input": { "email": "missing.pw@example.com" }
    }
  ]
}
```

### POST /auth/login
Authenticates a user and returns a JWT.

**Request:**
```json
{
  "email": "demo.viva@example.com",
  "password": "Trip@2026"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDIzZWFiNS0yZjRkLTQyNDQtODY4Zi0zNGZiMTE1NWZmZTAiLCJyb2xlIjoibWVtYmVyIiwiZXhwIjoxNzg5NjYzNTA4fQ.8MB9L-Fag-lJ-zmItPiYtDRCqW1J7VmcUIv5dZ34Rfs",
  "token_type": "bearer"
}
```

**Response (401 Unauthorized)** — wrong password, or unknown email (same message either way, so login can't be used to probe which emails exist):
```json
{
  "detail": "Invalid email or password"
}
```

**Response (422 Unprocessable Entity)** — missing password field:
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "password"],
      "msg": "Field required",
      "input": { "email": "missing.pw@example.com" }
    }
  ]
}
```

---

## Travelers
*(Verified 2026-09-17 — `app/routers/travelers.py` is built and tested end-to-end against the SQLite dev stand-in, not invented. Building this endpoint surfaced and fixed a real bug in `app/security.py`: `get_current_user` was passing the JWT's string `sub` claim straight into `session.get(User, user_id)`, which 500'd on SQLite because it expects an actual `UUID` object — fixed by parsing it with `uuid.UUID(user_id)` first. There are two distinct real 401 messages depending on the cause — shown both below, then abbreviated to one per endpoint after. The 409 "has existing trips" check on delete is not yet implemented since the `trips` table doesn't exist yet — see the `POST /trip` section below.)*

### POST /traveler
Creates a traveler profile, owned by the current logged-in user (PRD US-001). Requires a valid JWT.

**Request:**
```json
{
  "name": "Priya Nair",
  "preferences": { "seat": "aisle", "diet": "veg" }
}
```

**Response (201 Created):**
```json
{
  "id": "48ab69f5-6d03-411f-9062-e96ccfa114cb",
  "name": "Priya Nair",
  "preferences": { "seat": "aisle", "diet": "veg" },
  "created_by": "5023eab5-2f4d-4244-868f-34fb1155ffe0"
}
```

**Response (401 Unauthorized)** — no `Authorization` header at all (FastAPI's `OAuth2PasswordBearer`):
```json
{
  "detail": "Not authenticated"
}
```

**Response (401 Unauthorized)** — header present but the token is malformed/invalid/expired (`get_current_user`):
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (422 Unprocessable Entity)** — missing name field:
```json
{
  "detail": [
    { "type": "missing", "loc": ["body", "name"], "msg": "Field required", "input": {} }
  ]
}
```

### GET /travelers
Lists every traveler created by the current user. Requires a valid JWT.

**Response (200 OK):**
```json
[
  {
    "id": "48ab69f5-6d03-411f-9062-e96ccfa114cb",
    "name": "Priya Nair",
    "preferences": { "seat": "aisle", "diet": "veg" },
    "created_by": "5023eab5-2f4d-4244-868f-34fb1155ffe0"
  }
]
```

**Response (401 Unauthorized)** — invalid token:
```json
{
  "detail": "Could not validate credentials"
}
```

### DELETE /traveler/{id}
Deletes a traveler. Requires a valid JWT.

**Response (204 No Content)** on success — no body.

**Response (401 Unauthorized)** — invalid token:
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (404 Not Found)** — traveler doesn't exist:
```json
{
  "detail": "Traveler not found"
}
```

**Response (409 Conflict)** — has existing trips — *(Planned, not yet implemented — the `trips` table doesn't exist yet):*
```json
{
  "detail": "Traveler has existing trips and cannot be deleted"
}
```

---

## Trips
*(**Verified 2026-09-22** for `POST /trip`, `GET /trips` and `GET /trips/{id}` — `app/routers/trips.py` is built and every example below is real output captured from the running backend against the SQLite dev stand-in, plus 19 automated tests in `backend/tests/test_trips.py`. `optimize`, `itinerary`, `decision` and `preview` below are still **Planned**.)*

**Ownership rule:** a user only ever sees trips they created. Asking for someone else's trip returns the same `404 Trip not found` as a trip that doesn't exist, so the API doesn't reveal which trip IDs exist. The check lives in one reusable dependency, `get_owned_trip`, that every future `/trips/{id}/...` route will reuse.

**Budget is a JSON number** (`60000.0`), not a string. It is stored as an exact `NUMERIC(12,2)` in the database.

### POST /trip
Creates a trip request; status starts `DRAFT` (PRD US-002). The traveler must belong to the requesting user. Requires a valid JWT.

**Request:**
```json
{
  "traveler_id": "a813e578-9d6b-48f9-a917-7a5521e641fa",
  "dates": ["2026-11-01", "2026-11-05"],
  "budget": 60000,
  "preferences": { "class": "economy" }
}
```

**Response (201 Created):**
```json
{
  "id": "d14d097c-b6b9-437f-97b3-000a3dcf0237",
  "traveler_id": "a813e578-9d6b-48f9-a917-7a5521e641fa",
  "dates": ["2026-11-01", "2026-11-05"],
  "budget": 60000.0,
  "preferences": { "class": "economy" },
  "status": "DRAFT",
  "created_by": "39de0d4f-1196-4f95-bf5d-25032c6bb7e2"
}
```

**Response (401 Unauthorized)** — no `Authorization` header:
```json
{
  "detail": "Not authenticated"
}
```
*(An invalid or expired token returns `"Could not validate credentials"` instead — same two messages as the Travelers endpoints.)*

**Response (404 Not Found)** — `traveler_id` doesn't exist, or belongs to another user:
```json
{
  "detail": "Traveler not found"
}
```

**Response (422 Unprocessable Entity)** — missing `budget`:
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "budget"],
      "msg": "Field required",
      "input": { "traveler_id": "a813e578-9d6b-48f9-a917-7a5521e641fa", "dates": ["2026-11-01", "2026-11-05"] }
    }
  ]
}
```

**Response (422 Unprocessable Entity)** — end date before start date:
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Value error, End date cannot be before start date",
      "input": { "traveler_id": "a813e578-9d6b-48f9-a917-7a5521e641fa", "dates": ["2026-11-05", "2026-11-01"], "budget": 100 },
      "ctx": { "error": {} }
    }
  ]
}
```
A `budget` of zero or below, or a `dates` list that isn't exactly two valid dates, also returns 422. A one-day trip (`start == end`) is allowed.

### GET /trips/{id}
Returns one trip. Requires a valid JWT and that the trip belongs to the requesting user.

*(The current itinerary is not included yet — the `itineraries` table doesn't exist until the optimizer is built in Weeks 5–6.)*

**Response (200 OK):**
```json
{
  "id": "d14d097c-b6b9-437f-97b3-000a3dcf0237",
  "traveler_id": "a813e578-9d6b-48f9-a917-7a5521e641fa",
  "dates": ["2026-11-01", "2026-11-05"],
  "budget": 60000.0,
  "preferences": { "class": "economy" },
  "status": "DRAFT",
  "created_by": "39de0d4f-1196-4f95-bf5d-25032c6bb7e2"
}
```

**Response (401 Unauthorized)** — no `Authorization` header:
```json
{
  "detail": "Not authenticated"
}
```

**Response (404 Not Found)** — trip doesn't exist, **or belongs to another user**:
```json
{
  "detail": "Trip not found"
}
```

**Response (422 Unprocessable Entity)** — `id` isn't a valid UUID (e.g. `/trips/not-a-uuid`).

### GET /trips
Lists the requesting user's trips, newest first, optionally filtered by status. Requires a valid JWT.

*(Client query: `GET /trips?status=DRAFT`. Valid statuses: `DRAFT`, `OPTIMIZING`, `OPTIMIZED`, `UNDER_REVIEW`, `DECIDED`, `OPTIMIZATION_FAILED`.)*

**Response (200 OK):**
```json
[
  {
    "id": "d14d097c-b6b9-437f-97b3-000a3dcf0237",
    "traveler_id": "a813e578-9d6b-48f9-a917-7a5521e641fa",
    "dates": ["2026-11-01", "2026-11-05"],
    "budget": 60000.0,
    "preferences": { "class": "economy" },
    "status": "DRAFT",
    "created_by": "39de0d4f-1196-4f95-bf5d-25032c6bb7e2"
  }
]
```

**Response (200 OK)** — no trips match (e.g. `?status=OPTIMIZED` before anything is optimized, or a user with no trips):
```json
[]
```

**Response (401 Unauthorized)** — no `Authorization` header:
```json
{
  "detail": "Not authenticated"
}
```

**Response (422 Unprocessable Entity)** — unknown status (`?status=BOGUS`):
```json
{
  "detail": [
    {
      "type": "enum",
      "loc": ["query", "status"],
      "msg": "Input should be 'DRAFT', 'OPTIMIZING', 'OPTIMIZED', 'UNDER_REVIEW', 'DECIDED' or 'OPTIMIZATION_FAILED'",
      "input": "BOGUS",
      "ctx": { "expected": "'DRAFT', 'OPTIMIZING', 'OPTIMIZED', 'UNDER_REVIEW', 'DECIDED' or 'OPTIMIZATION_FAILED'" }
    }
  ]
}
```

### POST /trips/{id}/optimize
Runs the LangGraph pipeline — searches mock flight/hotel data, checks budget and constraints, and composes an itinerary alongside a full Trade-off Ledger (PRD US-003, US-004, US-005). Moves status through `OPTIMIZING → OPTIMIZED`, or to `OPTIMIZATION_FAILED` if nothing fits. Requires a valid JWT.

**Response (200 OK):**
```json
{
  "status": "OPTIMIZED",
  "itinerary": {
    "flight_option": { "carrier": "IndiGo", "price": 8200 },
    "stay_option": { "hotel": "Ibis", "price": 46000 },
    "total_cost": 54200,
    "rationale": "Chosen for lowest total cost within budget while matching the aisle-seat preference."
  },
  "tradeoff_ledger": [
    {
      "alternative": { "carrier": "Vistara", "price": 9800 },
      "price": 61000,
      "won": false,
      "reason": "Over budget by ₹1,000"
    }
  ]
}
```

**Response (200 OK)** — no combination fits the budget:
```json
{
  "status": "OPTIMIZATION_FAILED",
  "reason": "No combination of flight and stay options fits within the stated budget."
}
```

**Response (401 Unauthorized)** — missing/invalid JWT:
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (404 Not Found)** — trip doesn't exist:
```json
{
  "detail": "Trip not found"
}
```

### PATCH /trips/{id}/itinerary
Edits a line item on the itinerary; total cost is recalculated server-side, never client-supplied (PRD US-007). Requires a valid JWT.

**Request:**
```json
{
  "flight_option": { "carrier": "Vistara", "price": 9800 }
}
```

**Response (200 OK):**
```json
{
  "id": "e2b4a1f0-...",
  "flight_option": { "carrier": "Vistara", "price": 9800 },
  "total_cost": 55800
}
```

**Response (401 Unauthorized)** — missing/invalid JWT:
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (404 Not Found)** — trip doesn't exist:
```json
{
  "detail": "Trip not found"
}
```

### POST /trips/{id}/decision
Records the human approve/reject decision. Reject requires a reason. Sets trip status to `DECIDED` (PRD US-007). Requires a valid JWT.

**Request:**
```json
{
  "outcome": "REJECTED",
  "reason": "Layover too long for this traveler."
}
```

**Response (200 OK):**
```json
{
  "id": "d3c1b9a5-...",
  "trip_id": "f7a1c9e0-...",
  "outcome": "REJECTED",
  "reason": "Layover too long for this traveler."
}
```

**Response (400 Bad Request)** — rejected without a reason (PRD US-007 acceptance criterion):
```json
{
  "detail": "reason is required when outcome is REJECTED"
}
```

**Response (401 Unauthorized)** — missing/invalid JWT:
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (404 Not Found)** — trip doesn't exist:
```json
{
  "detail": "Trip not found"
}
```

### POST /trips/{id}/preview
*(Stretch — What-If Simulator, PRD US-011.)* Re-runs the pipeline against one changed input (`budget` or a preference) with `persist:false`, and returns a diff against the current saved itinerary without saving anything. Requires a valid JWT.

**Request:**
```json
{
  "budget": 70000
}
```

**Response (200 OK):**
```json
{
  "diff": {
    "total_cost": { "before": 54200, "after": 52100 },
    "flight_option": { "before": { "carrier": "IndiGo" }, "after": { "carrier": "Air India" } }
  }
}
```

**Response (401 Unauthorized)** — missing/invalid JWT:
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (404 Not Found)** — trip doesn't exist:
```json
{
  "detail": "Trip not found"
}
```

---

## Dashboard & Audit
*(Planned — no backend router built yet; shapes are the team's design, grounded in `06_Database_Design.md`. 401/403 reuse the real error strings from `app/security.py`.)*

### GET /dashboard
Returns total spend, average savings, and average turnaround time for a period (PRD US-010 — "As an **admin**..."). Requires a valid JWT with the `admin` role.

*(Client query: `GET /dashboard?period=2026-Q4`)*

**Response (200 OK):**
```json
{
  "period": "2026-Q4",
  "total_spend": 412000,
  "avg_savings": 8300,
  "avg_turnaround_hours": 2.4
}
```

**Response (401 Unauthorized)** — missing/invalid JWT:
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (403 Forbidden)** — logged in but not an admin:
```json
{
  "detail": "Admin access required"
}
```

### GET /audit
Returns audit event history. Independent of dashboard aggregation — every pipeline run and decision is recorded here regardless of what the dashboard shows. Requires a valid JWT.

*(Client query: `GET /audit?trip_id=f7a1c9e0-...`)*

**Response (200 OK):**
```json
[
  {
    "id": "a9f2e7c1-...",
    "trip_id": "f7a1c9e0-...",
    "event_type": "PIPELINE_RUN",
    "payload": { "status": "OPTIMIZED", "total_cost": 54200 },
    "created_at": "2026-09-16T10:00:00Z"
  }
]
```

**Response (401 Unauthorized)** — missing/invalid JWT:
```json
{
  "detail": "Could not validate credentials"
}
```

---

## Response Conventions
- All errors return `{detail: string}` (or a Pydantic validation array under `detail` for 422s) with a standard HTTP status code: **400** business-rule violation (e.g. reject without a reason), **401** missing/invalid JWT, **403** authenticated but wrong role (admin-only routes), **404** resource doesn't exist, **409** conflicting operation (e.g. deleting a traveler with trips, duplicate email), **422** request body fails Pydantic/SQLModel validation.
- All monetary figures returned by `/trips/{id}/optimize` are computed in code — the LLM-authored `rationale` field never introduces a number not already present elsewhere in the response (product principle: no unsupported financial claims).

## Live Demo Notes
For the viva, Auth, Travelers and Trips (create, list, get) can all be demoed for real — the optimizer, Dashboard and Audit aren't built yet.
1. Start the backend against the SQLite dev stand-in: `DATABASE_URL="sqlite:///./test.db" uvicorn app.main:app --port 8010` from `backend/`, with the venv active.
2. Open `http://127.0.0.1:8010/docs` — FastAPI's interactive Swagger page. "Try it out" on `/auth/register`, `/auth/login`, `/traveler`, `/travelers`, `/traveler/{id}`, `/trip`, `/trips` and `/trips/{id}` shows the real request/response live, including every error case above, without typing anything in a terminal during the demo. For the traveler endpoints, click "Authorize" first and paste in a token from `/auth/login`.
3. Or via terminal, if a command-line demo is preferred over Swagger:
```
curl -X POST http://127.0.0.1:8010/auth/register -H "Content-Type: application/json" -d "{\"email\":\"demo.viva@example.com\",\"password\":\"Trip@2026\"}"
curl -X POST http://127.0.0.1:8010/auth/login -H "Content-Type: application/json" -d "{\"email\":\"demo.viva@example.com\",\"password\":\"Trip@2026\"}"
curl -X POST http://127.0.0.1:8010/traveler -H "Content-Type: application/json" -H "Authorization: Bearer <token from login>" -d "{\"name\":\"Priya Nair\",\"preferences\":{\"seat\":\"aisle\"}}"
```
