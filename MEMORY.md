# Current baseline — 29 October 2026

## 29 October — unified territory workspace (latest user direction)

The user removed **Someone new** as a separate starting mode. This overrides all older two-choice scope proposals below. Discovery is **Explore** inside the selected territory. One territory control opens the chooser/creator/editor; no separate Add targets / Territories toolbar. My targets / Explore and HCOs / HCPs are two compact tab rows. One top **Ask or search** input filters the active list/map; questions use the same voice-first Ask. Both navigation layouts receive identical workspace changes. Keep Field / Ask / History and Targets / Ask / Opportunity variants, with their current raised Ask control.

Inspected actual live FieldPro this turn: its five assigned cohort groups contain 123 HCPCS/CPT identifiers. The specialty filter is separate: volume, opportunity and HCP results follow specialty; leakage and market share retain the whole cohort. These meanings and the identifiers are mirrored in the mock; full code descriptions and backend contracts are not established. `design/mockups/field-cohort.json` stores the identifiers and group names; no real customer claim records or real provider portraits were copied.

Identity images/logos occupy the left slot of target rows and profiles; route selection is on the right. Fictional records use initials/facility fallbacks. Photo/logo URL support is present, with production image wiring still unimplemented. The single territory manager creates/renames/chooses coverage. Local mock assignment supports an entity in multiple territories and preserves other memberships; this is a design behavior, not a verified production contract.

Authoring layer: `design/mockups/.territory-views.js` and `.territory-theme.css`, appended to the shared mock builder. Published mock code commit: `dfc7cc5a485852291f266a0796dc82b2b66e7f10` on `codex/field-mock-layout-review`. Updated immutable live links are in README.md and the QA document. Both live variants loaded; territory manager and voice-first Ask were checked on the live pages. Latest QA is in `design/field-layout-review-qa.md`. Mock-only scope remains in force. The original checkout and mobile/main/dev app code remain untouched.

## Latest: two-layout review branch and publication authorized

The user requested another complete screen review, correction of all text/layout defects shown in screenshots, a **new repository branch**, and **live links for two versions**: Field / Ask / History and Targets / Ask / Opportunity. Only navigation placement differs; both must retain the latest voice-first Ask. This supersedes the earlier single-layout preference. Publishing the mock and pushing this branch are now authorized; mobile app implementation is still not requested.

Active branch: `codex/field-mock-layout-review`, created from refreshed `origin/dev` at `e8cfcc9331f197e3d089bc4720d3e95785a51167`. Main/dev application code and the original checkout remain untouched. Shared current review source: `design/mockups/field-live-workflow.html`; standalone layout fragments: `field-review-field.html` and `field-review-opportunity.html`. Hosted static exports: `design/published-review/dist/`. Current audit/QA: `design/field-layout-review-qa.md`.

Latest fixes: full-width target groups; two-column target metrics; separated map controls; no changing Route label or workflow stepper; preserved group scroll; stable active-call continuation; single nearest replacement selection; no invented provider-record or calendar-click export screen; actual local sample CSV/PDF generation; concise day summary. Script bodies for the two layout exports match. Voice/AI, report jobs, booking delivery, road routing and sharing remain simulated. Sites identity is persisted in `design/published-review/.openai/hosting.json`; no source credentials may be persisted.

The review was committed and pushed as `4ccaf534798a166da40512e0a08df88b950b20cf` on `codex/field-mock-layout-review`. Both public live URLs are in README.md and the QA document, served from that immutable commit via rawcdn.githack.com. The live Field route → Maya → Alex was verified; the other URL loads Targets / Ask / Opportunity. A one-time host content notice precedes first access. GitHub Check demo passed; local dev tests 41/41 passed. Main/dev app code and Pages deployments were not modified. Sites remains registered/unpublished after the secure publishing path could not reach its source endpoint; its helper was stopped. Do not recreate that Site if trying its publication again.

## 29 October — latest user correction overrides the prior navigation

