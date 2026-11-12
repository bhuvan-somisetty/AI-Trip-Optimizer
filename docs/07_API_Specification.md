# API Specification

> **Provenance:** All endpoints below are the team's own design, built to satisfy the PRD's user stories and acceptance criteria (cited inline per endpoint). No specific API shape is mandated by the brief or PRD. Route naming (singular `POST /traveler`, `POST /trip` vs. plural `GET`s) is per the instructor's instruction on API conventions, 2026-09-16. Endpoint layout follows the format the instructor showed the team as an example, 2026-09-16/17.

> **Amended 2026-09-16:** `/documents`, `/assistant/ask`, and `/trips/{id}/ask` removed — the instructor cut the RAG-based Trip Knowledge Assistant / Ask This Itinerary from scope ("RAG is not needed"). See `03_PRD.md` amendment and `17_Risk_Register.md` R-011.

FastAPI auto-generates interactive OpenAPI docs at `/docs` once the backend is running — treat that as the live, authoritative spec. This file is the human-readable summary for planning, review, and the viva.

**Labeling:** sections marked **Verified** were captured by actually calling the running backend (against the SQLite dev stand-in) — `app/routers/auth.py` on 2026-09-16, `app/routers/travelers.py` on 2026-09-17, `app/routers/trips.py` on 2026-09-22 — every example JSON in those sections is real output, not invented. Sections marked **Planned** describe endpoints with no backend code yet (the `dashboard` and `audit` routers, and the trip `optimize`/`itinerary`/`decision`/`preview` endpoints, don't exist as of 2026-09-22 — `auth.py`, `travelers.py` and the trip create/list/get endpoints in `trips.py` are built). Their 401/403 examples reuse the exact error strings from the real, already-written `app/security.py` dependencies (`get_current_user` → 401 "Not authenticated" / "Could not validate credentials"; `require_admin` → 403 "Admin access required") since those functions will guard these routes once built. Their 404/400/422 examples are the team's design, grounded in `06_Database_Design.md` and the PRD's acceptance criteria — not yet runnable, but not arbitrary either.

---

## Auth
*(Verified — captured from the live backend, not invented.)*

### POST /auth/register
Creates a user account. The new account is always a `member`. *(Updated 2026-10-02 — a `role` sent in the request used to be accepted, so anyone could sign themselves up as `admin`. It is now ignored: sign-up never creates an admin. Covered by `backend/tests/test_auth.py`.)*

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
*(Verified 2026-09-17 — `app/routers/travelers.py` is built and tested end-to-end against the SQLite dev stand-in, not invented. Building this endpoint surfaced and fixed a real bug in `app/security.py`: `get_current_user` was passing the JWT's string `sub` claim straight into `session.get(User, user_id)`, which 500'd on SQLite because it expects an actual `UUID` object — fixed by parsing it with `uuid.UUID(user_id)` first. There are two distinct real 401 messages depending on the cause — shown both below, then abbreviated to one per endpoint after.)*

*(**Updated 2026-09-24** — the delete endpoint had a real ownership bug: it deleted a traveler by ID with no check that it belonged to the requesting user. Found and fixed while adding the 409 "has existing trips" check below, once the `trips` table existed to check against. 11 automated tests added in `backend/tests/test_travelers.py`, including a sabotage check — the ownership and 409 checks were deliberately removed and confirmed the right 2 tests failed, so they're catching real bugs, not passing vacuously.)*

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

### PUT /traveler/{id}
*(Verified 2026-10-02 — real output captured from the running backend, plus 5 automated tests in `backend/tests/test_travelers.py`.)*
Replaces a traveler's name and preferences. Same body as `POST /traveler`. Only the traveler's owner can edit it. Requires a valid JWT.

**Request:**
```json
{
  "name": "Priya Nair",
  "preferences": { "seat": "window", "diet": "veg" }
}
```

**Response (200 OK):**
```json
{
  "id": "3c01c324-de1a-4552-bf01-ff843c603411",
  "name": "Priya Nair",
  "preferences": { "seat": "window", "diet": "veg" },
  "created_by": "63bea012-8b42-48b0-800b-68e6af8574a8"
}
```

**Response (401 Unauthorized)** — invalid token:
```json
{
  "detail": "Could not validate credentials"
}
```

**Response (404 Not Found)** — traveler doesn't exist, **or belongs to another user**:
```json
{
  "detail": "Traveler not found"
}
```

**Response (422 Unprocessable Entity)** — `name` missing:
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "name"],
      "msg": "Field required",
      "input": {}
    }
  ]
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

