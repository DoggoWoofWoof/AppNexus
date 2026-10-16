# Field Pro: the sales rep's daily workspace

15 October 2026 · Product-flow discussion. The user's latest direction is that Field Pro is the landing experience, account/target setup happens on our side, and the app helps reps decide, plan, prepare, visit and follow up. The pasted colleague conversation provides context; it is not authority to change production, contact people or schedule meetings.

This builds on the 58 feature families in `repository-feature-map.md`. Those capabilities remain in the coverage register. This document changes the proposed front door and connects the products into a daily workflow; it does not remove advanced features or certify backend readiness.

Comparable-product research is recorded in `comparable-apps-review.md`. It proposes refinements for visit feasibility, cadence, cancellation recovery, site grouping, offline preparation and follow-up ownership. These are recommendations for the next flow review, not automatically accepted new build scope.

## Product promise

Help a sales rep answer: Who should I reach out to, why, how does it fit my day, what should I know, and what should happen afterwards?

Field Pro opens on Today. The route planner is a planning tool inside that workspace. The rep can begin with existing commitments, assigned targets, a due follow-up, a search, a map or a question.

"Generalist" is interpreted here as a proactive work companion that connects these tasks. A conversational entry can supplement visible actions. Core actions remain available through labeled controls and lists.

## What we offer and where it helps

| Capability | Rep's job | Existing product foundation |
|---|---|---|
| Assigned targets and territory | Know which HCPs/HCOs belong to the rep's book | Field Pro setup, views, books, lists and territories |
| Discovery and geographic exploration | Find a relevant person/account, including nearby targets | HCP/HCO search, Opportunity Map, real entity/practice coordinates |
| Full HCP/HCO intelligence | Understand identity, affiliations, clinical activity, research, contacts and organization performance | Full provider and organization profiles, scoped claims, research, network, payments and other permitted sections |
| Account/opportunity analysis | Understand the evidence for prioritizing an account | Field Pro role views, leakage/market analysis, HEMA Workbench and report services |
| Day and route planning | Select visits, arrange stops, inspect travel and reach the next location | Existing route selection, matrix/ordering and directions handoff; timed agenda is additional product work |
| Visit and insight capture | Record the interaction, learning and next step | Existing per-HCP visit notes; text, audio and file-based Insights capture/transcripts |
| Follow-up and CRM | Preserve commitments and see what has saved or synced | Insights follow-ups/tasks and company-gated CRM flows; Field Pro push is disabled in reviewed source |
| Summaries and outputs | Review learning and prepare/share analysis | Insights summaries/analytics, PDFs/PPTs and report libraries |

## Setup belongs to our side

Our side prepares the user/company/team context, authorized sales view, assigned HCP/HCO targets, territory, applicable procedure/drug groups and enabled integrations. The rep signs in and receives the configured workspace.

Only unresolved user-specific choices appear in the app: for example, choosing among assigned workspaces or setting a starting location when planning travel. Manual city/address selection remains usable when current location is not available. No target-upload wizard is required before an already-configured rep can work.

Missing or stale setup gets a clear status and recovery path. An empty server response or failed assignment load must not be rendered as evidence that the rep has no targets.

## Today: the proposed landing experience

Keep the welcome brief. The first useful content depends on the rep's state.

| State | Primary content | Primary action |
|---|---|---|
| No plan | Due follow-ups where available; a short, explained set of suggested assigned targets; access to the full target book | Plan my day |
| Day planned | Next commitment/stop, time or position in the day, location, and the remaining agenda | Prepare / Continue day |
| Work in progress | Current visit or draft, upcoming commitment and any relevant travel change | Resume |
| After a visit | A short capture prompt for that person/account context | Add visit outcome |
| End of day | Actual completed work, outstanding follow-ups and unsaved/unsynced items | Finish notes / Resolve pending saves |

My targets is a prominent, persistent entry in the Field Pro workspace. A rep can open the entire assigned HCO/HCP book at any time without beginning a route. Discovery has List and Map views sharing the same selection and filters. The map is useful when planning geography; it need not consume the first screen every time the app opens.

A short summary can show scheduled items, due follow-ups and incomplete notes. Measures are derived from the relevant records. Profile research counts, payment totals and large account dashboards stay in the preparation/analysis flow rather than filling Today.

## Suggestions: explain the reason

The proposed initial priority order is: fixed commitments and due follow-ups, explicit customer/rep priority, relevance to the configured territory/group, then travel feasibility/proximity. This is a proposed policy, not an existing verified recommendation service or a revenue score.

Each suggestion has a short truthful reason: Follow-up due, Assigned target, Matches selected procedure group, or Near your chosen starting point. Show only reasons backed by available data. Missing history is not the same as never contacted; proximity is not proof of opportunity.

The rep can switch between Recommended and Nearby, open a profile, dismiss a suggestion for today or select a different assigned target. Searches outside the book remain explicitly labeled. Adding a stop does not silently change the assigned target book.

## Build a usable day

