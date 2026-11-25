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

*(Updated 2026-11-17: an optional `name`, up to 100 characters, is saved as the user's display name and comes back in the response. Left out, `name` is `null` until the user sets one with `PATCH /me`. Google sign-in fills it from the Google account.)* Captured response for a request that also sent `"name": "Priya Nair"`:
```json
{
  "id": "fadae85f-cbab-4432-93a9-019585c5dff1",
  "email": "demo.viva@example.com",
  "name": "Priya Nair",
  "role": "member"
}
```
The examples below were captured before `name` existed, so they don't show it.

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

### GET /me
*(**Verified 2026-11-17**: `app/routers/settings.py`, tests in `backend/tests/test_settings.py`.)* Returns the signed-in user. Requires a valid JWT. The web app's Settings page and sidebar read the name from here.

**Response (200 OK):**
```json
{
  "id": "fadae85f-cbab-4432-93a9-019585c5dff1",
  "email": "demo.viva@example.com",
  "name": "Priya Nair",
  "role": "member"
}
```

### PATCH /me
*(**Verified 2026-11-17.**)* Changes the signed-in user's display name. Only `name` can change: the email is the sign-in identity, and anything else in the body is ignored. Surrounding spaces are trimmed.

**Request:**
```json
{ "name": "Priya N." }
```

**Response (200 OK)**: same shape as `GET /me`, with the new name.

**Response (422 Unprocessable Entity)**: a blank name (empty or only spaces), one over 100 characters, or no `name` at all:
```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "name"],
      "msg": "Value error, Name cannot be blank",
      "input": "   ",
      "ctx": { "error": {} }
    }
  ]
}
```

**Response (401 Unauthorized)**: no token, `{ "detail": "Not authenticated" }`

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

### PATCH /trips/{id}
*(**Verified 2026-11-17**, tests in `backend/tests/test_trips.py`.)* Edits a trip request. Send only the fields that change, from `traveler_id`, `origin`, `destination`, `dates`, `budget` and `preferences`, and leave the rest out rather than sending `null`. `preferences` replaces the whole object. The same checks as `POST /trip` apply, to the trip as it will be after the edit. Requires a valid JWT and that the trip belongs to the requesting user.

Before this existed, the web app's "Edit request" only changed what the browser showed, so an edited budget was lost on reload and the optimizer kept using the old one.

**Only before review.** A trip can be edited while it is `DRAFT`, `OPTIMIZED` or `OPTIMIZATION_FAILED`. A saved itinerary was built for the old request, so an edit deletes it and the trip goes back to `DRAFT`, ready to optimize again; earlier pipeline runs stay in the audit trail. An edit that changes something writes a `TRIP_UPDATED` audit event with each changed field before and after. One that changes nothing writes no event.

**Request:**
```json
{ "budget": 45000, "dates": ["2026-12-03", "2026-12-05"] }
```

**Response (200 OK)**: the trip, same shape as `GET /trips/{id}`:
```json
{
  "id": "729ad274-44c1-408a-b462-dd906051f07d",
  "traveler_id": "de593869-5593-4468-9714-7015a53d75dc",
  "origin": "BLR",
  "destination": "DEL",
  "dates": ["2026-12-03", "2026-12-05"],
  "budget": 45000.0,
  "preferences": {},
  "status": "DRAFT",
  "failure_reason": null,
  "created_by": "fadae85f-cbab-4432-93a9-019585c5dff1"
}
```

**Response (409 Conflict)**: the trip is `OPTIMIZING`, `UNDER_REVIEW` or `DECIDED`:
```json
{
  "detail": "Trip is UNDER_REVIEW; only DRAFT, OPTIMIZED or OPTIMIZATION_FAILED trips can be edited"
}
```

**Response (422 Unprocessable Entity)**: origin and destination would be the same, `{ "detail": "Origin and destination must be different" }`. A field sent as `null`, an end date before the start date, a malformed airport code or a budget of zero or below also return 422.

**Response (404 Not Found)**: the trip, or a new `traveler_id`, doesn't exist or isn't yours: `{ "detail": "Trip not found" }` or `{ "detail": "Traveler not found" }`

### POST /trips/{id}/optimize
*(**Built 2026-10-08** — examples below are real output from the backend, with tests in `backend/tests/test_optimize.py`.)*

Runs the LangGraph pipeline on a saved trip: `search_node` finds real flight and hotel fares (fixtures in tests), `check_node` applies the trip's preferences and budget, and `compose_node` builds the itinerary, the full Trade-off Ledger and a rationale (PRD US-003, US-004, US-005, US-006). Requires a valid JWT and that the trip belongs to the requesting user.

**Status flow:** the trip is saved as `OPTIMIZING` before the pipeline starts, then ends as `OPTIMIZED` or `OPTIMIZATION_FAILED`. Only `DRAFT`, `OPTIMIZED` and `OPTIMIZATION_FAILED` trips can be optimized; re-running replaces the saved itinerary (one per trip, in the `itineraries` table).

**Trips by train or bus (2026-11-23, `ground_check` in `app/pipeline/graph.py`, tests in `test_ground_trip.py`):** when the trip's `preferences.filters.modes` leaves out `flight` (the trip form's Trains or Buses card), no flight is searched or booked. `search_node` searches Google Maps transit both ways (`app/ground.py`), and `flight` / `return_flight` hold the train or bus picked each way: the cheapest published fare, else the fastest of the day. These carry `mode` (`train` or `bus`), `service`, `operator`, `from_station`, `to_station`, `price` (null when no fare is published), `fare_label` and `link`. `total_cost` is the hotel plus the fares that are known; an unpublished fare is never added or guessed, and a flag says so ("The train fare isn't published, so it isn't in the total; check it on the operator's site before booking"). *(Until 2026-11-25 a distance-based `fare_estimate` was shown here; it was removed so that only real data is shown.)* Ledger rows of a train or bus may have `price: null`. What-if and previews reuse the saved train searches. Live check on 2026-11-23, Delhi → Jaipur 12 to 14 Dec 2026, trains only: 14 trains out and 15 back, picked 26482 Jodhpur Vande Bharat Express and 12985 Double Decker Express, hotel Blue Beds Jaipur, total 1,103 (hotel only).