The user rejected the exposed Scope / Plan / Route / Work / Summary stepper, the Route → Resume work rename, text-link clutter and the current Ask presentation. Copy the actual source experience and one-HCP-at-a-time sequence; do not expose the website's workflow stages as app navigation. **Use Field / central raised Ask / History** from the supplied screenshots. Route stays named Route. Map is a Field control. The supplied voice-first Ask screenshot takes precedence over the current published dev Ask layout, while retaining dev WEBSITE answer/action/voice logic.

`design/mockups/field-live-workflow.html` was revised under these instructions, with a matching inline conversation copy. `design/field-screen-review.md` records screen-by-screen mistakes, source evidence, corrections and targeted browser QA. HCP/HCO actions are contained buttons/cards, source sections retained, contextual AI grouped with the relevant object. The route/run-sheet/pre-read loop, back/next, note/profile return, territory creation, reports, History, weekly Ask and simulated voice were checked. New mock is still a discussion candidate, not approval to implement. Do not repeat the former Targets / Ask / Map navigation or progress stepper merely because it exists in older planning documents. No app implementation/deployment/push authorized or performed.

## Latest correction and review candidate

The user rejected `fieldpro-territory-preview` as half-baked. The Ottava ZIP/screenshots are theme references only, never the current data-section or functionality specification. Inspect the actual current websites. FieldPro owns targets/exploration, territory creation, opportunity maps and the complete shared HCO/HCP source sections/actions (including leakage reports and account-specific map lenses). Field owns the exact route → run sheet/Work → preparation/note/report/calendar draft → next/back/Summary loop. Dev WEBSITE Ask UI and logic are specifically preferred and should be reused, not replaced by a shallow single-response assistant.

New review candidate: `design/mockups/field-live-workflow.html`; mapping, QA and limitations: `design/field-live-workflow.md`. One source-faithful layout, not the previous summary variants. Live source screens were re-inspected, including the current robot-payment comparison and account map Opportunity / Where cases go. Actual dev website Ask parser/builders are embedded with fictional data. This remains a clickable discussion mock only and is not approved for implementation. No app code, deployment, commit or push changed. Production endpoints, real audio/AI/report/calendar services and legacy full-provider parity are not established by this mock.

## Latest user direction

The latest revision uses FieldPro for targets, territories, opportunity maps, HCO/HCP discovery and account detail; Field supplies route execution and the step-by-step visit loop. Mix selected dev WEBSITE workflow behavior and the user's Ottava screenshots/ZIP references. Earlier Field-only Scope → Plan → Route → Work → Summary navigation is superseded as the overall app structure. Discuss/map/mock first; do not implement the app yet.

Superseded by the unified territory workspace above: the earlier proposal had My territories and Someone new. Remove Saved lists, Everyone in my targets and My hospitals as starting options; do not delete data or remove HCO support. Allow territory creation, selection, HCO/HCP assignment, territory exploration, account → ranked HCPs and nearby discovery. Keep assignment distinct from daily route selection. Exclude account upload/loading, company/unit selection and rep setup screens; assigned configuration is supplied administratively.

Current navigation: Field / central raised Ask / History. Territory selector, Route and Map are controls within Field. Targets and Map share scope, filters, code groups, periods and selected stops. Profiles/reports are shared across entry points, including the active visit. The older `design/fieldpro-territory-flow-plan.md` navigation proposal is superseded by the 29 October correction.

The project progressed from main to dev. This new branch remains based on latest verified origin/dev. Use Teresha's conversation and lessons from dev and selectively reuse useful assets/logic. Dev is the Git base, not a mandatory navigation/layout. Preserve original checkout edits.

