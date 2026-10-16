# Field Pro app: surface-area audit

Responsive update: `responsive-design-contract.md` assigns shared layout rules to all 39 families. The current concept is `field-pro-responsive.html`, with Phone, Wide screen and Large text views. The endpoint/progress distinction is recorded in `plan-status-and-endpoint-audit.md`.

16 October 2026 · Proposed information architecture before the next mockup. This audits the 58 feature families in `repository-feature-map.md`, the accepted mixed fixed/flexible day and the comparable-app research. It does not claim that all source fields or backend contracts have been verified.

Map update: `map-experience.md` records the optional Today map card, shared Targets List / Map view and the requirement to use road routing for production travel times. The current `field-pro-responsive.html` and published `demo/` incorporate real static geography and interactive sample pins; live map/routing services remain unconnected.

## Recommendation

Use **four stable primary destinations: Today, Targets, Activity and Insights**. Field Pro remains the product and opens on Today. Search is a shared header action. Reports is a prominent named destination inside Insights, with contextual entry from profiles and Today when a job is running. Workspace, team and administration are named entries in the app chrome, subject to existing permissions.

The earlier five-destination proposal split Search into a top-level product and left the assigned book inside Field Pro. This audit instead organizes navigation around the rep's repeated jobs: plan work, find people/accounts, review recorded work and investigate evidence. This is a design recommendation, not an instruction to alter backend product boundaries or merge data stores.

| Destination | Shown first | Named secondary destinations |
|---|---|---|
| Today | Next action and selected day's agenda; suggestions when unplanned | Plan editor, route review, date picker, relevant profile brief, capture and day wrap-up |
| Targets | Assigned accounts/people; explicit discovery scope | Map/Opportunity Map, search/filter results, lists/territories, import/match where authorized |
| Activity | Recorded visits, conversations and outstanding work | Drafts, follow-ups, transcript review, saved-work status and CRM |
| Insights | Reports featured, plus clearly named analysis tools | HEMA, My insights/analytics, summaries, insight target lists, referral analysis, sources and compliance |

Reports and the other tools must remain visible as labeled entries, not hidden inside an ellipsis. Keep an optional role-specific shortcut on Today rather than multiplying the bottom tabs. Map/list are views of the same selected targets. Capture is an action with retained context, not a bottom navigation destination.

## What the counts mean

The full design inventory is **39 screen families, 12 reusable sheets/dialogs and 16 cross-cutting states**. These are planning estimates backed by the inventory below, not screens already implemented.

The full profiles expose **18 HCP and 19 HCO named destinations**, a union across supported entity types and permissions. Two are the overview screens; the other 35 use the section workspace's shared navigation/chrome. Those 35 still need section-specific content components, charts/tables and empty/error behavior. Reusing the shell does not make their implementation free. Do not add the 37 destinations to the 39-family count: they are configurations within it.

Repeated people, dates, territories and report IDs do not create new screen designs. Filtering, sorting, selecting a location, sharing and confirming a cancellation use temporary sheets. Loading/empty/offline/error variants are states of those designs. Multi-step import/report configuration uses a wizard family, with each step still requiring a designed state.

The next concept will deeply demonstrate the daily journey and expose the remaining module destinations as honest previews. It will not simulate full clinical datasets, live appointments, routing calculations, remote saves or CRM success.

## Popularity evidence and what can actually be inferred

Official store snapshots and vendor disclosures are different measures. Downloads include cumulative installations, not active sales reps; enterprise selections do not establish user satisfaction. No consistent public dataset supports a global 'most popular field sales apps' ranking. This comparison combines widely adopted general apps with relevant specialist products.

