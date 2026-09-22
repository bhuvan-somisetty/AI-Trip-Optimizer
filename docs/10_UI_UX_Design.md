# UI/UX Design

> **Provenance:** Entirely the team's own UI/UX design, built to satisfy the PRD's acceptance criteria (cited inline). React/Next.js is officially mandated (brief field `tech_stack`); Tailwind CSS is officially suggested (brief field `suggested_libraries_tools`) — shadcn/ui is the team's own addition on top of that suggestion.

> **Amended 2026-09-16:** The Trip Knowledge Assistant chat panel screen removed — the instructor cut RAG-based features from scope ("RAG is not needed," see `03_PRD.md` amendment, `17_Risk_Register.md` R-011).

## 1. Design Principles (from PRD Product Principles)
- **Evidence before explanation** — show the data (prices, rules) before or alongside the prose rationale, never prose alone.
- **Human-in-the-loop** — every itinerary screen makes Approve/Reject/Edit visibly available; nothing auto-finalizes.

## 2. Core Screens

### Trip Request Form
Traveler selection (or create new), dates, budget, preferences (free text + structured tags). Submitting creates a `DRAFT` trip.

### Itinerary Result View
*(Amended 2026-09-09: CO2 estimate removed, cut per instructor instruction — see `03_PRD.md` amendment note.)*
- Chosen flight + stay, total cost — shown as data first.
- **Trade-off Ledger panel** — every alternative considered, listed with price and a one-line structured reason (won/lost + why); this is the differentiator UI, not an afterthought accordion.
- Budget/constraint flags — each issue visibly tagged with the specific rule and offending line item (not buried in the rationale paragraph).
- Rationale text — references the specific chosen items and never states a number not already shown above it.
- Approve / Reject (reason required) / Edit line item (recalculates total live).

### Dashboard (Admin)
Total spend, average savings, average turnaround time for a selected period; a link through to full audit history rather than duplicating it.

### What-If Simulator (stretch)
Side-by-side or diff view: original itinerary vs. the previewed change, with changed fields visually highlighted; an explicit "Save this instead" action, since previews don't persist until approved.

## 3. Component Library
Tailwind CSS + shadcn/ui — pre-built, accessible components (forms, dialogs, tables, tabs) copied into the project and owned directly, rather than built from scratch. Keeps a beginner team from re-solving basic accessibility/interaction problems.

## 4. Accessibility
Baseline WCAG-oriented practices on the dashboard and forms (label associations, keyboard navigation, sufficient contrast) — not a formal audit, but a stated NFR (see `04_TRD.md` §7 and BRD §8).

## 5. Not in Scope for MVP UI
Mobile-native app, offline mode, multi-language UI — none required by the PRD; see Out of Scope in `01_Project_Overview.md`.
