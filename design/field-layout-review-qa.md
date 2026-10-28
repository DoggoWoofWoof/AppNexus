# Navigation layout review — 29 October 2026

Branch: `codex/field-mock-layout-review`, based on refreshed `origin/dev` at `e8cfcc9331f197e3d089bc4720d3e95785a51167`. This branch contains design prototypes and their hosted exports. It does not implement the mobile app.

## Two layouts, one workflow

- **Field / Ask / History:** targets, territories and Map inside Field; History in the bottom navigation.
- **Targets / Ask / Opportunity:** Opportunity Map in the bottom navigation; History in the workspace menu.

Both use the same source code for screens, data, forms, voice-first Ask, preparation and route execution. The extracted script payloads were compared byte for byte and matched. There is no restoration of the older small Ask composer. Each layout has independent local demonstration state.

## Screen audit and corrections

| Area | Checked against | Correction |
|---|---|---|
| Target groups | Live FieldPro My HCOs / My HCPs and Explore HCOs / Explore HCPs | Stacked full-width groups; all four labels remain single-line at 320px. Switching groups preserves scroll position |
| Target rows | FieldPro metric meanings and supplied screenshot | Six HCO measures retained in two readable columns; sentence-case period labels; less repeated explanatory text; chevron separated from account name |
| Map controls | Live FieldPro nearby/type/geography controls | Dedicated rows for nearby toggle, origin/radius and type/export. No run-together Type/Export text. Approximate distance appears for nearby/replacement results |
| Route | Field's ordered facility stops and visit loop | No stage stepper. Stable Route label. Reordered facility visits start at the correct first HCP. Continue visits preserves the current planned HCP |
| Visit | Field run sheet, pre-read tabs and three source actions | Same Log note / Leakage report / Book appointment actions; run sheet expands inline. Next progresses within a facility before the next facility; back respects skipped/cancelled calls |
| Note/preparation/profile | Field logging + dev contextual Ask | Save preserves the selected pre-read tab; full profile returns to the same HCP; typed drafts are preserved. A draft confirmation appears only when moving on with actual unsaved text |
| Replacement | Existing dev replacement intent + source target discovery | Nearest sort, visible approximate distance, single replacement selection, explicit confirmation, then immediate return to the replacement HCP. Original remains cancelled in the day's record |
| HCO/HCP | Live FieldPro account tabs, report/map actions and complete source section inventory | Shared profiles retained. Removed fabricated extra provider-record page; Details jumps within the existing HCP page |
| Calendar activity | Field's historical activity calendar | Calendar cells are data, not buttons opening an invented export screen. Month/year controls remain |
| Report/exports | FieldPro report actions and Field report configuration | Shared scoped report flow and return path. CSV and sample PDF exports no longer open generic text-preview screens. No fake shareable report URL; sharing explicitly remains a demo limitation |
| Summary | Field end-of-day review | Structured completed/remaining/not-visited rows, clear log/restore controls and concise totals. Removed repeated headings, concatenated actions and the extra selected-visits detour |
| Ask | Dev WEBSITE answer builders and user-supplied voice-first layout | Same large microphone, typed input, hands-free and read-aloud controls in both. Multi-turn/entity/report/note context retained |
| History | Dev dated records/follow-ups | Same History screen in both layouts; only its navigation placement changes |

## Verification performed

- Live FieldPro home/group controls, current account actions/tabs, and Field note/pre-read behavior reopened; dev WEBSITE Ask reopened. No live territories, notes, invitations or report jobs created.
- Field layout: move West before Hospital → Daniel → Maya → leave route → Continue visits returns Maya → save note on Clinical profile → full profile/back → Alex at the same facility → back to Maya → report generation/back → calendar draft/back → next → Not today → day summary.
- Targets layout: start route → find alternative → select one HCP then a different HCP → one selected replacement → confirm → replacement HCP → next original planned HCP. Shared account/HCP sections and source action cards checked.
- Actual browser viewport at 320×760: appointment form fits, footer actions remain available, Ask retains the large mic, page/body widths fit. Phone surfaces also measured at 320px and 430px; target groups, metrics, filters, maps and profiles did not overflow horizontally in the inspected states.
- Geographic map verified with 221 projected path features and facility markers after drawing; not a decorative blank canvas.
- Both fragments pass JavaScript syntax checks; extracted screen/Ask code matches across layouts.
- Generated sample PDF parsed with `pypdf`: two pages, expected text. Browser download-event capture timed out in the inspection tool, so download delivery is not claimed as fully verified by that tool.
- Existing dev test suite: **41 passed, 0 failed**. These are baseline dev regression tests, not new app integration tests.

## Remaining mock boundaries

Fictional clinical/business records, public sample facility locations and straight-line distances. Live AI/audio, confirmed appointments, CRM, road routing, production reports and report sharing remain unintegrated. Sample CSV/PDF files can be generated locally. This is not an assertion of backend endpoint parity, exact live data coverage, or a clone of the separate legacy full-provider platform.

## Rebuilding

From the repository root, run `python design/mockups/.assemble-live.py`, then `python design/mockups/.export-review.py`. The export command accepts the bundled visualization `render.py` path as its first argument when the default local runtime path differs. Authoring files are under `design/mockups/`; `design/published-review/dist/` holds the two standalone exports and review entry page. Hosting credentials are never written into the repository.