| Reference | Observable adoption signal on review | What we can learn; why it may be useful |
|---|---|---|
| [Google Maps](https://play.google.com/store/apps/details?id=com.google.android.apps.maps) | Google Play shows 10B+ downloads | Search, selected place and directions form a familiar task progression. Inference: keep finding targets, choosing a site and reviewing a route connected. Scale also reflects distribution, so it cannot prove the cause is UI quality. |
| [Todoist](https://play.google.com/store/apps/details?id=com.todoist) | Google Play shows 10M+ downloads | Rapid capture, dates and manageable views support a small daily work surface. Its [calendar documentation](https://www.todoist.com/help/articles/use-the-calendar-integration-rCqwLCt3G) explicitly combines events and tasks in Today/Upcoming. Inference: fixed and flexible work can share an agenda without becoming the same record type. |
| [Google Calendar](https://play.google.com/store/apps/details?id=com.google.android.calendar) | Google Play shows 10B+ downloads | Familiar date navigation and day/week views. Inference: Today and future days should share a stable plan design. Installation counts alone do not show preference or explain success. |
| [Salesforce mobile](https://play.google.com/store/apps/details?id=com.salesforce.chatter) | Google Play shows 5M+ downloads | Contextual access to a broad CRM is valuable, but broad enterprise distribution is not evidence that copying all of its desktop surfaces is appropriate. Individual visible reviews describe lookup/navigation problems; these are anecdotes, not a representative usability study. |
| [Badger Maps](https://play.google.com/store/apps/details?id=com.badger.badgermap) | Google Play shows 50K+ downloads | Specialist accounts → selection → routing → activity capture. Visible reviews also flag reliability/upload friction. Inference: protect the workflow and drafts rather than treating feature count as the quality target. |
| [Map My Customers](https://play.google.com/store/apps/details?id=com.mapmycustomers.mapmycustomers) | Google Play shows 10K+ downloads | A close specialist comparator for account history and mapping. Its [mobile planner documentation](https://hs.mapmycustomers.me/en/support/smart-planner-1) links due/completed activities to records, notes and dates. |
| [RepMove](https://play.google.com/store/apps/details?id=com.repmove.app) | Google Play shows 5K+ downloads | A relevant mobile capture/planning reference. Its high displayed rating has a small review base and is not a sound basis for ranking it above larger products. |
| [Veeva Vault CRM](https://www.veeva.com/resources/vault-crm-extends-market-leadership-as-another-top-20-biopharma-chooses-veeva/) | Vendor's 23 September 2026 announcement reports over 190 live customers and commitments from 14 top-20 biopharmas | Strong industry adoption evidence, not an individual-user popularity score. Healthcare-specific permissions, HCP context and configurable workflows matter to enterprise fit; no causal UI-success claim is made. |

The likely useful mechanisms are lower repeated entry, clear next actions, retained context and familiar navigation. These are hypotheses derived from documented workflows, not experimentally established reasons for popularity. Validate them with the rep tasks below.

## Navigation and information hierarchy

[Apple's tab-bar guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars) recommends labeled, stable top-level destinations and separating actions from navigation. [Material's official Android navigation documentation](https://github.com/material-components/material-components-android/blob/master/docs/components/BottomNavigation.md) describes three to five top-level destinations. Four is our task-based choice within that range, not a universal best number.

| Surface | Expose immediately | Expose on request | Keep out of the first view |
|---|---|---|---|
| Today, unplanned | Assigned scope, short reasoned suggestions, Plan my day and My targets | Filter/sort, all targets, map, workday preferences | Full profile metrics, every analysis tool, invented opportunity totals |
| Today, planned | Next commitment, flexible stops, one clear next action, unfinished capture | Edit time/duration, cancellation alternatives, route review | A full month calendar and large business dashboards |
| Target row | Identity, specialty/type, location, known suggestion reason | Scope-relevant measure, last interaction if available, quick preview | Every claim/research/payment measure at once |
| Profile overview | Identity/site, relationship/visit context, primary actions, named section index | Full profile/claims/research/organization sections and export | Dozens of horizontal tabs or generic Details-only navigation |
| Capture | Known person/account context, outcome, note, next step | Attendees, audio/files, tags, richer insight processing | A mandatory CRM mapping workflow before a quick note can be recorded |
| Insights | Reports and a short named tool directory | Full filters, report setup, data sources, compliance and role-specific analysis | Analytics cards fabricated merely to fill the landing page |

Preserve selections, scope and Back paths. Opening an HCP from an HCO must retain its visit location; opening the full profile must not lose the draft plan. Several people at one facility share travel, while outcomes remain attached to the correct people. Assignments, insight watchlists and today's selected stops remain explicitly different concepts.

## Scope and state rules

- Our side configures users and assignments. S01/S02 describe access/recovery, not a rep account-import onboarding flow.
- Role-dependent modules remain in the audit. Actual visibility follows the source permissions; a role chooser is not permission escalation.
- General discovery outside assignments is explicit. It does not silently add a person to the assigned book.
- A planned time is not an appointment confirmation. Real travel, availability and location support are integration-dependent.
- Device draft, saved to DocNexus and CRM synced are separate states. The reviewed Field Pro CRM push is disabled; the concept cannot promise it works.
- Report types and advanced-cohort/Rx combinations follow supported source contracts. Backend-only candidates and full Advanced Search remain explicit scope/compatibility decisions.
- Missing, loading, zero and unavailable are different. A slow profile section does not prove the feature is absent.
- All 58 IDs need a destination even when that destination is a source-gated preview. A coverage mapping is not a claim of fully designed detail fields or implemented features.

## Acceptance scenarios for this concept

1. Open Today with no plan; inspect an assigned target and add it without inventing a meeting time.
2. Add a fixed planned appointment and a flexible visit; edit duration and preserve their distinct statuses.
3. Cancel an item and inspect alternatives without moving the fixed items silently.
4. Open an HCO, inspect a linked HCP and find all named profile sections.
5. Capture a discussion and follow-up, leave and resume it, then distinguish local/device, uploaded and CRM states.
6. Find Reports, HEMA, transcript history, target lists, data sources and the manager/admin entry without adding bottom tabs.
7. Check the narrow layout, labels and keyboard access; keep touch targets usable.

## Inventory and coverage

### Delivered concept and verification

The accompanying interactive concept has two home layouts: **Agenda first** keeps the daily list visible; **Next visit first** emphasizes the current person and makes the remaining agenda expandable. Both use the same four primary destinations and preserve the supplied cobalt/ink palette with light/dark appearances.

Browser-checked journeys:

- Select two sample targets; keep one appointment confirmed and the other visit flexible. Overlapping timed items show an error and disable Save day.
- Cancel a flexible stop while the confirmed stop stays in place. Route review groups visits by site and explicitly omits unavailable travel calculations.
- Open HCO → linked HCP → Back and recover the original account. Find all 18 HCP and 19 HCO section names.
- Leave an unfinished note, resume it from Activity, save it, edit the same interaction without duplicating it, and complete its linked follow-up. Account history includes notes captured for its linked people.
- Simulate an offline note and distinguish the preview queue from remote DocNexus persistence and CRM sync.
- Enter Reports → Create report → Back and return to the report library. Expand the alternative home's full agenda.
- Check Insights, profile index, capture and planning at a 320-pixel browser viewport; inspected product surfaces had no horizontal overflow. This is layout verification, not a complete accessibility audit.

The 39 families remain a full design inventory. The concept demonstrates the daily journey and named module entry points; it does not fully implement every family, profile renderer, wizard step or state. Sample records are illustrative. Notes and plans are memory-only and disappear on reload. Audio, file processing, maps, routing services, live data, notifications, remote persistence, backups and CRM are not connected. Authentication and readiness screens remain outside this preview. The production design should retain a persistent native bottom bar; the conversation preview expands vertically to keep every screen inspectable.

The machine-readable inventory is `surface-area.json`. The tables below are generated from it and the existing feature register so counts and coverage can be checked consistently.

| ID | Screen family | Area | Configurations | Concept depth |
|---|---|---|---|---|
| S01 | Sign in and session recovery | Access | SSO, expired session | outside preview |
| S02 | Workspace readiness | Access | ready, assignments unavailable, no assignment | outside preview |
| S03 | Today | Planning | unplanned, planned, active, wrap-up; selected day | interactive |
| S04 | Plan editor | Planning | mixed fixed/flexible agenda, calls, buffers, conflicts | interactive |
| S05 | Route review | Planning | origin, reorder, real directions handoff when integrated | interactive; no route service |
| S06 | Targets and discovery results | Targets | assigned/discover; HCO/HCP; search/filter/selection | interactive sample records |
| S07 | Target and opportunity map | Targets | targets, opportunity, territory overlays; list selection shared | interactive static geography and sample pins; live services unconnected |
| S08 | Collections hub | Targets | assigned lists, territories, insight target lists; source labeled | destination preview |
| S09 | Collection detail | Targets | territory, assigned list, insight list; source-specific actions | destination preview |
| S10 | Import and match review | Targets | file, match/review, partial errors; not onboarding | destination preview |
| S11 | HCO overview | Profiles | organization/hospital/health system; role-aware summary | interactive brief |
| S12 | HCP overview | Profiles | US/international and persona visibility | interactive brief |
| S13 | Profile section index | Profiles | 18 named HCP and 19 HCO destinations, availability gated | all names exposed |
| S14 | Profile section workspace | Profiles | 35 non-overview configurations; section-specific renderers still required | section previews; representative research/people |
| S15 | Source record detail | Profiles | publication, trial, payment, executive, referral/source record | destination preview |
| S16 | Activity history | Activity | visits, conversations, drafts, entity-filtered history | interactive |
| S17 | Capture composer | Activity | quick visit note, typed insight, recording, file upload | text capture interactive; audio/file preview |
| S18 | Conversation review | Activity | original transcript/audio, edited insight, summary, sentiment, tags, attendees | interactive local note review; processing preview |
| S19 | Follow-up detail | Activity | owner, due date, entity, related artifact, completion | interactive local follow-up |
| S20 | Saved work and sync status | Activity | device draft, pending upload, saved remotely, CRM state | interactive simulation |
| S21 | Insights hub | Insights | role-specific named tools; Reports featured | all entry points exposed |
| S22 | Analysis workspace | Insights | HEMA/site-of-care, payer/economics, Rx, referral analysis; source-specific constraints | destination preview |
| S23 | Reports and documents library | Insights | mine/shared; leakage/market and insight documents | destination preview |
| S24 | Report configuration | Insights | account/national, procedure/diagnosis/drug, supported capital inputs; validate combinations | destination preview |
| S25 | Generation status | Insights | report/summary/capture job; real stages, failed/ready | destination preview |
| S26 | Report or document detail | Insights | PDF/PPT, source context, download, share | destination preview |
| S27 | Summary builder | Insights | conversations, selected insights, templates, congress summaries | destination preview |
| S28 | Insight explorer and analytics | Insights | my insights, sentiment, topics, source-linked analytics | destination preview |
| S29 | Data sources library | Insights | connected sources, uploaded sources, status | destination preview |
| S30 | Data source detail | Insights | files, sync, analysis, regeneration | destination preview |
| S31 | Compliance workspace | Insights | standards, check, history, results; company gated | destination preview |
| S32 | CRM workspace | Workspace | source/company availability, preview, single/batch sync, tasks | availability preview; no push |
| S33 | Workspace and preferences | Workspace | company/view, display/density, start location, saved work | interactive display and simulation controls |
| S34 | Manager team | Workspace | authorized reps and team coverage | destination preview |
| S35 | Rep and assignment detail | Workspace | assignments, rep detail, assignment history | destination preview |
| S36 | Admin setup workspace | Workspace | company/units, people, groups, drugs, account configuration, readiness; authorized only | destination preview |
| S37 | Access, feature configuration and usage | Workspace | persona features, company configuration, usage, restricted transcript administration | destination preview |
| S38 | Collection rules and sharing | Targets | smart rules, archive/restore, recipients/digests; source-specific permissions | destination preview |
| S39 | Scoped Ask AI conversation | Insights | book/account/HCP context, answer sources and recents | question composer; no generated answer |

### Shared temporary surfaces

- **O01** Day and date picker
- **O02** Start/end location and workday settings
- **O03** Shared filters, scope and sort
- **O04** Target quick preview
- **O05** Add/edit agenda item, time, duration and goal
- **O06** Cancellation, conflict resolution and alternative suggestions
- **O07** Capture mode and HCP attendees
- **O08** Code/group selector and group creation
- **O09** Add to collection/territory; remove/restore confirmation
- **O10** Share/export and recipients
- **O11** Recommendation feedback and record correction
- **O12** Artifact/file/contact/site selection

### Feature-family coverage

| Feature | Surface IDs |
|---|---|
| FP01 | S03, S33 |
| FP02 | S03, S06 |
| FP03 | S06, S08, S09, S10 |
| FP04 | S11, S14 |
| FP05 | S11, S14 |
| FP06 | S11, S14 |
| FP07 | S11, S12, S14 |
| FP08 | S11, S12, S14, S26, S39 |
| FP09 | S03, S04, S16, S17 |
| FP10 | S03, S04, S05 |
| FP11 | S07 |
| FP12 | S07, S08, S09, S10, S38 |
| FP13 | S21, S22 |
| FP14 | S34, S35 |
| FP15 | S21, S23, S26 |
| FP16 | S20, S32 |
| HP01 | S12, S13, S14 |
| HP02 | S13, S14, S15 |
| HP03 | S13, S14, S15 |
| HP04 | S13, S14, S15 |
| HP05 | S13, S14, S15 |
| HP06 | S13, S14, S15 |
| HP07 | S13, S14 |
| HP08 | S13, S14 |
| HP09 | S13, S14, S16, S17, S32 |
| HP10 | S12, S13 |
| SR01 | S06, S07 |
| SR02 | S06 |
| HO01 | S11, S13, S14 |
| HO02 | S13, S14, S15 |
| HO03 | S13, S14, S15 |
| HO04 | S13, S14 |
| HO05 | S13, S14 |
| HO06 | S13, S14, S15 |
| HO07 | S11, S13, S14, S24, S26 |
| RP01 | S24 |
| RP02 | S24 |
| RP03 | S24 |
| RP04 | S25 |
| RP05 | S23, S26 |
| RP06 | S22 |
| RP07 | S22 |
| RP08 | S24 |
| IN01 | S17 |
| IN02 | S03, S16, S17, S20, S25 |
| IN03 | S16, S18 |
| IN04 | S16, S18, S21, S28 |
| IN05 | S21, S25, S27 |
| IN06 | S21, S23, S25, S26, S27 |
| IN07 | S08, S09, S19, S21, S28, S38 |
| IN08 | S21, S29, S30 |
| IN09 | S18, S21, S31 |
| IN10 | S21, S22 |
| IN11 | S19, S20, S32 |
| IN12 | S37 |
| AD01 | S02, S36 |
| AD02 | S34, S35, S37 |
| AD03 | S01, S02, S33, S36, S37 |

Coverage check: **58 of 58 registered feature families mapped; 0 unmapped**. This validates placement, not feature implementation or field parity.