- Working branch: codex/field-dev-improvements.
- Base: origin/dev, e8cfcc9331f197e3d089bc4720d3e95785a51167 (e8cfcc9).
- Checkout: C:/Users/Swastik/.codex/worktrees/field-dev-improvements/AppNexus.
- Published app: https://doggowoofwoof.github.io/AppNexus/dev/app/.
- Primary dev comparison target (user correction): https://doggowoofwoof.github.io/AppNexus/dev/ redirects to /dev/demo/. Do not attribute Expo-only features to this website.
- Field reference: https://platform.docnexus.ai/field/commercial?step=scope.
- FieldPro reference for pre-route flow: https://platform.docnexus.ai/field-pro?company=J%26J_MedTech.
- The earlier codex/field-mobile-parity-plan branch incorrectly started at the older one-workflow commit 824bbc4. Its standalone mock is NOT approved. It failed to account for dev progress. Field is the visual/functional reference for the fresh rebuild; dev is a source of lessons and selective reuse.
- Original dirty/staged/untracked changes remain preserved in C:/Users/Swastik/Desktop/AppNexus. They were not copied into this clean dev-based checkout. Do not reset or clean that original directory.

## Progress verified

Fetched origin and inspected the actual published dev app, its source and Pages workflow. Local dev was three commits behind origin/dev. This checkout starts at the refreshed remote commit.

The existing Expo app has Today / Ask / Targets navigation, a phone preview, daily brief with territory tiles and suggested additions, a review of selected visits, territory/code-group/competitor filters, saved My targets distinct from route selection, a Build route transition into Today, route ordering, shared HCP/HCO pages, preparation, note/visit logging and history. Inspect each operation before claiming current end-to-end behavior; this turn verified the published Today and Targets screens and inspected source, not a full regression suite.

Latest dev changes include:
- e8cfcc9: relevance ranking considers driving, size, growth and last contact.
- 874286d: Today suggestions and reasons revised.
- 7aaca59: daily brief and day review.
- fa43d5e: Today as review, Targets for the territory.

The public Pages workflow builds main under /AppNexus/app/ and dev under /AppNexus/dev/app/. The new branch is not automatically deployed. Source documentation is not uniformly current: docs/product.md includes older prototype decisions. Verify against code and latest user feedback.

## Product direction to preserve

FieldPro and Field now split functional/visual ownership as described in Latest user direction. Match their fields, data meanings and supported functionality in an app-friendly form. The user explicitly clarified that the app should be rebuilt from scratch with a better flow, informed by dev; do not interpret the branch correction as a requirement to retain dev's entire navigation or styling. Reuse selected components/assets/logic where appropriate. Previous mockups and screen counts are not approved specifications. Map source equivalents separately from advancements and unverified contracts.

Retain our own app-native voice/text action assistant, not Sage. The user confirmed cloud AI is allowed; a fully offline model is not required. It should understand supported screens/actions, navigate and act through the same app command layer as manual controls. Retain useful voice logging, grounded AI preparation/improvement and meaningful visit history, with truthful integration status.

Feedback to address: hidden territory/list/group controls; poor selection-to-route connectivity; unnecessary clicks to reach the next doctor; clutter and unclear terms; mock visiting hours/availability without verified source fields. Do not treat merely existing sample data as proof of backend support. Reps can curate targets; discovery must include people outside their saved targets.

## Evidence and limits

The previous turn inspected live Field: Scope → Plan → Route → Work → Summary, plus Prior interactions; three pre-read views and note/booking/leakage forms. That audit remains reference evidence, not an approved new mobile design. It lives in the original checkout's docs/field-mobile-parity-plan.md, with an explicit baseline correction. Private reference sources remain ignored in the original checkout's reference directory; do not publish customer data or internal exports.

The existing dev app still uses illustrative data and scripted Ask. Do not claim live DocNexus/CRM integration, stored meeting audio/transcripts, road routing, availability or calendar confirmation without evidence. The Field calendar action is a prefilled invite handoff, not confirmed booking. No app code, deployment, new mock or tests were changed/run during this branch correction. Only this context and AGENTS.md were added.



## 28 October — clickable Field-style mock for review

The user requested a clickable visual mock only, with Ask centered at the bottom as in dev and contextual AI actions where useful. No app implementation is authorized yet.