1. Select the people/accounts to visit, from suggestions, the book, Search or Map.
2. Inspect a brief or full profile as needed, then Add to today. The chosen HCP and actual practice location matter when the HCP works at several sites.
3. Choose the visit type and, where useful, a goal. Calls and remote follow-ups can occupy the agenda without becoming driving stops.
4. Add fixed appointment times when known; leave other visits flexible. The user has chosen this mixed model for flexibility. It is a product decision, not a claim that actual rep behavior has been researched.
5. Review the ordered visits and travel estimates. Optimize flexible stops around fixed commitments; flag conflicts and let the rep adjust. Never silently move a fixed appointment.
6. Save the plan and return to Today. Editing, skipping and rescheduling preserve the remaining plan and capture context.

Adding a target to today means the rep intends to contact or visit them. A time chosen by the rep is a planned time. Confirmed appointment requires a separate explicit status or a verified scheduling source. A physician's observed operating weekday is not a statement that the physician is available for a meeting.

The first version should present an ordered agenda with optional fixed times. A flexible item can remain "Anytime today" until the rep schedules it; no placeholder meeting time is invented. Calls and remote follow-ups do not require a travel location. Route suggestions arrange flexible in-person stops around fixed commitments and surface conflicts for the rep to resolve. Calendar invitations, availability checking and booking integrations remain separate capabilities whose support must be verified.

The planner distinguishes Flexible, Planned time and Confirmed appointment. Entering a time alone never changes an item to Confirmed. Adding an item requires only its target and activity type; time, duration and goal can be supplied when relevant. Completing an item, skipping it for today and moving it to another day are separate actions.

## Prepare, act and capture

Selecting an agenda item opens the relevant person/account with a compact preparation brief: who/where, visit goal, relevant past conversation/follow-up when available, and a small set of scoped facts. Full profile sections stay directly reachable through the named section index. Role-specific analysis and reports remain available here.

Afterwards, ask for the outcome, discussion and next step. Text, recording and upload are available through the appropriate capture path. Prefill the known people, account and date so the rep is not re-entering context.

The two current capture paths must remain semantically distinct:

- Quick visit note writes existing HCP notes. Starting from an account requires selecting the HCPs met; the existing path has no independent account-note store.
- Add insight captures text/audio/files with meeting context, then processes and exposes transcript/insight/summary review. Generated content remains editable and distinct from the original input.

Follow-up text and a due date can be created from the review flow using the appropriate existing service. An extracted suggestion does not become an assigned commitment until the rep accepts it. Visited, attempted, skipped and rescheduled are different outcomes. A passed agenda time or completed drive does not prove a meeting took place.

## Saving and the backup idea

The desired experience is automatic draft saving and prompt remote persistence, with queued retry during poor connectivity. The end-of-day view checks outstanding work. A nightly batch must not be the first time notes are protected.

Show the relevant states separately: On this device, Waiting to upload, Saved to DocNexus, and CRM sync status. Device draft recovery, server persistence, cross-device plan recovery and CRM sync are distinct guarantees.

Current source has local route/day state and Insights draft recovery, plus server-side notes/transcripts/follow-ups. A full account-scoped, cross-device daily plan and automatic cloud backup/restore are not established by those pieces. They need a deliberate persistence/recovery design; they cannot be claimed merely by putting the route on a timeline.

## Full feature exposure alongside Today

The earlier five-destination idea remains a discussion proposal. Today is the default screen inside Field Pro. Within it, My targets, Routes, Map, Territories, role-specific workbenches and authorized Team functions have named entries. Search, Reports, Insights and Activity provide stable destinations for the broader features.

Every existing feature-family ID still needs a destination, permission rule and availability state. The planner is the daily starting point, while the complete product remains accessible through its named destinations and contextual actions.

## Existing foundations and additions

| Area | Source evidence | Additional work to establish |
|---|---|---|
| Route | A `AccountWorkspace/lib/route.ts` and `hooks/useAccountRoute.ts`: day-scoped picks/order stored locally; drive times recomputed | Durable multi-day plan, scheduled slots, conflict handling and cross-device restoration |
| Original Field day helpers | A `Workflows/useTodayPlan.ts`: a separate product's local done/skipped/picked queue | Reuse only after reconciling semantics; do not treat its local progress as a saved visit |
| Time | Shared `planDayKey()` currently uses UTC in reviewed web source | Rep-local timezone and explicit rollover behavior for the new daily workspace |
| Follow-ups/tasks | D target-list follow-up routes and `server/routes/tasks.js` support due dates/status | Common agenda projection and linking to the correct underlying record; not automatically a calendar service |
| Capture protection | D `client/src/utils/draftStorage.ts` protects typed/recording submissions locally | Native persistence, retries, recovery and device/server state design for the new app |
| Suggestions | Assigned book, scoped measures, coordinates and follow-up records exist in different modules | Evidence-based recommendation rules, eligibility, freshness and explanations |
| CRM | Different Field Pro/profile/Insights paths and company gates | Verify exact supported payload/source/company before presenting a push as available |

## Questions to resolve before the next mockup

Resolved: the user selected a combination of fixed appointments and flexible visits/calls. Proceed with that product model; do not require the user to establish representative sales behavior before continuing.

1. What is the reliable source of target priority and contact/visit recency for this customer? Which histories can be joined by stable identity? Resolve from the existing services where possible.
2. Which existing service can persist and recover the plan without inventing an unsupported endpoint? Field_Backend server review remains necessary for complete integration verification.

No production calendar, location, CRM or backup integration has been configured by this document. No automatic outreach or meeting invitation is part of the proposed suggestion action.
