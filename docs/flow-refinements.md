# Flow refinements — planner-first, cancel recovery, glanceable brief

17 October 2026 · Rep pain drives this: doctors are busy, cancellations happen,
and the rep needs the next-best move fast. Simplicity over coverage — no new
destinations, no redundant info. Builds on `sales-rep-daily-flow.md` and
`comparable-apps-review.md` (CG01 feasibility, CG03 recovery); those were
proposals, this records the agreed behavior.

## 1. Cancel → alternatives (the core loop)

Trigger: a planned item is cancelled (by rep or as reported). Behavior:

1. The cancelled stop leaves a dated gap; **fixed commitments never move**.
2. The app offers up to 3 feasible alternatives for that gap, ranked by:
   road travel from the previous/next stop, visit duration + buffer fit,
   due follow-ups first, then assigned priority. No invented scores — every
   suggestion carries its reason (due follow-up, near previous stop, fits
   the 45-min gap).
3. One tap applies: replace, add a remote call instead, or leave the gap open.
   Silent auto-refill is forbidden.
4. Infeasible suggestion sets explain themselves ("nothing within 20 min that
   fits before your 2pm").

Needs (integration): road travel matrix, visit durations + buffer config,
workday bounds. Until then the demo simulates with straight-line distance
labeled as such.

## 2. Glanceable HCP brief (seconds, not minutes)

The HCP overview answers five questions and nothing else:

1. Who — name, specialty, NPI on request.
2. Where — today's practice site and its access notes, if known.
3. Why now — the one reason (due follow-up, matches group, near stop).
4. Last touch — latest conversation outcome + open follow-up, if any.
5. Next step — Prepare (full profile) or Log visit.

Everything else (research counts, payments, full claims) stays one tap down
in the named section index. If a fact is unavailable it reads unavailable,
never interpolated.

## 3. Meeting prep pack (brief + evidence)

Prepare = the brief plus, only when they exist: open follow-ups for this
person/account, the latest relevant report or insight with source link, and
an offline-ready marker with last-updated time. No fabricated collateral,
no auto-generated briefs presented as verified — AI-enriched content stays
labeled.

## 4. Booking appointments (explicit, then integrated)

Three states, never conflated: **planned time** (rep's intent) →
**requested** (sent, awaiting confirmation) → **confirmed** (explicit source:
calendar acceptance or rep-marked). Entering a time never confirms.

Integration is a handoff, not a rebuild: hold the slot in the day plan,
export an .ics or push to the connected calendar (provider TBD — Google /
Outlook decision open), and link the acceptance back to the plan item.
Availability checking and double-booking prevention need the calendar
contract first; until then the planner warns on overlaps and lets the rep
resolve.

## Current prototype pass

- Today: the next appointment appears once; later visits form a compact agenda. Cancellation opens alternatives (tentative visit / call / leave gap / undo). Several unresolved cancellations remain visible.
- HCP overview: five-question brief layout; move research/payment aggregates
  below the fold into the section index.
- Agenda items: planned/requested/confirmed chips; overlap warning blocks save.
- Prep entry: meeting goal, previous conversation, open follow-ups and a report/insight checklist. Selected material is explicitly not generated; no fake report or offline-ready marker appears.
- No new bottom tabs; booking lives inside the agenda item.

The prototype starts with two sample appointments so the cancellation flow is immediately testable. Candidates use fictional people at public facility locations. The cancelled person and already planned people are excluded; due follow-ups and straight-line proximity sort up to three candidates. They are **not verified feasible or available**. Replacing one keeps its original slot, creates an unconfirmed plan item and preserves other appointments.

The appointment form supports a personal planned time, manual confirmation and an explicitly unsent request draft. Overlap and day-boundary validation block invalid saves. Calendar sending, acceptance tracking, provider cancellation events, real road feasibility and generated report attachments remain integration work. See [the proposed contract](day-plan-contract.md).

## Integration decisions still open

1. Calendar provider + direction (read busy-ness, write holds, both?).
2. Source of truth for contact/visit recency per customer.
3. Which rep-progress measures, if any, appear on Today.
