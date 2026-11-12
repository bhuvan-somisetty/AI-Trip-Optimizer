# Usability Check

> **Provenance:** the team's own plan for the informal usability check promised in `14_Evaluation_Metrics.md` §2 (Trade-off Ledger legibility) and `12_Testing_Strategy.md`. The questionnaire is the standard System Usability Scale (SUS, Brooke 1996), used as published.

**Status (2026-11-13):** ready to run. The sessions have not been held yet; fill in §5 after them.

## 1. What it checks
1. **Ledger legibility** (the open metric in `14_Evaluation_Metrics.md`): can someone who didn't build the app say why an alternative lost, from the Trade-off Ledger alone, without reading the rationale?
2. **The core flow** (PRD US-002, US-003, US-007, US-011): can they create a trip, optimize it, change a line item, try a what-if and decide, without help?
3. **Overall usability:** a SUS score.

## 2. Setup
- **Participants:** 2 or 3 people who are not on the team (classmates, friends). No travel or software background needed.
- **Where:** the live site, https://ai-trip-optimizer.vercel.app, on the participant's own laptop or yours.
- **Account:** sign up a fresh account per participant before the session, or let them use Sign in with Google. Add one traveler for them first ("Priya Nair"), so the first task starts at the trip form.
- **Route with real fares both ways:** DEL → BOM, departing 2026-12-02, returning 2026-12-05, budget 30,000. (Checked 2026-11-13; cached fares change, so re-check the day before. If it fails, the error lists the nearest dates that have fares.)
- **Roles:** one person reads the tasks and stays quiet; the other notes times, hesitations and quotes. Ask the participant to think aloud.
- **Time:** about 20 minutes each.

## 3. Tasks
Read each task out exactly; don't point at the screen. Note the time and whether they finished without help.

| # | Task (read aloud) | Done when | Watch for |
|---|---|---|---|
| T1 | "Plan a trip for Priya from Delhi to Mumbai, 2 to 5 December, with a budget of 30,000, and have the app optimize it." | the itinerary shows | finding the planner; the IATA codes; the date fields |
| T2 | "How much does the whole trip cost, and is it within budget?" | they say the total and yes/no | do they notice the return flight and the stay are included? |
| T3 | "The app didn't pick the IndiGo flight. Using the Trade-off Ledger, tell me why that flight lost." | they read out the row's reason | **ledger legibility**: do they answer from the ledger, without the rationale paragraph? |
| T4 | "Swap the hotel for a better-rated one and tell me what happened to the total." | the new total shows | finding Change / the swap button; noticing the trip moved to review |
| T5 | "What would happen if Priya only took non-stop flights? Check without changing the trip." | the What-if comparison shows | finding the What-if tab; reading the before/after table |
| T6 | "Reject this trip because the meeting moved online." | the trip shows Rejected | the reason field; the error if they leave it empty |

## 4. After the tasks
Ask them to rate each SUS statement from 1 (strongly disagree) to 5 (strongly agree):

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

**Score:** for odd items subtract 1 from the answer; for even items subtract the answer from 5. Add the ten numbers and multiply by 2.5, for a score from 0 to 100. Around 68 is average; above 80 is good.

Then ask two open questions: "What was the most confusing moment?" and "What would you change first?"

## 5. Results (fill in after the sessions)

| Participant | T1 | T2 | T3 (ledger) | T4 | T5 | T6 | SUS | Most confusing moment |
|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | |
| P2 | | | | | | | | |
| P3 | | | | | | | | |

For each task write the time and Y (done alone), H (needed a hint) or N (gave up).

**Ledger legibility is met** if every participant answers T3 from the ledger without a hint. Copy the outcome and the average SUS into the self-assessment table in `14_Evaluation_Metrics.md` §4, and turn the top confusing moments into issues.
