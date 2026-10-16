# Field Pro app — product and implementation plan

Review draft · 15 October 2026

Current status · 16 October 2026: `plan-status-and-endpoint-audit.md` separates agreed flow, prototype behavior, source-backed APIs and missing integration work. Field Backend server source is now inspected; a complete durable day-plan/backup contract is still not established. `responsive-design-contract.md` and `surface-area.json` define shared responsive rules for all screen families. The latest concept is `field-pro-responsive.html`, with Phone, Wide screen and Large text views. No production mobile API integration is implemented in this concept.

Map extension · 16 October 2026: `map-experience.md` records the optional Today map card and Targets List / Map view. The latest conversation concept is `field-pro-maps.html`; it supersedes the Map placeholder in `field-pro-today.html`. The production routing requirement is Google Routes or an OSM-based routing service, with road travel times for scheduling.

Current audit · 16 October 2026: `surface-area-audit.md` and `surface-area.json` supersede earlier navigation proposals in this document. The proposed app opens on Today, with four stable destinations: Today / Targets / Activity / Insights. The inventory maps 58 feature families to 39 screen families and 12 reusable sheets/dialogs. Full HCP/HCO sections remain individually named. The current interactive concept is `field-pro-today.html` in the conversation visualization directory; the older standalone mockup is historical.

Current product-flow discussion: `sales-rep-daily-flow.md` describes the sales-rep Today landing experience, admin-prepared assignments, discovery → plan → prepare → capture → follow-up, and the distinction between existing route helpers and new scheduling/persistence work.

Latest discussion: `repository-feature-map.md` records source inspection of all four supplied repositories, additional feature families, integration limitations and a revised flow proposal. Repository access succeeded through the existing terminal login. Runtime/API behavior is still untested; the earlier mockup and navigation remain provisional.

Update: the second inspection successfully loaded the signed-in Field Pro workspace and full HCP/HCO profiles. See `design-review.md` for verified visible fields and the revised hierarchy. Earlier access failures below describe the first pass only. API contracts remain unverified. The refined inline mockup supersedes the initial standalone concept.

The earlier navigation proposal in `app-flow.md` was My book / Explore / Activity. It is retained as discussion history; the 16 October surface-area audit is the current proposal.

## Product decision

Build a mobile-first Field Pro experience around a rep's assigned book of business. The first implementation slice is assigned HCO/HCP lists → account summary → full HCO/HCP profile. Existing Advanced Search APIs provide profile and entity-search data; do not assume Field Pro is a single backend gateway. Confirm actual contracts before choosing service boundaries or a native framework.

This is a planning proposal based on the supplied conversation and design package. Statements in those attachments are requirements evidence, not authorization to create remote repositories, publish, message colleagues, or alter production systems. No backend has been connected.

## Evidence and verification

