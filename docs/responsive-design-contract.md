# Shared responsive contract

16 October 2026 · Applies to every screen family in `surface-area.json`, including future data-rich implementations. The current conversation concept is `field-pro-responsive.html`.

## Layout rules

Respond to the app's **available content width**, not a model name or physical display resolution. This follows the approach in [Android adaptive layout guidance](https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps) and [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout). The thresholds below are choices for this concept, not a claim that every native platform uses identical breakpoints.

| Available width | Shared behavior |
|---|---|
| Up to 360 CSS pixels in the concept | One-column forms and tool grids, stacked action rows, compact spacing, wrapping labels, one profile section column |
| 361–599 | Single main content column; short paired fields and tool cards may share a row when they fit |
| 600 and above | Map and selected-record context can sit side by side; section indexes use two columns and tool grids can use three; ordinary forms retain readable field widths |

Container queries apply these rules to the product surface even when it is inside a larger conversation window. The same chrome, spacing, text, action, form, empty-state and wrapping rules are reused by every rendered page. The map reprojects its real coordinates when its own container changes size.

## Shared requirements

- Support 100–200% text in the concept. Essential text wraps; do not hide information to make a layout fit. At large text sizes, forms and actions stack and selected native-dropdown values also appear as wrapping text. The brand mark keeps a stable size.
- Keep four navigation destinations. At enlarged text on compact widths, the navigation reflows into two columns so complete labels remain readable. On wide windows the four destinations fit in one row.
- Provide at least a 44-by-44 effective area for primary interaction targets. Native checkbox controls use larger wrapping labels. Avoid placing a map action over a selectable pin; the Today map has one action below the preview.
- Respect top, bottom and horizontal safe-area insets. The concept includes CSS safe-area hooks. A production native shell must use the framework's actual safe-area and keyboard insets.
- Use normal vertical content flow in the conversation preview. Native production screens need an anchored navigation area, a scrollable body, appropriate sheet heights, and focused-field visibility with the keyboard open. Do not use the preview's automatically expanding height as proof of native keyboard behavior.
- Preserve target, location, selection, filters, plan and draft context as available width changes. Width changes must not instantiate a new workflow or clear a note.
- Keep table and chart data legible in the future section renderers: prioritize identity and important measures, expose secondary fields deliberately, retain labels/units and source context, and use a dedicated horizontally scrollable data region only when the data truly requires it. These detailed renderers are not fully built in the current concept.
- Native loading, no assignment, no location, no associated HCP, empty/error/denied, offline and retry states must use the same shared layout primitives. The prototype demonstrates some of these states; it does not implement every production state.

## Coverage by family

All 39 design families have a responsive rule assigned in `surface-area.json`.

| Family group | Adaptive treatment |
|---|---|
| Access/readiness | One-column identity/setup/recovery forms, wrapping explanations and safe-area-aware actions; outside the current prototype |
| Today/planning/route | Wrapping dates and stop identity, stacked action controls, duration/time fields that become single-column, map as a compact contextual card |
| Targets/collections | Same search/filter/selection in list and map, wrapping rows, wide map/detail panes; import and collection details remain previews |
| Profiles | Brief actions reflow, named section indexes become two columns only when space permits, each content renderer remains responsible for its own measures/tables/charts |
| Activity/capture/review | Textareas grow with type size, original notes and long follow-ups wrap, drafts survive resize, missing-attendee state prevents an invalid save |
| Insights/reports/analysis | Adaptive named-tool grid and full-width module rows; future report wizards and analysis renderers inherit the shared contract |
| CRM/workspace/team/admin | Wrapping status/permissions explanations, readable role selection, adaptive list/form primitives; source permission rules remain independent of layout |
| Shared sheets/dialogs | Prefer full-width sheets on compact windows, constrained dialogs on wider ones, safe-area/keyboard-aware scrolling and context-preserving dismissal; detailed overlay implementations remain future work |

## Verification performed

The browser pass recorded **209 rendered-screen/state layout checks**, including navigation through all 18 HCP and 19 HCO section destinations, the daily flow, and every reachable module-preview hierarchy. The automated geometry checks found no horizontal overflow or undersized inspected buttons/summary controls. Visual review additionally caught and corrected awkward navigation wrapping at 200% text and an action that could cover a mini-map pin.

Measured product content widths included 304, 320, 360, 390, 415, approximately 430, 667, 740 and approximately 840 CSS pixels. These are actual rendered widths; surrounding preview chrome means they are not identical to the browser's requested viewport width. Ordinary, 150% and 200% text states were exercised. Not every screen was exercised at every Cartesian combination; narrow and 200% passes covered the broadest route sets, with representative regression checks at the other widths.

The final checks also confirmed case observation appears as an in-person route stop, an account without a loaded HCP cannot submit a wrongly attributed note, and a draft survives a wide-to-compact window change. No JavaScript errors were reported by the final browser log check.

This is **prototype browser verification**, not physical-device certification. Native keyboard behavior, actual OS text scaling, screen-reader behavior, gestures, notches/home indicators, real map-provider SDK behavior and low-memory/offline persistence still require emulator and physical-device tests when the production client exists. The 39-family inventory and 12-overlay count remain design scope, not a claim that every production screen is implemented.

17 October regression pass: the simplified Today, change-appointment flow, alternatives, HCP brief, meeting prep, material selection, booking and request draft were checked at approximately 305 pixels of available content, including 200% text. An additional wide capture check measured 840 pixels. Eleven recorded layout states had no horizontal overflow, controls outside the product surface or inspected buttons below 44 pixels. A conversation draft also survived Phone/Large text/Wide screen presentation changes. The browser log reported no JavaScript errors in this pass. These checks supplement the earlier 209-state pass; they do not re-certify all combinations after every change.