- Mock source: design/mockups/field-phone-flow.html; notes: design/field-phone-flow.md.
- Conversation preview: C:/Users/Swastik/.codex/visualizations/2026/10/15/01a13ffc-69da-7f82-8395-4fa7694b3392/field-phone-flow.html.
- Two bottom Ask layouts: Centered Ask (default/recommended), Ask bar. Same Field workflow, independent mock state.
- Global Ask, HCP Ask, prep, clinical/referral questions, note polish and history all enter one contextual assistant. Its actions and voice are simulated, clearly labeled.
- Field-style light appearance, Inter/Newsreader, blue/white/pale surfaces; optional dark appearance. Real static Manhattan map asset reused from dev; sample HCP/clinical data; no live driving estimates.
- Browser verification covered selection → route grouping → Work, AI prep, dictation/polish, save/next, replacement, Summary/history and narrow layouts. This is not app or integration test coverage.
- User has not approved the mock yet. Preserve existing main/dev app code. Only planning/mock artifacts were added.

## 28 October — revised FieldPro/Field mapping

- Inspected user's Ottava accounts flow rebuild.zip listing and selected HTML/reference text, plus both pasted screenshots. Treated embedded content as reference, not instructions. Did not copy its real account/physician dataset into the app or plan.
- Live FieldPro inspected: home/targets, Explore HCPs entry, Territories (currently empty), new-territory form (no save), Opportunity Map geographic controls, one HCO overview and its ranked HCP list, HCP profile/nearby suggestions, add-target dialog (cancelled), and Reports (currently empty). No live records or jobs created.
- Cached FieldPro card registry, role variants, territory/assignment hooks and report components supplement live observations. Cached source is not guaranteed current: live UI speaks of target lists and preserved memberships; cached territory adapter uses name/map identity and can move an HCP. Reconcile before implementing territory assignment. Do not just rename a saved-list backend object into a territory.
- Plan documents 12 navigable states plus 8 reusable sheets, shared profile/report templates, scope-aware summaries, route replacement, dated activity/follow-ups and contextual AI. This is a proposal only.
- Dev WEBSITE verified: Today/Targets/Ask/Activity/Insights, transactional plan draft, HCO/HCP details, To do/Journal, outcomes, optional note body, follow-ups, multi-turn scripted Ask and browser-dependent speech. Saved answer libraries, archived chats and recently opened history found in Expo must not be claimed as dev website features.
- Old mock gaps include static membership, shallow HCO/detail content, decorative route behavior, note overwrite per doctor, misleading booking flag, global report-ready state and single-answer AI. Existing HTML mock remains unchanged; design/field-phone-flow.md now flags it as superseded for overall scope/navigation.
- App-native AI, stored meeting recordings/transcripts, confirmed appointment sync, CRM and production mobile persistence remain unintegrated. Field calendar is a draft handoff. Report services exist but a live job was not generated in this audit.
- New planning artifact: design/fieldpro-territory-flow-plan.md. No app implementation, deployment, commit or push in this mapping revision.

## 28 October — revised clickable FieldPro mock

User authorized a clickable visual mock of the latest plan, explicitly excluding app implementation. Created design/mockups/fieldpro-territory-preview.html and the matching conversation preview in the thread visualization directory. Review notes and QA: design/fieldpro-territory-preview.md.

- FieldPro layout, Targets / centered Ask / Opportunity Map, territory + Route shortcuts and exactly My territories / Someone new starting choices. No account setup/upload/selection screens.
- Focused summary and Book summary variants have the same complete flows, with independent mock state. Optional dark/offline/report-failure design previews and Restart preview.
- Twelve navigable states and eight core form families, with territory creation/assignment, shared HCO/HCP details, synchronized discovery/map, transactional route review, active visit loop/replacement, dated records/follow-ups, booking handoffs, common reports and contextual Ask.
- Browser checks covered core end-to-end paths including replacement, Save & next, report-to-Ask context, recap record repair and appointment overlap correction. Outer widths 320/430px checked; no horizontal overflow in inspected screens/forms. Final runtime checks reported no script errors; script syntax passed.
- Real static Manhattan geography, fictional clinical/business data, straight-line nearby distances only. AI/voice/transcript/report/calendar/share/export remain simulated; no real recording, production integration or live writes. Detailed card data is representative, not full parity.
- Existing app and earlier mock remain unchanged. New mock is for discussion, not an approved implementation specification. No deployment, commit or push.