**Round trips (2026-11-13):** the flight back (`destination` → `origin` on the end date) is searched and picked the same way as the outbound one, and `total_cost` is outbound + return + stay. If no return fare is found, the trip is still built with `"return_flight": null` and a flag saying the total has no return flight in it; fares are cached and some dates have none. The itinerary also carries `savings` (PRD US-010): per line item, the median price of the options that met every rule minus the price chosen, summed. The example below was captured before return flights were added, so it shows neither field; a fixture run of BLR → DEL, 2026-11-01 to 2026-11-05, budget 20000 now gives outbound FL-1004 3,600, return FL-1009 3,300 and HT-2002 at 1,600 a night: `"total_cost": 13300.0, "savings": 9350.0`, and ledger rows such as `{ "kind": "return", "alternative": "FL-1008 SpiceJet economy, 0 stop(s), departs 2026-11-05", "price": 3900.0, "won": false, "reason": "Price: 600 more than FL-1009" }`.

**What decides the pick (2026-11-17).** Every option is first screened by the trip's rules. Besides cabin class, maximum stops and minimum hotel rating, those are now the departure-time window (outbound flight only, local airport time), avoiding red-eyes (22:30 to 05:00), excluded airlines, a maximum nightly rate and required hotel amenities. They are read from top-level `preferences` keys (`departure_window`, `avoid_red_eye`, `excluded_airlines`, `max_nightly_rate`, `required_amenities`), or from the web app's `preferences.filters` object when the top-level key is missing. Each option a rule removes gets a ledger row naming the rule. Among the options left, the trip's `priority` decides:

| `priority` | Flights | Hotel |
| :--- | :--- | :--- |
| `cheapest` (default) | cheapest | cheapest |
| `balanced` | half price, half flight time | half price, half guest rating |
| `comfort` | fewest stops | best rated |
| `fastest` | shortest flight | cheapest (there is no distance data) |

A priority only spends the room the budget has above the cheapest picks, so it never takes a trip over budget that the cheapest picks would have kept within it. Ledger rows say why an option lost: `Price: ...`, `Slower: ...`, `More stops: ...`, `Lower rated: ...`, or `Budget: ranks higher but ...` when a better option didn't fit. Preferred airlines, the trip's and the company policy's, only decide between options at the same price. The company travel policy is applied on every run as well (see [Travel Policy](#travel-policy)). The web app's "Max distance from centre" filter is not applied, because the hotel data has no distance.

