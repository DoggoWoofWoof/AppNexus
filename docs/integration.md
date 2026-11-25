# Integration plan

The [field app design](../design/) is one HTML page that anyone can open in a browser. The phone app is **React Native with Expo**, built from this design in a separate, private repository. This page covers the stack as built, the data services it uses and the build order.

## App stack

| Concern | React Native app, as built |
| --- | --- |
| Screens and navigation | Expo Router with one route. Every screen, sheet and overlay is generated from the design, and the design's own logic moves between them, so the app can't drift from the design. |
| UI components | The generated screens, plus a small hand-written kit that makes React Native lay out like the design's CSS (grids, inline chips, animations) |
| Design tokens | The design's own colours, radii and type, carried into each generated style. Light only. |
| Icons | The design's own characters and inline SVG (`react-native-svg`) |
| Data loading, cache, retry | The app's own HTTP client, with a read cache and retry. Every screen shows its saved copy at once and swaps in fresh data the moment it arrives. |
| On-device data | Saved copies of each account's lists and figures (IndexedDB or local storage on the web, files on the phone), sign-in tokens in the secure store, and an outbox that keeps every change, recordings included, until the server has it |
| Maps | Mapbox's map tiles drawn by the app itself, so the pins, the radius circle and the ZIP areas sit on a map you can drag and pinch, with road times from Mapbox's routing |
| Recording and voice | `expo-audio` and the document picker for Record and Upload, set to keep recording with the screen locked; `expo-speech-recognition` for the mic, on the device; `expo-speech` for Listen. A realtime session comes later (see [ask-and-voice.md](ask-and-voice.md)). |
| Large text | The system font scale isn't set or tested yet |
| Tests | Jest, for the logic, the adapters and the writes; no screen or flow tests yet |

Not adopted, though planned earlier: NativeWind, react-native-reusables, `lucide-react-native`, TanStack Query, SQLite or MMKV, and Maestro. Generating the screens from the design made the component and token layers unnecessary, and the app's own cache and outbox cover the rest.

## Data services

The app uses the services below. Most already existed in the backends the websites use. The route-level mapping is kept in internal notes, not in this public repository.

| App need | Status |
| --- | --- |
| Rep's book: assigned people and accounts, with signals | Exists for the website. Read page by page, twenty to a page; a compact mobile response would make the first screen faster. |
| One set of filters for the target list and the opportunity map: near a place (start point and radius), state and city, and account type | Exists. Targets (Explore) and the map share one filter, radius included: the radius becomes the ZIP areas inside it, which the server filters on, then a straight-line trim on the phone. State and account type filter on the server; city filters on the phone. |
| Each customer account's setup: Record on or off, topics, meeting types and extra fields (see the [field app design](../design/)) | Works today from a table in the app that matches Insights' web client (keyed by email domain), plus the Field Pro setup reads. A server that serves each account's setup would replace it. Views are per account, picked in the account selector, never per person. The screens would not change. |
| Recording a meeting on the phone | Built, not yet tried on a phone. Insights accounts that record upload the audio for transcription; a recording the device ends (a call, another app taking the microphone) keeps the audio captured so far and says so. Field Pro accounts have no Record, as their website has none: the visit is typed. |
| Importing meetings by link | Insights accounts, as the website's Import links: up to 20 YouTube, Google Drive or file links, sent in one request that waits on the phone until the server has it. The server says whether it takes links; where it doesn't, the phone shows none. Private Google Drive files are left out, since their sign-in and picker belong to a browser. |
| HCP and HCO profile: identity, affiliations, volumes, referrals, network, people | Largely exists, spread across several website calls. One profile call per entity would suit mobile better. |
| Leakage for an account and its top destinations | Exists |
| The hospital leakage report (a PDF, built on demand in 3–5 minutes) | Exists, as on the website |
| Account and HCP briefs | Exists |
| Ask | Field Pro accounts only: they send the picked target list to the Ask the Field Pro website uses, and the answer is checked against what was sent. Insights accounts have no Ask; Stemline and Kura have Sphere of Influence in its place, as their website does. Ask needs to get faster for voice (see [ask-and-voice.md](ask-and-voice.md)). |
| Summaries of conversations | Exists for Insights accounts: the server writes the summary and a slide deck. Field Pro accounts have none, as their website has none. |
| Log a visit or note | Exists: the app saves to each account's own backend, as its website does. A change made offline waits on the phone and is sent when the connection is back. |
| Tasks and follow-ups | Left out on both products (2026-11-25): no one uses them, so the app has no task board, Add task or follow-ups. |
| The route (the day plan) | Field Pro accounts only, kept on the phone, as the website keeps it in the browser. The visits themselves reach the server. |
| Road routing and drive times | Mapbox's driving times, as the website uses, with its public token; without one, Add places stops by straight-line distance. The route shows the miles between stops and a map of them. |
| The opportunity map | Exists: Mapbox tiles you drag and pinch, with zoom and fit buttons, numbered pins that name the doctor on a tap, the radius around the start, and ZIP areas. It needs a latitude and longitude on each account, which the book gives. |
| Reading answers aloud | Exists: each answer has a Listen button, and a question asked by voice is answered aloud, using the phone's own voice. |
| CRM sync | Not in the app (2026-11-25): the server syncs a customer's CRM, so the phone has no CRM page, no Sync to CRM and no Export to CRM. |
| Removing someone straight from a list | On for Insights and Field Pro since 2026-11-23: a plain ✕, last among a card's and a page's buttons, takes the person off that list. Adding from Explore, and taking that row off again, stays on. |

## Design system

The look follows the **Ottava** design exports: Source Serif 4 for headings, IBM Plex Mono for small labels, the system sans for body text, a deep-blue accent, and orange for "act on this".

The exports themselves contain real physician names. They stay in the git-ignored `reference/` folder and must not be committed.

Tool suggestions from the team, and where each landed:

- **shadcn/ui** (through react-native-reusables and NativeWind): not adopted. The screens are generated from the design instead.
- **impeccable.style and tasteskill.dev.** Design-quality skills for AI coding agents; still useful as review passes on the screens.
- **Magic UI and React Bits.** Web (React DOM) component sets that do not run in React Native; ideas for motion only, such as list reveals, number tickers and the voice orb.
- **saaspo.com and other reference sites.** Collect three to five product screens the team likes, and give them as examples when reviewing screens.

## Build order

1. **Shell.** Done: the design's tabs and centre button, sign-in, and each account's setup (from the app's table until a server serves it). Large-text support is still to do.
2. **Book and profiles.** Done: Targets, Explore, and HCP and HCO profiles on live data, with loading, empty, offline and error states.
3. **Planning.** Done for Field Pro: Add, the route plan, the run sheet (with the website's Work step, Leakage report and Book appointment) and the day summary, with the route kept on the phone.
4. **Record and Activity.** Done: recording, insights, notes and link imports, kept on the phone until the server has them. Not yet tried on a phone.
5. **Ask.** Done for Field Pro: typed and push-to-talk, on the Ask service, with answers read aloud. Hands-free is next.
6. **Live voice mode,** once the Ask service is fast enough.
