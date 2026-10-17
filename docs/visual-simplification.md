# Visual hierarchy and shorter paths

18 October 2026. This pass responds to the feedback that the demo still felt visually complex, with similar colours and too many buttons between tasks. The earlier ten-persona pass established functional behavior; its passing tests did not establish low visual load or ease of use with real reps.

## Diagnosis and changes

The old dark theme used nearby navy shades for the page, cards, fields and secondary actions. Blue also indicated links, statuses, selected navigation and primary actions. Repeated outlined buttons and large specialist-tool tiles gave routine and occasional work similar weight.

The cobalt palette is retained. Page and card surfaces now have distinct roles, supporting copy is brighter, and form outlines are stronger. Blue indicates the main action/selection, green indicates confirmed/ready, amber indicates attention and neutral styling indicates a flexible plan. Labels and icons accompany status colours. Capture outcomes remain equal, explicit choices; Met is not preselected or highlighted as the preferred answer.

Today prioritizes the next visit: Prepare visit is the main action, Log visit is a quiet direct action, and Manage visit contains contextual alternatives. Later visits are tappable rows instead of repeated Prepare/Change button groups. The home map remains visible, with a tappable heading instead of another large Open map button.

The HCP brief and preparation now share one destination containing identity/site, why to reach out, the previous conversation, meeting goal and materials. Reports are selected inline. Specialist tools remain available in Insights through a disclosure. Activity uses tappable conversation rows; full transcripts and correction fields open on demand, while available source audio stays directly accessible. Preview controls also collapse outside the product.

Navigation now scrolls to the start of the app when changing destinations or reselecting a main tab. Previously a new screen could inherit the previous screen's scroll position and appear to open halfway down.

## Path changes

Counts below are control activations, excluding typing, scrolling and permission prompts. They are walkthrough counts, not measured human task times.

| Task | Before | Current |
|---|---|---|
| Add one flexible visit from Today | Add visit → select person → Review my day → Save day: 4 | Add visit → + beside person: 2. A time can be set later through Edit day. |
| Prepare from a target | Open target → Prepare for meeting: 2 | Open target: 1; the brief already includes preparation/materials. |
| Send a mock booking from its form | Draft request → Send demo request: 2 | Request demo appointment: 1. Personal holds and unsent drafts remain separate choices. |
| Recover a cancellation | Appointment changed → Doctor cancelled → choose alternative: 3 | Manage visit → Doctor cancelled → choose alternative: 3. No extra change-plan screen is required. |
| Log a minimal outcome | Log visit → outcome: 2 | Retained at 2, with no required note. |
| Select a preparation report | Open material selection screen → select report | Expand inline material picker → select report. Same activations; no separate selection screen. |

Full profile sections, contact/history, booking management, all specialist tools, the map/list views and the existing planning editor remain available. Detailed upstream datasets and real providers remain outside the mock demo's implementation scope.

## Verification

- **19 existing functional regression tests passed** after the changes.
- Browser checks exercised quick add, unified briefs, inline mock generation, one-action mock booking/acceptance, cancellation/replacement/undo, outcome capture, conversation retrieval/correction and specialist-tool disclosure.
- **36 measured layout states passed**: twelve states at 320 px with 200% text, 390 px and 840 px. HTML/control bounds fit; geographic paths clip within the map SVG by design.
- No browser console errors were observed. Page-change and main-tab scroll reset were verified with the app's top at viewport position 0.
- Ten computed text/foreground samples passed a 4.5:1 check across light and dark themes. This is targeted contrast verification, not a complete accessibility certification.

| Sample | Light ratio | Dark ratio |
|---|---:|---:|
| Body copy | 14.53:1 | 17.31:1 |
| Supporting text on a card | 6.61:1 | 8.90:1 |
| Main action | 7.57:1 | 8.76:1 |
| Confirmed status | 7.06:1 | 8.95:1 |
| Selected navigation | 7.57:1 | 8.76:1 |

Measured states and colour values: [visual-refinement-checks.json](visual-refinement-checks.json). Screenshots: [dark Today](screenshots/refined-today-dark.jpg), [light Today](screenshots/refined-today-light.jpg), [combined meeting brief](screenshots/refined-meeting-brief.jpg).

These checks establish working paths, contrast samples and responsive geometry. The user's assessment of visual simplicity and observation of real reps remain essential; a passing count is not a usability score.

## Design references

Material assigns separate roles to primary emphasis, surfaces and outlines; those roles informed the colour separation. [Material colour system](https://m3.material.io/styles/color/the-color-system).

The action hierarchy follows platform button guidance, with prominent styling reserved for the main task. [Apple button guidelines](https://developer.apple.com/design/human-interface-guidelines/buttons).

Occasional features use progressive disclosure while frequent actions stay near the current task. [Nielsen Norman Group: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