**Flights and hotels carry more detail (2026-11-21).** Each Google Flights option keeps `layovers` (`[{airport, airport_name, minutes, overnight}]`, empty for non-stop), and, when Google sends it, `price_level` (`low`, `typical` or `high`) with `typical_price_range` (`[low, high]`); both are `null` when Google leaves them out, which is common for one-way searches. Each hotel keeps `latitude`, `longitude` and up to five `images` (`[{thumbnail, original}]`) from Google Hotels, at no extra search cost. With `preferences.flexible_days` (or `filters.flexibleDays`) set to 1 or 2, both legs are also searched that many days either side; those fares appear as `Different day` ledger rows and the trip's own dates never change. Two warning flags come from this data: `Flight: <id> on <date> costs <price>, <n> less than <chosen> on the trip's date` (flexible dates only) and `Flight: Google Flights rates fares on this date as high for the route (typical <low> to <high>)`.

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

## Travel Policy
*(**Verified 2026-11-17**: `app/routers/settings.py` and `app/policy.py`, tests in `backend/tests/test_settings.py`, table `travel_policy` from migration `20261117_100000`.)*

One policy for the whole company, behind Settings > Travel policy. Everyone signed in can read it, and only admins can change it. Until an admin saves one, built-in defaults apply: the web app's defaults, without Vistara, which merged into Air India. Amounts are INR.

The optimizer reads the current policy on every run, line-item edit and What-If preview:
- **Blocked**, with a ledger row: a hotel above the nightly cap (`max_nightly_rate` at home, `max_nightly_rate_intl` when the destination is outside India), rule `policy_hotel_cap`; and a business-class flight shorter than `business_class_min_hours`, rule `policy_business_class`.
- **Flagged**, so the trip can still be approved: a flight fare above `manager_approval_flight_over` ("needs manager approval"), and a trip starting sooner than `advance_booking_days` from the day it is optimized. Setting `advance_booking_days` to 0 turns that check off.
- **Tie-break only**: `preferred_airlines` win between options at the same price, never at a higher one.

### GET /policy
*(**Verified 2026-11-17.**)* Requires a valid JWT. `updated_at` and `updated_by` (the admin's email) are `null` while the defaults apply.

**Response (200 OK)**: the defaults:
```json
{
  "manager_approval_flight_over": 25000.0,
  "max_nightly_rate": 8000.0,
  "max_nightly_rate_intl": 18000.0,
  "business_class_min_hours": 6.0,
  "advance_booking_days": 14,
  "preferred_airlines": ["IndiGo", "Air India", "Emirates", "Singapore Airlines"],
  "updated_at": null,
  "updated_by": null
}
```

### PUT /policy
*(**Verified 2026-11-17.**)* Replaces the whole policy, so send all six fields. **Admins only.** A change is written to the audit trail as `POLICY_UPDATED`, with each changed field before and after. Saving the same values again writes nothing.

**Request:**
```json
{
  "manager_approval_flight_over": 25000,
  "max_nightly_rate": 7000,
  "max_nightly_rate_intl": 18000,
  "business_class_min_hours": 6,
  "advance_booking_days": 14,
  "preferred_airlines": ["IndiGo", "Air India"]
}
```

**Response (200 OK):**
```json
{
  "manager_approval_flight_over": 25000.0,
  "max_nightly_rate": 7000.0,
  "max_nightly_rate_intl": 18000.0,
  "business_class_min_hours": 6.0,
  "advance_booking_days": 14,
  "preferred_airlines": ["IndiGo", "Air India"],
  "updated_at": "2026-11-17T16:36:40.922425",
  "updated_by": "demo.viva@example.com"
}
```

**Response (403 Forbidden)**: a member tried to change it, `{ "detail": "Admin access required" }`

**Response (422 Unprocessable Entity)**: an amount of zero or below, `business_class_min_hours` outside 0 to 24, or `advance_booking_days` outside 0 to 365.

---

## Explore and Route
*(Built 2026-11-21: `app/routers/explore.py`, `app/places.py`, `app/dishes.py`, `app/roads.py`, `app/routing.py`; tests in `test_explore.py`, `test_dishes.py`, `test_routing.py`.)*

Both endpoints are separate from the optimizer: they never change a trip's prices, budget check or Trade-off Ledger. Both require a valid JWT and that the trip belongs to the requesting user (else `404 Trip not found`). When data can't be fetched they still answer 200, with empty lists and a `notice` saying why; nothing is ever filled in with a guess. Every item carries its source and a label (`Map data`, `AI suggestion`, `Photo: Wikipedia`).

### GET /trips/{id}/explore
Tourist attractions, restaurants and famous local dishes for the trip's destination.

- **Attractions and restaurants** come from [OpenTripMap](https://dev.opentripmap.org) (OpenStreetMap, Wikidata, Wikipedia; free key `OPENTRIPMAP_API_KEY`, 5,000 requests a day, non-commercial). The city is located with `geoname`, places within 10 km are listed with `radius` (heritage sites first, rating `3h`, then `3`, then `2`), and up to 30 candidates are looked up with `xid` for a description and photo. The 12 kept are ordered by OpenTripMap's own signals (heritage, Wikipedia article, photo, distance); closed and uncategorised places are dropped, and one site listed twice is kept once. Restaurants come from the `foods` category.
- **Dishes** *(Wikipedia only since 2026-11-25)*: the LLM only proposes up to six names (no numbers allowed). Each is looked up on Wikipedia, the exact title first, else a page search accepted only when the title shares a specific word with the dish, and the page must be about food (its short description names a dish, food, sweet, drink...: "Sannas" the cloth is dropped). A name without such an article is dropped. What is shown is Wikipedia's title, text and photo, `data_label: "Wikipedia"`, `ai_description: null`. Dishes saved before this (no `dishes_version: 2`) are fetched again.
- **Sections** *(added 2026-11-22)*: every attraction has `section`: `history_culture` (forts, monuments, museums, historic places, temples, churches, mosques, architecture, culture) or `explore` (nature, beaches, viewpoints, parks, amusements). Nature and sightseeing are searched on their own (OpenTripMap kinds `natural,view_points,gardens_and_parks,amusements`), up to 6, next to up to 12 history-and-culture places, so a city's famous temples don't crowd them out. A place appears in one section only.
- **OpenStreetMap details** *(added 2026-11-22)*: one [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) request per city adds `opening_hours` (OpenStreetMap's own format, e.g. `Mo-Su 08:00-20:00`), `cuisine` and the street `address` where OpenStreetMap has them, and finds named food markets and food courts (`food_spots`, up to 8; markets whose name says jewellery, clothes, supermarket and the like are left out). If Overpass is busy the places are kept without these fields. Every place also gets `map_url` (an OpenStreetMap link) and, when it has an OpenTripMap rate, `rating_label` saying what that number is (popularity 1 to 3, `h` = heritage; it is not a user rating).
- **Google Places (optional)** *(added 2026-11-22)*: with `GOOGLE_PLACES_API_KEY` set, up to `GOOGLE_PLACES_MAX` (default 6) restaurants are matched on Google (Places API (New) Text Search near the restaurant's own map point; used only when the result is within 300 m and shares a word of the name). A match adds `google` (`rating`, `rating_count`, `address`, `opening_hours` as weekday lines, `type`, `maps_url`, `data_label: "Live"`), a photo in `image` with `image_label: "Photo: Google"` and `photo_attribution` (the author Google requires to be shown). Google's data is never saved in `city_places`. Without a key nothing changes; a failure sets `google_notice`. It is paid: one Text Search and one photo request per restaurant.
- **Cache:** a city's places and dishes are saved in the `city_places` table for `PLACES_CACHE_DAYS` (default 30), so OpenTripMap, the LLM and Wikipedia are asked once per city. A failure is not saved, so it is retried next time. Cities saved before the fields above existed are fetched again once (`version` in the payload).

**Response (200 OK)** (shortened; one item of each list):
```json
{
  "city": "GOI",
  "city_name": "Goa",
  "centre": {"latitude": 15.4909, "longitude": 73.8278},
  "attractions": [
    {"id": "W12345", "name": "Basilica of Bom Jesus", "category": "Religious site",
     "description": "The Basilica of Bom Jesus is a Roman Catholic basilica ...",
     "image": "https://upload.wikimedia.org/...", "wikipedia": "https://en.wikipedia.org/wiki/Basilica_of_Bom_Jesus",
     "rating": "3h", "latitude": 15.5009, "longitude": 73.9116, "distance_m": 9117,
     "source": "OpenTripMap (OpenStreetMap, Wikidata, Wikipedia)", "data_label": "Map data"}
  ],
  "restaurants": [
    {"id": "N67890", "name": "Chai Pani", "category": "Cafe", "description": null, "image": null,
     "latitude": 15.49, "longitude": 73.82, "distance_m": 640, "data_label": "Map data"}
  ],
  "dishes": [
    {"name": "Bebinca", "ai_description": "A traditional multi-layered Indo-Portuguese pudding.",
     "image": "https://upload.wikimedia.org/...", "wikipedia_text": "Bebinca is a type of pudding ...",
     "wikipedia": "https://en.wikipedia.org/wiki/Bebinca",
     "data_label": "Wikipedia", "image_label": "Photo: Wikipedia"}
  ],
  "source": "OpenTripMap (OpenStreetMap, Wikidata, Wikipedia)",
  "fetched_at": "2026-11-21T10:12:00+00:00",
  "cached": true,
  "notice": null,
  "dishes_notice": null
}
```
*(Names and distances are from a live check on 2026-11-21; ids, coordinates and texts are shortened here.)*

Fields added 2026-11-22, from a live check in Goa: `Basilica of Bom Jesus` has `"section": "history_culture"`, `"address": "Old Goa"`; `Miramar` has `"section": "explore"`, `"category": "Beach"`; `food_spots` starts with `{"name": "Panaji Market", "category": "Market", "opening_hours": "Mo-Su 06:00-21:00", "data_label": "Map data", "source": "OpenStreetMap (Overpass API, © OpenStreetMap contributors)"}`. That first fetch took 50 s (place details are fetched five at a time).

**Notices:** no `OPENTRIPMAP_API_KEY` on the server, a destination outside the supported cities, OpenTripMap unreachable or rate-limited; for dishes, no LLM configured or a failed LLM call; `google_notice` when Google Places is set up but failed.

### GET /trips/{id}/route
Shortest road routes from the trip's hotel to its top attractions, computed with **Dijkstra's algorithm** on the real road network, and a visiting order.

**Query parameters (optional):** `stops`, 1 to 10, default 6 (the first attractions from `/explore` that have a location); `weight`, `distance` (default) or `time` *(added 2026-11-22)*: what Dijkstra minimises.

1. **Road graph:** one [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) query (free, no key, fair use) returns the drivable OpenStreetMap roads in a box around the hotel and stops plus about 1 km. Each road point is a node; each stretch between two consecutive points is an edge weighted by its length in metres. `oneway` and roundabout tags make edges one-directional. Cached by area for 7 days in server memory.
2. **Snapping:** the hotel and each stop attach to the nearest point on the largest connected road network (`to_road_m` says how far that was).
3. **Dijkstra:** our own implementation with a `heapq` priority queue, run once from each stop, gives the road distance between every pair of stops (tested against Bellman-Ford on random graphs).
4. **Order:** from the hotel, always the nearest unvisited stop by road. Stops no road reaches are listed in `unreachable`.

Distances are road metres between the snapped road points; `straight_m` is the straight line between the exact places.

**Travel time** *(added 2026-11-22, removed 2026-11-25 so that only real data is shown: routes now give real road metres only, with no `weight`, `estimated_minutes`, `total_estimated_minutes` or `time_label`)*: the same roads also form a second graph weighted by estimated driving seconds: the road's `maxspeed` tag when it is a plain number (km/h, or mph converted), otherwise a typical city speed for its class (motorway 80, trunk 60, primary 40, secondary 35, tertiary 30, unclassified 25, residential 20, living street 10 km/h). Every leg gives `road_m` and `estimated_minutes` along the path Dijkstra chose, and the route gives `total_estimated_minutes` and `time_label` ("Estimated from speed limits and typical road speeds, not live traffic"). With `weight=time` Dijkstra minimises those seconds, so a longer but faster road can win. Live check in Goa (hotel plus 5 stops): by distance 34.0 km and about 69 minutes; by time 35.1 km and about 67 minutes.

**Response (200 OK)** (shortened; live check in Goa on 2026-11-21):
```json
{
  "city": "GOI",
  "hotel": {"name": "Whoopers Boutique Hotel, Anjuna", "latitude": 15.5759, "longitude": 73.7470, "to_road_m": 13},
  "stops": [
    {"order": 1, "name": "Lower Aguada Fort extension", "category": "Fort", "latitude": 15.49, "longitude": 73.77,
     "to_road_m": 42, "road_m_from_hotel": 11300}
  ],
  "legs": [
    {"from": "Whoopers Boutique Hotel, Anjuna", "to": "Lower Aguada Fort extension",
     "road_m": 11300, "straight_m": 9000, "path": [[15.5759, 73.7470], [15.5741, 73.7488]]}
  ],
  "total_road_m": 40200,
  "unreachable": [],
  "source": "OpenStreetMap road network via the Overpass API (© OpenStreetMap contributors)",
  "data_label": "Map data",
  "notice": null
}
```
In that run the 27,294-node road graph took 26 s to load the first time, and the seven Dijkstra runs took 0.34 s together. Reis Magos Fort to Panaji was 7.7 km by road against 2.2 km straight, because the road goes round the river.

**Notices:** the trip isn't optimized yet (the route starts at its hotel), the hotel has no map location (optimize again), attractions can't be loaded, or OpenStreetMap roads are busy or unreachable.

**Response (422)**: `stops` outside 1 to 10, or `weight` other than `distance` / `time`.

---

## Transport and Journeys
*(`/transport` built 2026-11-21, worldwide and with ferries 2026-11-22; `/journeys` built 2026-11-22: `app/ground.py`, `app/journeys.py`, `app/routers/journeys.py`; tests in `test_ground.py`, `test_journeys.py`.)*

All need a valid JWT (every search spends SerpApi quota: the free plan has 250 searches a month). None of them change a trip's itinerary, budget check or Trade-off Ledger.

### GET /trips/{id}/transport
Flight, trains, buses and ferries for the trip's first day, side by side. Trains, buses and ferries come from Google Maps transit (SerpApi `google_maps_directions`, `travel_mode=3`) for **any two airport cities**; the day is searched from 05:00, 12:00 and 19:00 in the origin's time zone (three searches, cached), so night departures are included. Each option has `kind` (`train`, `bus`, `ferry`, from Google's own vehicle icon), `service`, `operator`, `from`/`to` stations, `departs`/`arrives`, `departure_time`/`arrival_time` (local date-times), `duration_minutes`, `changes`, `legs`, and a `fare` only when Google gives one (`fare_label` is otherwise "Not available"). The response has `trains`, `buses`, `ferries`, the trip's `flight` (null before it is optimized) and `comparison` (the fastest of each mode). Live check, Delhi to Jaipur on 12 Dec 2026: 14 trains and a FlixBus.

### GET /journeys
Direct and connecting journeys, including **cheaper routes through another city** (the instructor's Bhubaneswar → Hyderabad → Bengaluru example).

**Query parameters:** `origin`, `destination` (airport codes), `date` (not in the past); optional `modes` (comma-separated `flight,train,bus,ferry`, default all), `vias` (0 to 4, default 2; each via-city costs about two flight searches and two transit searches), `value_of_time` (rupees an hour of travel is worth for "best value", default 300), `travellers` (1 to 9: every fare is found per person and multiplied, so it costs no extra searches; each journey gives `fare` for everyone and `fare_per_person`), `via_depth` (1 or 2: with 2, journeys through two via-cities in a row are also tried, e.g. Bhubaneswar → Visakhapatnam → Hyderabad → Bengaluru, one extra leg search per pair of via-cities), `return_date` (also searches the way back on that day, returned under `return` in the same shape; doubles the searches), `via` *(added 2026-11-23)* (up to 3 airport codes in order, e.g. `GOI,BBI`: the traveller's own cities to go through instead of the picked hubs; each is tried alone and every pair in the given order, the way back goes through them in reverse, and the response has `via_chosen: true`; 422 for an unknown code, a repeat, or the origin or destination).

1. **Via-cities:** airports a small detour from the straight line (total distance at most 1.35 times the direct one, each leg at least 150 km, and nearer the destination than the origin is), ranked by detour with major hubs counted as a little shorter. The six busiest Indian airports (Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata) may be a detour of up to 1.6 times and come first, because they have the most flights and often the lowest fares. Bhubaneswar → Bengaluru tries Chennai and Hyderabad; Bengaluru → Jaipur tries Hyderabad, Mumbai and Delhi (and Pune with `vias=4`), never Chennai, which takes the traveller further away.
2. **Real departures:** every leg (origin → via, via → destination, origin → destination) is searched on Google Flights and Google Maps transit. Each departure becomes an edge of a time-dependent graph: it leaves a city at its departure time and reaches the next at its arrival time.
3. **Timetable rules:** a change needs at least 120 minutes between two flights on separate tickets, 150 minutes between a flight and a train or bus, 45 minutes between two trains or buses, and at most an 18-hour wait; no city is passed twice; at most 3 changes in all.
4. **Algorithm:** a multi-criteria Dijkstra (Martins' label-setting) over fare, arrival time, departure time and number of changes: labels leave the priority queue in order of arrival time, and in each city only labels not beaten on all four are kept. At the destination the journeys no other beats on fare, total time and changes are listed, plus the cheapest direct one, the cheapest through each via-city and the fastest of each mode.
5. **Fares:** a journey's fare is the sum of real fares. A leg without one (most trains and buses) makes the total `null` ("Not available: a leg has no published fare"), so such a journey can be the fastest but is never called the cheapest.
6. **Typical fare ranges** *(added 2026-11-23, removed 2026-11-25 with `app/fares.py`: only real fares are shown, and a journey with a leg whose fare isn't published has `fare: null`)*. What it did: for a train or bus inside India with no published fare, the leg gets `fare_estimate` `{low, high, currency: "INR", distance_km, label}` from the distance (track or road distance as 1.25 or 1.3 times the straight line; trains under 500 km: second sitting to AC chair car, longer: sleeper to AC 2-tier; buses: state transport to private AC sleeper, calibrated on published fares). A journey whose `fare` is `null` gets `fare_estimate` `{low, high, currency, label}` for all travellers, adding real fares and estimates; it is `null` when every fare is real, or when a leg has neither. The estimate only says whether an option is likely to fit a budget: it is never a fare and never makes a journey the cheapest.

**Flights only through two cities** (the "Bengaluru → Goa → Delhi → Jaipur can beat a ₹30,000 festival-time direct flight" case): `modes=flight&vias=4&via_depth=2` tries every via-city and every pair of them in a row, 15 flight searches. Live check on 2026-11-23 for Bengaluru → Jaipur on 24 Dec 2026 (13 seconds): direct IndiGo 6E469 ₹12,116 was the cheapest that day; through Pune ₹13,706, Mumbai ₹16,040, Delhi ₹16,815, Hyderabad ₹17,367, and the response said so. The unit test `test_flights_only_through_two_cities` checks the case where the direct fare is ₹30,000 and Goa + Delhi costs ₹18,000.

**Response (200 OK)** (shortened; live check on 2026-11-22, Bhubaneswar → Bengaluru on 12 Dec 2026, flights only, two via-cities):
```json
{
  "origin": {"code": "BBI", "name": "Bhubaneswar"},
  "destination": {"code": "BLR", "name": "Bangalore"},
  "date": "2026-12-12",
  "via_cities": [{"code": "MAA", "name": "Chennai"}, {"code": "HYD", "name": "Hyderabad"}],
  "via_summary": [
    {"city": {"code": "MAA", "name": "Chennai"}, "journey": "J-4", "fare": 13454.0, "difference_from_direct": 1297.0,
     "note": "₹1,297 more than the cheapest direct option"},
    {"city": {"code": "HYD", "name": "Hyderabad"}, "journey": "J-3", "fare": 13152.0, "difference_from_direct": 995.0,
     "note": "₹995 more than the cheapest direct option"}
  ],
  "journeys": [
    {"id": "J-3", "kind": "connecting", "separate_tickets": true, "via": [{"code": "HYD", "name": "Hyderabad"}],
     "modes": ["flight", "flight"], "departure_time": "2026-12-12T14:40:00", "arrival_time": "2026-12-12T22:50:00",
     "duration_minutes": 490, "transfers": 1, "transfer_waits": [{"city": {"code": "HYD", "name": "Hyderabad"}, "minutes": 295}],
     "fare": 13152.0, "currency": "INR", "fare_label": "Sum of real fares",
     "legs": [{"mode": "flight", "service": "Star Air S5662", "fare": 8001, "data_label": "Live"},
              {"mode": "flight", "service": "Alliance Air 9I818", "fare": 5151, "data_label": "Live"}]}
  ],
  "recommendations": {
    "cheapest_direct": {"journey": "J-2", "reason": "Lowest fare without changing: ₹12,157 (IndiGo 6E6085), 2h 05m."},
    "cheapest_connecting": {"journey": "J-1", "reason": "Lowest fare with a change: ₹10,933 (IndiGo 6E631 (1 stop)), 4h 05m. ₹1,224 cheaper than the cheapest direct option, 2h 00m longer."},
    "fastest": {"journey": "J-5", "reason": "Shortest time from departure to arrival among the departures found: 2h 00m (IndiGo 6E611, ₹18,142)."},
    "best_value": {"journey": "J-1", "reason": "Best balance of fare and time, counting each hour of travel as ₹300: ₹10,933 for 4h 05m (IndiGo 6E631 (1 stop))."}
  },
  "searched": [{"from": "BBI", "to": "BLR", "mode": "flight", "found": 14, "error": null}],
  "method": "Time-dependent multi-criteria Dijkstra (Martins' label-setting) over real departures: fare, arrival time, departure time and number of changes.",
  "notice": null
}
```
On that day going through Chennai or Hyderabad on separate tickets cost more than flying direct, and the cheapest option was Google's own one-stop IndiGo ticket; the response says so instead of assuming a connection is cheaper.

**Response (422):** unknown airport code, the same city twice, a past date, or `modes` other than `flight,train,bus,ferry`. **401** without a login.

### GET /trips/{id}/journeys
The same search for a saved trip's origin, destination and first day (same optional parameters, plus `include_return=true` to also search the trip's last day the other way). 404 for someone else's trip.

**Official Indian Railways fares** *(added 2026-11-25, `app/rail_fares.py`, tests in `test_rail_fares.py`)*: an Indian train without a change gets `class_fares` (rupees per person for 2S, SL, CC, 3E, 3A, FC, 2A, 1A), `class_fares_label` ("Official fare for 294 km") and `rail_distance_km`, or `class_fares: null` with `class_fares_note` saying why. Sources, both free and official: the basic fare tables of Mail/Express services in Railway Board Commercial Circular No. 24 of 2025 (in force from 26 Dec 2025; read from the circular's scanned tables and checked against them row by row) with its minimum distances, reservation fees and superfast charges, 5% GST on AC classes and First Class, rounded up to a multiple of 5 rupees; and the train's own distance between the two station codes Google gives, from the Ministry of Railways timetable on data.gov.in (Dec 2017, NDSAP). 2A and 1A use the peak-season table, which applies to popular trains all year. When Google publishes no fare, the main `fare` is the Sleeper fare (Second sitting under 200 km), with `fare_label` "Sleeper: official fare for 294 km" and `fare_class`. Trains with their own tariff (Rajdhani, Shatabdi, Duronto, Vande Bharat, Humsafar, Garib Rath, specials in the 0 series...) and trains or stations missing from the 2017 timetable get no fare. Live check, Delhi Cantt → Jaipur on 12 Dec 2026: 15014 Ranikhet Express SL 210, 3A 520; 12414 Galta Dham Pooja SF Express SL 240, 3A 565; Daurai Shatabdi: own tariff.

**Provider links:** train and bus options (here and in `/transport`) carry `link` and `link_label` to the operator's own site when it is known: IRCTC for Indian Railways, FlixBus, Eurostar, and redBus for other buses in India; flight legs link to the Google Flights search. These are plain links: no availability, seat or price is read from them.

---

## Airports and Discovery
*(`/airports` built 2026-11-21; `/destinations` and `/places/nearby` 2026-11-22: `app/routers/airports.py`, `app/routers/discover.py`; tests in `test_airports.py`, `test_discover.py`.)*

### GET /airports and GET /airports/{code}
No login. `GET /airports?q=varanasi&limit=10` searches the 4,007 airports with scheduled flights (OurAirports, public domain): an exact code or city first, then names starting with the text. Each airport: `code`, `city`, `country`, `country_name`, `airport`, `latitude`, `longitude`, `size`, `timezone`. `GET /airports/{code}` returns one, or 404 "Unknown airport code".

### GET /destinations/{code}
Everything about a destination without a trip: the same lists as a trip's Explore (attractions with their `section`, restaurants, `food_spots`, dishes, Google details when set up), plus `country_name`, `location` (the airport's coordinates) and `overview`: the city's Wikipedia summary (`title`, `text` up to 600 characters, `image`, `wikipedia`, `image_label: "Photo: Wikipedia"`), or `null` when Wikipedia has no page for it. Needs a login; 404 for an unknown code. Live check: Varanasi's overview begins "Varanasi, or Kashi, is a city on the Ganges river in northern India ...".

**Day trips and famous hotels** *(added 2026-11-23, `app/wikidata.py`, tests in `test_wikidata.py`; also on a trip's Explore)*: `day_trips` are famous forts, palaces, temples, national parks, lakes, waterfalls and heritage sites 15 to 150 km from the city centre (80 km when the wider search is too slow, e.g. around Delhi), and `famous_stays` are hotels within 25 km. Both come from Wikidata's free query service, need an English Wikipedia article, are ranked by how many Wikipedia languages write about them (`fame`), and have the same fields as an attraction (`distance_m`, `image` from Wikimedia Commons or null, `wikipedia`, `data_label: "Wikidata"`), plus `kind`, `fame` and `wikidata`. A day trip already listed among the attractions is left out. `around_from` says what distances are measured from ("the city centre", or "the airport" when the centre isn't known), `around_notice` why a list is empty. Cached in server memory for a week. Live check: Jaipur → Fatehpur Sikri, Keoladeo National Park, Amber Fort, Ranthambore, Pushkar Lake, Bhangarh Fort, Sariska; hotels Rambagh Palace, Diggi Palace, The Oberoi Rajvilas. Goa → Jog Falls, Dudhsagar Falls, Basilica of Bom Jesus; Mumbai hotels → Taj Mahal Palace, Oberoi Trident.

### GET /places/nearby
Attractions (up to 8, with photo and description when OpenTripMap has them) and restaurants (up to 8) around a point. **Query:** `lat`, `lon`, optional `radius_m` (500 to 10,000, default 3,000). Meant for the browser's location once the user has allowed it; the point is sent to OpenTripMap only and cached in server memory by about 100 m. Needs a login. Live check in Panaji: Our Lady of the Immaculate Conception, Fontainhas, Reis Magos Fort, Kala Academy, Miramar.

---

## Dashboard & Audit
*(`GET /audit` built 2026-11-12, `GET /dashboard` 2026-11-13.)*

### GET /dashboard
*(**Built 2026-11-13**, `app/routers/dashboard.py`, tests in `backend/tests/test_dashboard.py`; response below captured from the running app.)* Returns total spend, average savings and average turnaround time for a period (PRD US-010). Requires a valid JWT. **Admins see the whole team's trips, members only their own** (the PRD story is written for an admin, and members get the same numbers for their own trips).

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

Returns audit event history, newest first. Independent of dashboard aggregation — every pipeline run and decision is recorded here regardless of what the dashboard shows (PRD: Audit trail, US-010). Requires a valid JWT. **Admins only** *(changed 2026-11-22, the instructor's request)*: admins see every user's events, and everyone else gets `403 {"detail": "The audit trail is for admins only"}` — enforced by the API, not just by hiding the menu. Events are still recorded for every user's actions. Events are append-only: nothing in the API edits or deletes them, and re-optimizing a trip replaces its itinerary but keeps every earlier `PIPELINE_RUN` here.

**Recorded events:** `TRAVELER_CREATED`, `TRAVELER_UPDATED` (payload has `before`/`after`), `TRAVELER_DELETED`, `TRIP_CREATED`, `PIPELINE_RUN` (what was chosen, the total, the flags, the rationale and the data source of each option), `PIPELINE_FAILED` (with the reason), `REVIEW_STARTED`, `DECISION` (outcome, reason, and the itinerary as it stood when decided). `ITINERARY_EDITED` (which line item was swapped, and the total before and after). `TRIP_UPDATED` (each changed request field before and after, and whether a saved itinerary was dropped). `POLICY_UPDATED` (each changed policy field before and after). `PIPELINE_RUN` and `PIPELINE_FAILED` also carry `run_ms`, how long the optimizer took. An action that fails (e.g. a 409) records nothing — the event is saved in the same transaction as the action.

**Who did it:** `actor` is the user's email. It never changes, so use it to filter by person. `actor_name` *(added 2026-11-17)* is their display name, or `null` if they haven't set one. It is looked up when the trail is read, so a name set later shows on earlier events too. A captured event:
```json
{
  "id": "14e9d74b-aa8d-4e6c-9da4-2fb99bad29cf",
  "trip_id": "729ad274-44c1-408a-b462-dd906051f07d",
  "event_type": "REVIEW_STARTED",
  "actor": "demo.viva@example.com",
  "actor_name": "Priya N.",
  "summary": "Started review of BLR→DEL",
  "payload": {},
  "created_at": "2026-11-17T16:36:55.813785"
}
```
The longer example below was captured before `actor_name` existed.

**Query parameters (all optional):** `trip_id`, `event_type` (one of the names above), `limit` (1–500, default 100).

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
