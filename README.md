# AppNexus · Field Pro

[Open the interactive demo](https://doggowoofwoof.github.io/AppNexus/)

A sales-rep mobile concept focused on **plan → recover a cancelled slot → prepare → visit → follow up**. Today is the starting point, with discovery, full profiles and analysis available when needed. Accounts and assignments are configured by our side. Routing comes after target selection.

The demo includes Today / Targets / Activity / Insights, a mixed fixed/flexible day, searchable account/person lists, real static maps, profile briefs, all 18 HCP and 19 HCO section names, durable drafts and audio chunks, searchable conversations, original/corrected transcripts, reviewed follow-ups and visible mock-service limits. Wider windows use a map/detail layout; the large-text view demonstrates 200% text.

[Review the screens and button placement](https://doggowoofwoof.github.io/AppNexus/demo/screens.html)

## Try it

1. Start with the sample 10:00 / 14:00 appointments. Choose **Cancel or reschedule → Doctor cancelled**.
2. Targets opens with replacement context. Use the shared search, distance filters and List/Map view, then choose Replace, undo the cancellation, or leave the time open. Other appointments keep their times.
3. Open **Prepare visit** for the combined HCP/preparation brief, notes, follow-ups and viewable demo briefs with offline copies. **Edit time** saves a personal plan or sends a mock request with acceptance/decline states; overlaps block saving.
4. Log an outcome, discussion note and follow-up. Activity → Capture asks for the person first. Leave and resume an unfinished note from Activity.
5. Activity groups visit records and cancellations by date. Open a record for its notes, audio/transcript and linked follow-ups. Deleted records and device storage are under Record options.
6. Explore the named profile sections and Insights tools. Detailed analysis datasets remain previews.

Open **Preview settings** for Phone, Wide screen, Large text, and light/dark appearance. Switching views retains the current plan, conversation draft and navigation. Reset clears only the active sample workspace, including its local media, after confirmation.

## Run locally

```sh
python scripts/build-demo.py
python -m http.server 8000
```

Open `http://localhost:8000/demo/`. No backend credentials or package installation is required. The demo loads version-pinned D3 and Lucide scripts from public CDNs, so map projection and icons require network access on first load.

## Current status

This is an **interactive prototype**, not a deployed production mobile client. No production API, auth, CRM push or cloud backup is connected. Plans, notes, drafts and received recording chunks persist in IndexedDB on this browser. Transcription, reports, office responses, availability and driving times are mocked and replaceable. The embedded exported preview uses explicitly labelled temporary memory because its sandbox has an opaque origin. Map geography and facility locations are real public references; people, assignments and activity are illustrative.

Existing service contracts were inspected, including Field Backend server source. That establishes source evidence, not deployed/customer-specific availability. The full timed agenda, joined daily recommendations and backup/restore work remain integration gaps. Field Pro CRM push is disabled in the reviewed implementation; Insights has a separate company gate.

The full design inventory is **58 feature families, 39 screen families and 12 reusable sheets/dialogs**. These are scope counts, not completed implementation counts. The earlier pass recorded 209 rendered-screen/state layout checks. This pass adds ten persona walkthroughs, 19 automated regressions and 26 distinct responsive screen/size checks. See the results and limits below; emulator/physical-device verification remains future production work.

## Planning and integration documents

- [Visit-record grouping and persistent Today planning](docs/record-and-planner-refinement.md)

- [Activity refinement: To do, discussion previews and completion](docs/activity-refinement.md)

- [Shared Targets flow and visit-ledger refinement](docs/unified-targets-and-records.md)
- [Button placement and cancellation recovery](docs/action-placement.md)
- [Visual simplification, shorter paths and contrast verification](docs/visual-simplification.md)

- [Plan, prototype and endpoint status](docs/plan-status-and-endpoint-audit.md)
- [Ten-persona rerun and regression results](docs/persona-regression-results.md)
- [Five rep personas and usage/friction audit](docs/persona-usage-audit.md)
- [Recording and transcript coverage register](docs/capture-transcript-coverage.json)
- [Proposed durable daily-plan contract and delivery gates](docs/day-plan-contract.md)
- [Surface-area audit](docs/surface-area-audit.md) and [machine-readable inventory](docs/surface-area.json)
- [Responsive layout contract and verification](docs/responsive-design-contract.md)
- [Daily sales-rep flow](docs/sales-rep-daily-flow.md)
- [Flow refinements: cancel recovery, glanceable brief, booking](docs/flow-refinements.md)
- [Map experience and routing requirement](docs/map-experience.md)
- [Repository feature map](docs/repository-feature-map.md)
- [HCP/HCO field inventory](docs/hcp-hco-field-inventory.md)
- [Leakage and capture integration notes](docs/leakage-capture-plan.md)
- [Comparable apps](docs/comparable-apps-review.md)
- [Product plan](docs/product-plan.md)

## Source layout

- `mockup/source/field-pro-responsive.html`: maintained conversation fragment with product markup, styles, behavior and embedded public map data.
- `app/targets-ui.js`, `app/experience-ui.js` and `app/experience.css`: shared discovery, visual hierarchy, brief/prep composition and direct task paths.
- `app/`: maintained capture model, IndexedDB store, recording session, capture UI and mocked booking/prep/recovery UI.
- `tests/personas.test.cjs`: persona-based model/storage/recording regressions (`npm ci && npm test`).
- `scripts/build-demo.py`: bundles the app modules and extracts the fragment into the static demo.
- `demo/`: GitHub Pages entry point, generated app files and standalone preview controls.
- `mockup/field-pro-responsive.html`: exported conversation preview (single-file).
- `docs/`: decisions, audits, endpoint evidence and implementation scope.

Private upstream checkouts and Field Backend source snapshots are git-ignored. They are reference material, not part of the published demo.

## Map attribution

Streets/parks: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Land boundaries: [NYC Open Data](https://data.cityofnewyork.us/d/gthc-hcne). Facility locations: [New York Health Facility General Information](https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r). Attribution also appears in the maps.