**Response (404 Not Found)** — traveler doesn't exist, **or belongs to another user**:
```json
{
  "detail": "Traveler not found"
}
```

**Response (409 Conflict)** — has existing trips (PRD US-001):
```json
{
  "detail": "Traveler has existing trips and cannot be deleted"
}
```

---

## Trips
*(**Verified 2026-09-22** for `POST /trip`, `GET /trips` and `GET /trips/{id}` — `app/routers/trips.py` is built and every example below is real output captured from the running backend against the SQLite dev stand-in, plus 19 automated tests in `backend/tests/test_trips.py`. `optimize`, `GET /trips/{id}/itinerary`, `review` and `decision` were built 2026-10-08, `PATCH itinerary` on 2026-11-12, and `preview` / `preview/apply` on 2026-11-13.)*

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

*(The itinerary isn't included here — fetch it with `GET /trips/{id}/itinerary`. Every trip response also carries `failure_reason`: `null`, or why the last optimize run failed.)*

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
*(**Built 2026-10-08** — examples below are real output from the backend, with tests in `backend/tests/test_optimize.py`.)*

Runs the LangGraph pipeline on a saved trip: `search_node` finds real flight and hotel fares (fixtures in tests), `check_node` applies the trip's preferences and budget, and `compose_node` builds the itinerary, the full Trade-off Ledger and a rationale (PRD US-003, US-004, US-005, US-006). Requires a valid JWT and that the trip belongs to the requesting user.

**Status flow:** the trip is saved as `OPTIMIZING` before the pipeline starts, then ends as `OPTIMIZED` or `OPTIMIZATION_FAILED`. Only `DRAFT`, `OPTIMIZED` and `OPTIMIZATION_FAILED` trips can be optimized; re-running replaces the saved itinerary (one per trip, in the `itineraries` table).

**Round trips (2026-11-13):** the flight back (`destination` → `origin` on the end date) is searched and picked the same way as the outbound one, and `total_cost` is outbound + return + stay. If no return fare is found, the trip is still built with `"return_flight": null` and a flag saying the total has no return flight in it; fares are cached and some dates have none. The itinerary also carries `savings` (PRD US-010): per line item, the median price of the options that met every rule minus the price chosen, summed. The example below was captured before return flights were added, so it shows neither field; a fixture run of BLR → DEL, 2026-11-01 to 2026-11-05, budget 20000 now gives outbound FL-1004 3,600, return FL-1009 3,300 and HT-2002 at 1,600 a night: `"total_cost": 13300.0, "savings": 9350.0`, and ledger rows such as `{ "kind": "return", "alternative": "FL-1008 SpiceJet economy, 0 stop(s), departs 2026-11-05", "price": 3900.0, "won": false, "reason": "Price: 600 more than FL-1009" }`.

**Over budget is not a failure.** The cheapest itinerary that meets every preference is still returned, with `within_budget: false` and a flag naming the line items (PRD US-005). The run only fails when no flight (or, for an overnight trip, no hotel) is found or meets the preferences.

**Rationale:** written by the LLM when `OPENAI_API_KEY` is set, otherwise by a fixed template from the same numbers. Every number in an LLM rationale must already appear in the itinerary's facts; if one doesn't, the run fails instead of showing it (product principle: no unsupported financial claims).

**Response (200 OK)** — BLR → DEL, 2026-11-01 to 2026-11-03, budget 20000, `preferences: {"max_stops": 0}` (ledger shortened to 3 of 9 rows):
```json
{
  "status": "OPTIMIZED",
  "itinerary": {
    "flight": {
      "id": "FL-1003", "origin": "BLR", "destination": "DEL",
      "departure_time": "2026-11-01T23:40:00", "arrival_time": "2026-11-02T02:15:00",
      "airline": "SpiceJet", "price": 4100, "cabin_class": "economy", "stops": 0
    },
    "hotel": {
      "id": "HT-2002", "city": "DEL", "name": "Sample Budget Inn", "price_per_night": 1600,
      "rating": 3.5, "amenities": ["wifi"], "distance_to_center_km": 4.2
    },
    "total_cost": 7300.0,
    "within_budget": true,
    "flags": [],
    "rationale": "Chose flight FL-1003 SpiceJet economy, 0 stop(s) at 4,100 and hotel HT-2002 Sample Budget Inn, rated 3.5 at 1,600 a night for 2 night(s) (3,200), the cheapest options that meet every trip preference. Total cost is 7,300 against a budget of 20,000, leaving 12,700 unspent. 1 option(s) were ruled out by trip preferences."
  },
  "tradeoff_ledger": [
    { "alternative": "FL-1004 Vistara economy, 1 stop(s)", "price": 3600.0, "won": false, "reason": "Preference max_stops: FL-1004 has 1 stop(s), trip allows 0" },
    { "alternative": "FL-1003 SpiceJet economy, 0 stop(s)", "price": 4100.0, "won": true, "reason": "Cheapest option that meets every trip preference" },
    { "alternative": "FL-1001 IndiGo economy, 0 stop(s)", "price": 5200.0, "won": false, "reason": "Price: 1,100 more than FL-1003" }
  ],
  "reason": null
}
```
Hotel ledger rows show the whole stay's price (`price_per_night × nights`) so they compare directly. A same-day trip has `"hotel": null` and no hotel rows.

**Response (200 OK)** — nothing found, trip is now `OPTIMIZATION_FAILED` (the same `reason` is saved as the trip's `failure_reason`):
```json
{
  "status": "OPTIMIZATION_FAILED",
  "itinerary": null,
  "tradeoff_ledger": [],
  "reason": "No flights found from BLR to DEL on 2030-01-01"
}
```

**Response (401 Unauthorized)** — no `Authorization` header: `{ "detail": "Not authenticated" }`

**Response (404 Not Found)** — trip doesn't exist, or belongs to another user: `{ "detail": "Trip not found" }`

**Response (409 Conflict)** — trip is `OPTIMIZING`, `UNDER_REVIEW` or `DECIDED`:
```json
{
  "detail": "Trip is DECIDED; only DRAFT, OPTIMIZED or OPTIMIZATION_FAILED trips can be optimized"
}
```

### GET /trips/{id}/itinerary
*(**Built 2026-10-08.**)* Returns the trip's saved result in exactly the same shape as `POST /trips/{id}/optimize`, so the trip detail page can reload it without re-running the pipeline. After a failed run it returns `itinerary: null` with the `reason`.

**Response (404 Not Found)** — trip never optimized: `{ "detail": "Trip has not been optimized yet" }`; trip doesn't exist or isn't yours: `{ "detail": "Trip not found" }`.

### PATCH /trips/{id}/itinerary
*(**Built 2026-11-12**, tests in `backend/tests/test_edit_itinerary.py`; return flights 2026-11-13, `test_return_and_savings.py`.)* Swaps the outbound flight, the return flight or the hotel for another option from the same search (PRD US-007). The client only names the option; the total, budget verdict and flags, Trade-off Ledger and rationale are all recomputed server-side, never client-supplied. Only options that pass every rule can be picked (not a fare on another day, not one that breaks a preference). The trip moves to `UNDER_REVIEW`. Requires a valid JWT and that the trip belongs to the requesting user.

**Request:**
```json
{
  "kind": "flight",
  "option_id": "FL-1001"
}
```
`kind` is `flight` (outbound), `return` or `stay`; `option_id` is the id at the start of a Trade-off Ledger row. A return flight that would leave before the outbound one lands (same-day trips) is refused. `savings` is recomputed too.

**Response (200 OK)** — same shape as `POST /trips/{id}/optimize`, with `"status": "UNDER_REVIEW"`. The itinerary's `picked` lists the line items a reviewer chose by hand (`["flight"]` here), and the winning ledger row's reason reads `Picked by the reviewer; meets every trip preference`.

**Response (400 Bad Request)** — option isn't one of this trip's, or breaks a rule:
```json
{
  "detail": "FL-1004 can't be picked: FL-1004 has 1 stop(s), trip allows 0"
}
```

**Response (404 Not Found)** — trip doesn't exist, or belongs to another user: `{ "detail": "Trip not found" }`

**Response (409 Conflict)** — trip isn't `OPTIMIZED` or `UNDER_REVIEW`, or its itinerary was saved before edits existed (the response says to optimize again; such itineraries come back with `"editable": false`).

### POST /trips/{id}/review
*(**Built 2026-10-08**, tests in `backend/tests/test_decisions.py`.)* Moves an `OPTIMIZED` trip to `UNDER_REVIEW`. No body. Returns the trip (same shape as `GET /trips/{id}`) with `"status": "UNDER_REVIEW"`. Requires a valid JWT and that the trip belongs to the requesting user.

**Response (409 Conflict)** — trip isn't `OPTIMIZED`:
```json
{
  "detail": "Trip is DRAFT; only OPTIMIZED trips can be moved to review"
}
```

### POST /trips/{id}/decision
*(**Built 2026-10-08**, tests in `backend/tests/test_decisions.py`.)* Records the human approve/reject decision and sets the trip to `DECIDED` (PRD US-007). Works on an `OPTIMIZED` or `UNDER_REVIEW` trip. A decided trip can't be optimized or decided again (409). Decisions are saved in the `decisions` table and never edited. Requires a valid JWT and that the trip belongs to the requesting user.

**Request:**
```json
{
  "outcome": "REJECTED",
  "reason": "Layover too long for this traveler."
}
```
`outcome` is `APPROVED` or `REJECTED`. `reason` is required for `REJECTED` and optional for `APPROVED`; surrounding spaces are trimmed and a blank reason counts as missing.

**Response (200 OK)** — real output (SQLite dev stand-in):
```json
{
  "id": "df3320ab-719b-469a-87d0-af1a323de2ef",
  "trip_id": "e139ec4d-756c-46e8-b10d-507067920e32",
  "outcome": "REJECTED",
  "reason": "Layover too long for this traveler.",
  "decided_by": "87a5b994-9629-43f1-b825-afee30fb9014",
  "decided_at": "2026-10-07T17:32:36.838340"
}
```

**Response (400 Bad Request)** — rejected without a reason (PRD US-007 acceptance criterion):
```json
{
  "detail": "reason is required when outcome is REJECTED"
}
```

**Response (401 Unauthorized)** — no `Authorization` header: `{ "detail": "Not authenticated" }`

**Response (404 Not Found)** — trip doesn't exist, or belongs to another user: `{ "detail": "Trip not found" }`

**Response (409 Conflict)** — trip is `DRAFT`, `OPTIMIZING`, `OPTIMIZATION_FAILED` or already `DECIDED`:
```json
{
  "detail": "Trip is DECIDED; only OPTIMIZED or UNDER_REVIEW trips can be decided"
}
```

**Response (422 Unprocessable Entity)** — `outcome` isn't `APPROVED` or `REJECTED`.

### GET /trips/{id}/decision
*(**Built 2026-10-08.**)* Returns the trip's decision in the same shape as above, so the trip page can show who decided, when, and why.

**Response (404 Not Found)** — not decided yet: `{ "detail": "Trip has not been decided yet" }`; trip doesn't exist or isn't yours: `{ "detail": "Trip not found" }`.

### POST /trips/{id}/preview
*(**Built 2026-11-13** — What-If Simulator, PRD US-011. Examples are real output from the backend on the test fixtures; tests in `backend/tests/test_what_if.py`.)*

Reruns the optimizer with changed inputs on the trip's **saved** search results and returns the result next to the saved itinerary, **without saving anything**. No provider is searched again, so a preview is instant, costs no API quota and compares the same fares and hotels. The rationale is the template one (no LLM call); applying the preview writes the real one. Only `OPTIMIZED` and `UNDER_REVIEW` trips can be previewed. Requires a valid JWT and that the trip belongs to the requesting user.

**Request:** any of `budget`, `cabin_class` (`economy` / `premium_economy` / `business`), `max_stops` (0–2) and `min_hotel_rating` (0–5). Only the fields sent change. A preference sent as `null` is removed, so the optimizer stops screening on it; `budget` can't be `null`.
```json
{
  "max_stops": 0
}
```

**Response (200 OK)** — BLR → DEL, 2026-11-01 to 2026-11-05, budget 20000 (`preview` has the same shape as `POST /trips/{id}/optimize` and is shortened here):
```json
{
  "inputs": [ { "field": "max_stops", "before": null, "after": 0 } ],
  "preview": { "status": "OPTIMIZED", "itinerary": { "total_cost": 14400.0, "savings": 9800.0, "flags": [], "...": "..." }, "tradeoff_ledger": ["..."], "reason": null },
  "diff": [
    { "field": "flight", "before": "FL-1004", "after": "FL-1003" },
    { "field": "return_flight", "before": "FL-1009", "after": "FL-1008" },
    { "field": "total_cost", "before": 13300.0, "after": 14400.0 },
    { "field": "savings", "before": 9350.0, "after": 9800.0 }
  ]
}
```
`diff` lists only what changes (`flight`, `return_flight`, `hotel`, `total_cost`, `within_budget`, `savings`, number of `flags`). Savings can rise while the total rises: they are measured against the options that meet the *new* rules.

**Response (200 OK)** — the change leaves no valid itinerary; the preview says why and nothing is saved:
```json
{
  "inputs": [ { "field": "min_hotel_rating", "before": null, "after": 5.0 } ],
  "preview": { "status": "OPTIMIZATION_FAILED", "itinerary": null, "tradeoff_ledger": [], "reason": "No hotel in DEL meets the trip's preferences" },
  "diff": ["..."]
}
```

**Response (400 Bad Request)** — every input sent already has that value: `{ "detail": "Nothing to preview: every input already has that value" }`

**Response (422 Unprocessable Entity)** — an empty body, `max_stops` outside 0–2, an unknown cabin, a negative or `null` budget.

**Response (404 Not Found)** — trip doesn't exist, or belongs to another user: `{ "detail": "Trip not found" }`

**Response (409 Conflict)** — trip isn't `OPTIMIZED` or `UNDER_REVIEW` (for example `DECIDED`), or its itinerary was saved before search results were kept.

### POST /trips/{id}/preview/apply
*(**Built 2026-11-13**.)* Saves a preview: same request body and checks as `POST /trips/{id}/preview`. The trip's `budget` and preferences change, the optimizer picks every line item again from the saved search, the LLM writes the rationale, and the trip moves to `UNDER_REVIEW`. Hand-picked edits from `PATCH /trips/{id}/itinerary` are dropped, since the line items are chosen again under the new inputs. Recorded in the audit trail as `ITINERARY_EDITED` with `"what_if": true`, the inputs and the diff, e.g. summary `Applied what-if (max_stops None -> 0); total 13,300 -> 14,400`.

**Response (200 OK)** — same shape as `POST /trips/{id}/optimize`, with `"status": "UNDER_REVIEW"`.

**Response (400 Bad Request)** — the change can't build an itinerary; nothing is saved:
```json
{
  "detail": "This change can't build an itinerary, so nothing was saved: No hotel in DEL meets the trip's preferences"
}
```

---

## Dashboard & Audit
*(`GET /audit` built 2026-11-12, `GET /dashboard` 2026-11-13.)*

### GET /dashboard
*(**Built 2026-11-13**, `app/routers/dashboard.py`, tests in `backend/tests/test_dashboard.py`; response below captured from the running app.)* Returns total spend, average savings and average turnaround time for a period (PRD US-010). Requires a valid JWT. **Admins see the whole team's trips, members only their own** (the same split as `GET /audit`; the PRD story is written for an admin, and members get the same numbers for their own trips).

**Query parameter (optional):** `period` as a year (`2026`), a quarter (`2026-Q4`) or a month (`2026-11`); left out, it covers all time. A trip counts in the period it was **decided** in (`trips_created` counts by creation date). Spend and savings come from **approved** itineraries; turnaround is from the trip being created to its decision, over every decided trip. Averages are `null` when there is nothing to average.

*(Client query: `GET /dashboard?period=2026-Q4`)*

**Response (200 OK):**
```json
{
  "period": "2026-Q4",
  "trips_created": 1,
  "trips_decided": 1,
  "approved": 1,
  "rejected": 0,
  "total_spend": 14400.0,
  "avg_savings": 9800.0,
  "avg_turnaround_hours": 0.0
}
```

**Response (422 Unprocessable Entity)** — a period in another format: `{ "detail": "period must look like 2026, 2026-Q4 or 2026-11" }`

**Response (401 Unauthorized)** — missing/invalid JWT: `{ "detail": "Not authenticated" }`

The Analytics page computes the same figures in the browser from the user's trips (which come from the API), so it can switch periods without a round trip; `GET /dashboard` gives the same numbers to API clients and to admins across the team.

### GET /audit
*(**Verified** — built 2026-11-11, `app/routers/audit.py`; response below captured from the running app, not invented.)*

Returns audit event history, newest first. Independent of dashboard aggregation — every pipeline run and decision is recorded here regardless of what the dashboard shows (PRD: Audit trail, US-010). Requires a valid JWT. **Admins see every user's events; members see only their own.** Events are append-only: nothing in the API edits or deletes them, and re-optimizing a trip replaces its itinerary but keeps every earlier `PIPELINE_RUN` here.

**Recorded events:** `TRAVELER_CREATED`, `TRAVELER_UPDATED` (payload has `before`/`after`), `TRAVELER_DELETED`, `TRIP_CREATED`, `PIPELINE_RUN` (what was chosen, the total, the flags, the rationale and the data source of each option), `PIPELINE_FAILED` (with the reason), `REVIEW_STARTED`, `DECISION` (outcome, reason, and the itinerary as it stood when decided). `ITINERARY_EDITED` (which line item was swapped, and the total before and after). `PIPELINE_RUN` and `PIPELINE_FAILED` also carry `run_ms`, how long the optimizer took. An action that fails (e.g. a 409) records nothing — the event is saved in the same transaction as the action.

**Query parameters (all optional):** `trip_id`, `event_type` (one of the names above), `limit` (1–500, default 100). Someone else's `trip_id` returns `[]`, the same as an unknown one.

*(Client query: `GET /audit?trip_id=83980862-2f7c-445e-b833-0f7623d78af2`)*

**Response (200 OK):**
```json
[
  {
    "id": "b3bba4aa-2838-4196-888e-2a77ab46d704",
    "trip_id": "83980862-2f7c-445e-b833-0f7623d78af2",
    "event_type": "PIPELINE_RUN",
    "actor": "demo.viva@example.com",
    "summary": "Optimized BLR→DEL: total 10,000, within budget 60,000",
    "payload": {
      "request": {"origin": "BLR", "destination": "DEL", "start_date": "2026-11-01", "end_date": "2026-11-05", "budget": 60000.0, "preferences": {}},
      "flight": {"id": "FL-1004", "airline": "Vistara", "price": 3600},
      "hotel": {"id": "HT-2002", "name": "Sample Budget Inn", "price_per_night": 1600, "rating": 3.5},
      "total_cost": 10000.0,
      "within_budget": true,
      "flags": [],
      "options_compared": 9,
      "rationale": "Chose flight FL-1004 Vistara economy, 1 stop(s), departs 2026-11-01 at 3,600 and hotel HT-2002 Sample Budget Inn, rated 3.5 at 1,600 a night for 4 night(s) (6,400), the cheapest options that meet every trip preference. Total cost is 10,000 against a budget of 60,000, leaving 50,000 unspent."
    },
    "created_at": "2026-11-11T06:31:53.345757"
  },
  {
    "id": "67df1ae3-4ac0-42b4-b3d3-e1d35cdac6f0",
    "trip_id": "83980862-2f7c-445e-b833-0f7623d78af2",
    "event_type": "TRIP_CREATED",
    "actor": "demo.viva@example.com",
    "summary": "Created trip BLR→DEL for Priya Nair, budget 60,000",
    "payload": {"traveler_id": "d2b05f22-26a9-4b78-8efb-f9d33e07ed58", "origin": "BLR", "destination": "DEL", "dates": ["2026-11-01", "2026-11-05"], "budget": 60000.0, "preferences": {}},
    "created_at": "2026-11-11T06:31:53.238817"
  }
]
```
*(Captured against the test fixtures' sample flights/hotels, so the IDs and prices are sample data. On Postgres `created_at` also carries its timezone.)*

**Response (401 Unauthorized)** — no token:
```json
{
  "detail": "Not authenticated"
}
```

**Response (422)** — `limit` outside 1–500, or an unknown `event_type`.

---

## Response Conventions
- All errors return `{detail: string}` (or a Pydantic validation array under `detail` for 422s) with a standard HTTP status code: **400** business-rule violation (e.g. reject without a reason), **401** missing/invalid JWT, **403** authenticated but wrong role (admin-only routes), **404** resource doesn't exist, **409** conflicting operation (e.g. deleting a traveler with trips, duplicate email), **422** request body fails Pydantic/SQLModel validation.
- All monetary figures returned by `/trips/{id}/optimize` are computed in code — the LLM-authored `rationale` field never introduces a number not already present elsewhere in the response (product principle: no unsupported financial claims).

## Live Demo Notes
For the viva, every built endpoint can be demoed for real, on the live API at https://ai-trip-optimizer-api.vercel.app/docs or locally as below. Every endpoint in this file is built.
1. Start the backend against the SQLite dev stand-in: `DATABASE_URL="sqlite:///./test.db" uvicorn app.main:app --port 8010` from `backend/`, with the venv active.
2. Open `http://127.0.0.1:8010/docs` — FastAPI's interactive Swagger page. "Try it out" on `/auth/register`, `/auth/login`, `/traveler`, `/travelers`, `/traveler/{id}` (PUT and DELETE), `/trip`, `/trips` and `/trips/{id}` shows the real request/response live, including every error case above, without typing anything in a terminal during the demo. For the traveler endpoints, click "Authorize" first and paste in a token from `/auth/login`.
3. Or via terminal, if a command-line demo is preferred over Swagger:
```
curl -X POST http://127.0.0.1:8010/auth/register -H "Content-Type: application/json" -d "{\"email\":\"demo.viva@example.com\",\"password\":\"Trip@2026\"}"
curl -X POST http://127.0.0.1:8010/auth/login -H "Content-Type: application/json" -d "{\"email\":\"demo.viva@example.com\",\"password\":\"Trip@2026\"}"
curl -X POST http://127.0.0.1:8010/traveler -H "Content-Type: application/json" -H "Authorization: Bearer <token from login>" -d "{\"name\":\"Priya Nair\",\"preferences\":{\"seat\":\"aisle\"}}"
```
