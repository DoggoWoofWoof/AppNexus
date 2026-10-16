# AppNexus · Field Pro

[Open the interactive demo](https://doggowoofwoof.github.io/AppNexus/)

A sales-rep mobile concept focused on **plan → recover a cancelled slot → prepare → visit → follow up**. Today is the starting point, with discovery, full profiles and analysis available when needed. Accounts and assignments are configured by our side. Routing comes after target selection.

The demo includes Today / Targets / Activity / Insights, a mixed fixed/flexible day, searchable account/person lists, real static maps, profile briefs, all 18 HCP and 19 HCO section names, draft resume, note editing, follow-ups and visible save/CRM limitations. Wider windows use a map/detail layout; the large-text view demonstrates 200% text.

## Try it

1. Start with the sample 10:00 / 14:00 appointments. Choose **Appointment changed? → Doctor cancelled**.
2. Inspect nearby candidates, use the slot for a tentative visit or call, undo the cancellation, or leave the slot open. Other appointments keep their times.
3. Open **Prepare** for a compact brief, notes, follow-ups and a report/insight checklist. **Manage appointment** saves a personal plan or an explicitly unsent request draft; overlaps block saving.
4. Log an outcome, discussion note and follow-up. Activity → Capture asks for the person first. Leave and resume an unfinished note from Activity.
5. Review/edit the same interaction and complete the linked follow-up.
6. Explore the named profile sections and Insights tools. Detailed analysis datasets remain previews.

Use the demo toolbar for **Phone**, **Wide screen**, **Large text**, and light/dark appearance. Switching views retains the current plan, conversation draft and navigation. Reset clears the current sample session.

## Run locally

```sh
python scripts/build-demo.py
python -m http.server 8000
```

Open `http://localhost:8000/demo/`. No backend credentials or package installation is required. The demo loads version-pinned D3 and Lucide scripts from public CDNs, so map projection and icons require network access on first load.

## Current status

This is an **interactive prototype**, not a deployed production mobile client. No production API, auth, CRM push, report generation, road routing or cloud backup is connected. Notes/plans remain in page memory and disappear on refresh. Only demo appearance/view preferences are retained locally. Map geography and facility locations are real public references; people, assignments and activity are illustrative.

Existing service contracts were inspected, including Field Backend server source. That establishes source evidence, not deployed/customer-specific availability. The full timed agenda, joined daily recommendations and backup/restore work remain integration gaps. Field Pro CRM push is disabled in the reviewed implementation; Insights has a separate company gate.

The full design inventory is **58 feature families, 39 screen families and 12 reusable sheets/dialogs**. These are scope counts, not completed implementation counts. Browser verification recorded 209 rendered-screen/state layout checks; emulator/physical-device verification remains future production work.

## Planning and integration documents

- [Plan, prototype and endpoint status](docs/plan-status-and-endpoint-audit.md)
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
- `scripts/build-demo.py`: extracts that source into the static demo.
- `demo/`: GitHub Pages entry point, generated app files and standalone preview controls.
- `mockup/field-pro-responsive.html`: exported conversation preview (single-file).
- `docs/`: decisions, audits, endpoint evidence and implementation scope.

Private upstream checkouts and Field Backend source snapshots are git-ignored. They are reference material, not part of the published demo.

## Map attribution

Streets/parks: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Land boundaries: [NYC Open Data](https://data.cityofnewyork.us/d/gthc-hcne). Facility locations: [New York Health Facility General Information](https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r). Attribution also appears in the maps.
