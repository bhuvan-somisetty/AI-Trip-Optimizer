# Mock Data Specification

> **Provenance:** Use of mock/sample data (rather than live supplier data) is the team's own inference from the PRD's principles and general student-project constraints — it is not a literal instruction on the brief sheet (see `00_Investigation_Report.md` A5). The specific field schemas and data-volume guidance below are entirely the team's own design.

This file specifies what mock flight/hotel/knowledge data should look like so it's realistic enough to demo the optimizer meaningfully.

## 1. Mock Flights (`data/mock_flights.json`)
*(Amended 2026-09-09: `co2_kg` field removed — CO2-aware optimization was cut per instructor instruction, see `03_PRD.md` amendment note.)*

Each record should carry enough fields for the budget/constraint check to be meaningful:
```json
{
  "id": "FL-1001",
  "origin": "BLR",
  "destination": "DEL",
  "departure_time": "2026-10-12T06:15:00",
  "arrival_time": "2026-10-12T08:45:00",
  "airline": "Sample Air",
  "price": 6200,
  "cabin_class": "economy",
  "stops": 0
}
```
Recommended coverage: multiple price points per route (budget vs. premium), at least one red-eye and one daytime option per route, and a mix of direct/connecting flights — so the Trade-off Ledger has genuinely different reasons to reject options (price, timing, stops), not just one dimension.

## 2. Mock Hotels (`data/mock_hotels.json`)
```json
{
  "id": "HT-2001",
  "city": "DEL",
  "name": "Sample Central Hotel",
  "price_per_night": 3800,
  "rating": 4.2,
  "amenities": ["wifi", "breakfast_included"],
  "distance_to_center_km": 1.5
}
```
Recommended coverage: a spread across budget/mid/premium price tiers per city used in flight data, so budget-constraint rejections have real alternatives to compare against.

## 3. Sample Knowledge Documents
At least one sample document per common travel-policy topic, to give the RAG assistant something meaningful to retrieve from:
- A visa/entry-requirements summary for 1–2 sample destinations.
- A preferred-vendor / travel-policy document (e.g., "flights over ₹X require manager approval").
- A general FAQ (baggage policy, expense submission process).

These should be short (1–3 pages) plain-text or PDF files, ingestable via the `pypdf` pipeline described in `08_GenAI_Architecture.md`.

## 4. Data Volume Guidance
Enough variety to make the optimizer's reasoning non-trivial (at least 3–4 flight options and 3–4 hotel options per route/city used in the demo), but not so much that seeding becomes its own project — this is explicitly a mock dataset, not a production catalog (see Out of Scope in `01_Project_Overview.md`).

## 5. Ownership
Per the team split in `16_Team_Responsibilities.md`, mock data authoring sits with Workstream A (Product, Data & Optimizer) — it should be ready early in Month 1 so the pipeline isn't blocked waiting on data.
