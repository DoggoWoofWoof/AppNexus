# Integration plan

The prototype is intentionally plain web code, so it can be reviewed in a browser by anyone. The production app is **React Native with Expo**. This page maps one to the other.

## App stack

| Concern | Prototype | React Native app |
| --- | --- | --- |
| Screens and navigation | `screens/*.js`, with a stack for each tab in `nav.js` | Expo Router. Tabs, with a stack inside each tab, keep Back working the same way. |
| UI components | `ui.js` helpers and CSS | NativeWind (Tailwind classes) plus react-native-reusables, the React Native port of shadcn/ui |
| Design tokens | `css/tokens.css` | NativeWind theme with the same colours, radii and type scale, in light and dark |
| Icons | Lucide SVGs inlined in `icons.js` | `lucide-react-native` (same names) |
| Data loading, cache, retry | `api.js`, with Normal, Slow, Offline and Error modes | TanStack Query: cached results, retry, and an offline-first query cache |
| On-device data (plans, notes, drafts) | `localStorage` through `store.js` | SQLite (`expo-sqlite`) or MMKV, with a sync queue |
| Maps | Static SVG outline plus straight-line distance | `react-native-maps`, with road times from a routing service |
| Voice | Web Speech API in `voice.js` | Native speech recognition, `expo-speech`, and later a realtime session (see [ask-and-voice.md](ask-and-voice.md)) |
| Large text | `--ts` scale and em breakpoints | System font scale (Dynamic Type), tested at 200% |
| Tests | `node --test` on logic and rendering | Jest and React Native Testing Library for logic and screens; Maestro for flows |

These parts carry across almost unchanged:

- the pure logic modules: `plan.js`, `search.js`, `ask.js` (until the service replaces it), and the date and number helpers in `format.js`;
- the action names in `actions.js`, which become the app's event handlers.

## Data services

The app needs the services below. Several already exist in the Field backend that the website uses. The route-level mapping is kept in internal notes, not in this public repository.

| App need | Status |
| --- | --- |
| Rep's book: assigned people and accounts, with signals | Exists for the website. Needs a compact mobile response. |
| HCP and HCO profile: identity, affiliations, volumes, referrals, network, people | Largely exists, spread across several website calls. One profile call per entity would suit mobile better. |
| Leakage for an account and its top destinations | Exists |
| Account and HCP briefs | Exists |
| Ask | Exists. It needs to get faster for voice (see [ask-and-voice.md](ask-and-voice.md)). |
| Log a visit or note | Exists for the website |
| Follow-ups with due dates | **Gap.** Today they would live only on the device. |
| A saved day plan (timed and flexible stops, cancellations) | **Gap.** There is no durable day-plan contract yet. |
| Road routing and drive times | **Gap.** Needs a routing provider, such as Mapbox, Google Routes or an OSM-based service. |
| CRM sync | **Not connected.** It is labelled "Coming later" in the app. |

## Design system

The look follows the **Ottava** design exports: Source Serif 4 for headings, IBM Plex Mono for small labels, the system sans for body text, a deep-blue accent, and orange for "act on this".

The exports themselves contain real physician names. They stay in the git-ignored `reference/` folder and must not be committed.

Lorick's tool suggestions, and where each fits:

- **shadcn/ui.** Use its React Native port, react-native-reusables, with NativeWind. The component names and patterns stay the same.
- **impeccable.style and tasteskill.dev.** These are design-quality skills for AI coding agents. Use them as review passes on the React Native screens once they exist.
- **Magic UI and React Bits.** These are web (React DOM) component sets and do not run in React Native. Use them for motion and pattern ideas only, such as list reveals, number tickers and the voice orb.
- **saaspo.com and other reference sites.** Collect three to five product screens the team likes, and give them as examples when generating or reviewing screens.

## Suggested build order

1. **Shell.** Expo app with the five tabs, theme tokens, large-text support and sign-in.
2. **Book and profiles.** Targets search, then HCP and HCO profiles on live data, with loading, empty, offline and error states.
3. **Planning.** Multi-select, plan review and a saved day plan. This depends on the day-plan contract above.
4. **Activity.** Log visit, notes and follow-ups, kept offline and synced when back online.
5. **Ask.** Typed and push-to-talk, on the Ask service. Then hands-free.
6. **Live voice mode,** once the Ask service is fast enough.
