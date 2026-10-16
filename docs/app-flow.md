# Field Pro — mobile flow proposal

Discussion update: `repository-feature-map.md` now records the first source review of all four supplied repositories. The three-destination concept below is provisional. Full feature exposure and the proposed five-destination flow must be discussed before another mockup; this document does not define final scope.

15 October 2026 · Navigation proposal for review. This records where capabilities belong; it does not claim all destinations are implemented or connected.

The app should follow the rep's task: choose an account → prepare → identify the relevant person → log a visit → review CRM sync. A capability can stay accessible without occupying the first screen.

## Three primary destinations

| Destination | Purpose | Visible first | Secondary destinations |
|---|---|---|---|
| My book | Work with assigned targets | Search, Accounts/HCP switch, identity/location and one relevant measure | One Filter & sort screen; display settings; profiles |
| Explore | Find someone or perform a separate analysis/planning task | Entity search, Ask AI, Reports, Route planner, Opportunity Map, Territories | Search results, report detail, route stops, map filters |
| Activity | Capture and revisit conversations | Notes, entity context, follow-ups and honest sync state | Edit note; review CRM mapping and destination |

Workspace and sales view belong in the top app chrome. Setup, target-list import/matching, account management and display preferences live there. They do not require daily dashboard cards.

## Primary journey

1. Open My book. Load the rep's actual assigned records and current workspace context. No oversized summary dashboard.
2. Select an account. Land on Brief: identity, location, last conversation and relevant people. Log a visit is the primary action; Contact is secondary.
3. Open a person when needed. Retain the account context and Back path. HCP Brief prioritizes specialty and affiliation; NPI and deeper records are available on request.
4. Review specific information. HCO tabs: Brief / People / Details. HCP tabs: Brief / Research / Details. Detailed sections are grouped by meaning rather than displayed as a wall of cards.
5. Log the visit. Preselect the entity, keep the form short, preserve drafts per entity, save with an explicit state, then make CRM review available. Never mark a local draft as synced.

## Where the broader capabilities go

| Capability | Global entry | Contextual shortcut |
|---|---|---|
| HCP/HCO discovery | Explore → Find HCPs & organizations | Linked people/organizations in profiles |
| AI questions | Explore → Ask AI | Ask about this account/HCP from Brief |
| Leakage and report generation | Explore → Reports | HCO Details → Leakage & market |
| Routes | Explore → Route planner | Add stop can be considered after route contracts are checked |
| Opportunity Map | Explore → Opportunity Map | HCO Details → Account map |
| Territories | Explore → Territories | Book's Filter & sort |
| Target-list import / matching / assignment | Workspace → Manage target accounts | Profile → More actions → Add to target list |
| CRM | Activity → Review CRM sync; workspace connection settings | Profile → More actions → Sync with CRM |
| Export/PDF | No permanent global button needed | Profile → More actions → Export |
| Code scope, territory, state, city, type, sorting | My book → Filter & sort | Show the applied scope on relevant data |
| Capital/Clinical/HEMA/Enablement view | Workspace menu | Load server-authorized defaults; do not treat presentation changes as permission changes |
| Medical/pharmacy claims | Profile → Details | Relevant period-labeled snapshot in Brief, collapsed by default |
| Publications/trials | HCP → Research | Brief → Research shortcut |
| Payments, graphs, multimedia/social | HCP → Details → Industry & professional presence | None by default |
| HCO organization/capacity/network/quality/financials/reimbursements | HCO → Details, grouped sections | Specific questions or reports can link directly to a section |

## Rules that reduce clutter

- Each screen answers one primary question. My book answers "Which account?"; Brief answers "What do I need before the visit?"; Activity answers "What happened and what needs follow-up?"
- Keep commonly used actions visible. Collapsing rare information must not hide core identity, contact or note actions.
- Keep filtering, sorting, codes and geography in one place. Show applied-filter count, offer Reset and preserve filters through profile navigation.
- Avoid repeated empty messages on every book card. Show a latest note only when it exists and the display preference is enabled.
- Do not add money, research, capacity or quality cards simply because the web has those fields. Put the measure where it supports a decision, with period/source/scope.
- Use a visible Back path and stable primary navigation. Avoid forcing a user to restart from the book after inspecting an affiliated HCP.
- Restore disclosure state, selection and list position in production. The current local preview does not yet preserve scroll/disclosure state.

## Prototype boundary

The updated concept demonstrates the streamlined book, Brief/People/Research/Details hierarchy, filtering, workspace/menu placement, notes and grouped Explore entry points. AI, reports, maps, import/export, territory data and CRM remain explicit preview/empty states. Route selection can be reviewed, but no optimization, travel times or directions are computed. Sales-view switching changes the preview label only; it does not reproduce role-specific metrics or permissions. Field Pro parity still requires a full screen/field audit and existing API-contract inspection.

## Preview verification

Checked in the browser: the streamlined book and Brief hierarchy render, the NY filter reduces the sample book to Mount Sinai, linked HCO → HCP navigation works, and saving a visit opens Activity with the correct navigation selection. Notes are local to the preview. Visual review used the dark appearance; earlier layout customization and narrow-width checks are recorded in the design review.