The supplied ZIP contains custom `.dc.html` prototypes, mobile/desktop v3 designs, workspace setup, and screenshots across capital sales, clinical sales, HEMA, sales enablement, maps, routing, reporting, visits and CRM. Visual inspection of the home screenshot and inspection of the mobile v3 source establish cobalt accents (#2447C4), ink (#0B1220), pale surfaces (#F4F6FA), subtle borders (#D7DEEC), serif display metrics, compact metadata and rounded cards. These prototypes include explicitly illustrative values and should not establish production metrics or endpoint behavior.

Attempts to open all five platform links with the web tool failed; an in-app browser navigation to Field Pro also timed out. Live behavior, permissions and API contracts remain unverified. Do not interpret this as proof the service is unavailable to the user.

| Area | Source | What is supported | What remains to inspect |
|---|---|---|---|
| Field Pro | https://platform.docnexus.ai/field-pro | Brief: preconfigured target accounts; package: HCO/HCP switching, opportunity metrics and role-specific views | Actual setup payload, list loading, filters, pagination, entitlements |
| HCP | https://platform.docnexus.ai/providers/1962515551 | Brief: full provider profiles using existing Advanced Search endpoints; package: affiliations, activity, research | Exact fields, publication/trial pagination, identifiers, source dates |
| HCO | https://platform.docnexus.ai/healthcare-organization/4885603996736062548 | Brief: full organization profiles; package: volume, leakage, associated HCPs | Entity hierarchy, health-system joins, period definitions |
| Leakage | https://platform.docnexus.ai/hospital-leakage-reports | Brief requests reports; package includes report generation states | Job polling, report access, downloads, calculations and filters |
| Insights | https://platform.docnexus.ai/insights | Brief requests AI insights and captured notes; package includes contextual questions | Separate generated analytics from rep-authored visit notes; verify both contracts |

## Scope and order

| Stage | Deliverable | Acceptance criteria |
|---|---|---|
| 0 — current | Clickable mockup and this plan | Review account → HCO → HCP → note flow; distinguish reference features from committed scope |
| 1 — first implementation | Authentication, assigned account/HCP views and full profiles | Correct tenant book; stable entity IDs; full profile opening independently of summary fields; loading, empty, error, denied and missing-profile states |
| 2 — discovery | Focused HCP/HCO search using existing endpoints | Debounced search, cancellation, pagination, entity type and relevant filters; opening a result does not silently assign it to the rep |
| 3 — follow-up | Capture visit notes and explicit CRM sync | Save confirmation; draft recovery; visible pending/success/failure state; safe retries without duplicate CRM records |
| 4 — analytics | Leakage reports and contextual insights | Real period/source labels; authorized report generation, queued/running/ready/failed states; grounded insights with source links |
| Later, pending product need | Routing, opportunity map, imports, full Advanced Search and self-service setup | Confirm need and backend availability before committing |

The package demonstrates broader features than the first requested slice. Role/team selection and setup appear in the reference, but customer provisioning is described as an admin process. Prefer loading server-configured team, codes and accounts; show an unconfigured state instead of inventing a mobile onboarding requirement.

## Proposed navigation and flows

Primary navigation: My book, Search, Activity. Reports can be introduced when integrated. Global entity search is visually distinct from filtering the assigned book. AI questions should become a separate explicit action after contracts are inspected.

1. Sign in → load authorized workspace/team and assigned book → HCO or HCP cards.
2. Tap HCO → summary with period-specific metrics → full organization sections → affiliated HCP → full provider profile.
3. Search HCP/HCO → choose result → full profile. Assignment requires a separate supported action and permission.
4. From either entity → capture note with explicit entity context → save → choose CRM sync → review sync result. A local draft is never presented as a remote save.
5. From HCO → leakage report → existing or newly queued report → view permitted result.

## Profile content inventory to verify

HCP: identity/NPI, specialty, geography, practice/contact fields where permitted, HCO affiliations, relevant procedure/volume history, publications and trials if exposed. Empty sections must distinguish no data from failed requests. The profile must not imply all listed data is already returned by one endpoint.

HCO: identity and stable organization ID, location/type, parent system, affiliated HCPs, configured procedure metrics, leakage with definitions and time periods, available reports. Keep profile identity separate from configurable sales summary metrics.

## Integration plan

Use separate client adapters for Field Pro setup/book, existing search/profile APIs, report jobs, insights, and notes/CRM. A shared authentication and error layer serves these adapters. Reuse existing endpoints directly where supported; add no gateway or new backend endpoint without an identified gap.

Before wiring, inspect request methods/paths, auth/session refresh, tenant scoping, CORS/mobile compatibility, response schemas, IDs, rate limits, pagination, date coverage and error codes. Record observed contracts in `docs/api-contracts.md` with sanitized examples, never tokens.

| Repository supplied in brief | Inspection objective |
|---|---|
| https://github.com/docnexusai/docnexus-frontend | Field Pro setup/book fetching, Advanced Search and HCP requests, leakage frontend, existing auth |
| https://github.com/docnexusai/hospital-health-system-views | HCO sections and organization identifiers/requests |
| https://github.com/docnexusai/Hospital_Reports_Production | Leakage report job lifecycle and access control |
| https://github.com/docnexusai/docnexus-ai-insights | Contextual analytics contracts and evidence metadata |

These repository contents have not yet been inspected. Access is the next evidence gate. Create a clean implementation repository after review; avoid carrying over the old application's structure merely because its endpoints are reused.

## Technical decisions deferred until inspection

Native app versus responsive web/PWA; supported platforms and distribution; offline scope; CRM vendor and sync ownership; note retention/storage; API compatibility with mobile auth; metrics definitions; permissions for assignment and report creation. A React Native/Expo client is an option if native distribution is required, not an approved decision.

## Quality and release gates

Validate tenant isolation and role access; profile ID mapping and navigation; pagination and stale-response cancellation; denied/empty/error states; period/unit labels; large text and touch targets. Test notes and CRM retries against actual sandbox contracts. Validate report authorization and interrupted job recovery. Do not estimate delivery dates until access and integration complexity are known.

## Prototype review

Open `../mockup/index.html` in a browser. All people, metrics, report figures and notes are illustrative. Try HCO/HCP switching, list filtering, an account profile, its full-profile sections, linked provider, Search, a note draft and Activity. Notes exist only in browser memory and disappear on refresh; CRM and report actions only explain their planned state. The local prototype makes no network or CRM calls.

Review priority: Does assigned-book-first navigation match the rep's work? Which full profile sections are required for v1? Should notes/CRM follow profiles or ship with them? Which device/platform must be supported? Once repository and signed-in product access are available, replace assumptions with an endpoint and field inventory before implementation.
