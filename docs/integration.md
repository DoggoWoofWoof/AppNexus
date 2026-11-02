# Integration plan

The [field app design](../design/) is one HTML page that anyone can open in a browser. The production app will be **React Native with Expo**. This page covers the stack, the data services it needs and the build order.

## App stack

| Concern | React Native app |
| --- | --- |
| Screens and navigation | Expo Router. Tabs, with a stack inside each tab, so Back returns to where the rep was. |
| UI components | NativeWind (Tailwind classes) plus react-native-reusables, the React Native port of shadcn/ui |
| Design tokens | NativeWind theme with the design's colours, radii and type scale, in light and dark |
| Icons | `lucide-react-native` |
| Data loading, cache, retry | TanStack Query: cached results, retry, and an offline-first query cache |
| On-device data (notes, drafts, recordings waiting to upload) | SQLite (`expo-sqlite`) or MMKV, with a sync queue |
| Maps | `react-native-maps`, with road times from a routing service |
| Recording and voice | Audio recording that keeps going when the screen locks, native speech recognition, `expo-speech`, and later a realtime session (see [ask-and-voice.md](ask-and-voice.md)) |
| Large text | System font scale (Dynamic Type), tested at 200% |
| Tests | Jest and React Native Testing Library for logic and screens; Maestro for flows |

## Data services

The app needs the services below. Several already exist in the Field backend that the website uses. The route-level mapping is kept in internal notes, not in this public repository.

| App need | Status |
| --- | --- |
| Rep's book: assigned people and accounts, with signals | Exists for the website. Needs a compact mobile response. |
| One set of filters for the target list and the opportunity map: near a place (start point and radius), state and city, and account type | **To check.** The design gives Targets the map's filters. When wiring the endpoints, check how many of them both endpoints can share. If the target list can't filter by distance, drop the radius from Targets. |
| Each customer account's setup: Record on or off, topics, meeting types and extra fields (see the [field app design](../design/)) | **To check.** Insights keeps this in the web client, keyed by email domain. The app should get it from the server, per person where it differs: Kura MSLs get the KOMET topic list, and Stemline's view-only users can't add insights. Third Party meetings need Insights' vendor fields. |
| Recording a meeting on the phone | **Gap.** Recording has to keep going when the screen locks or the rep switches apps, and the audio has to stay on the phone until it can upload. |
| HCP and HCO profile: identity, affiliations, volumes, referrals, network, people | Largely exists, spread across several website calls. One profile call per entity would suit mobile better. |
| Leakage for an account and its top destinations | Exists |
| Account and HCP briefs | Exists |
| Ask | Exists. It needs to get faster for voice (see [ask-and-voice.md](ask-and-voice.md)). |
| Log a visit or note | Exists for the website |
| Follow-ups with due dates | **Gap.** Today they would live only on the device. |
| A saved day plan (timed and flexible stops, cancellations) | **Gap.** There is no durable day-plan contract yet. |
| Road routing and drive times | **Gap.** Needs a routing provider, such as Mapbox, Google Routes or an OSM-based service. |
| CRM sync | **Not connected.** |

## Design system

The look follows the **Ottava** design exports: Source Serif 4 for headings, IBM Plex Mono for small labels, the system sans for body text, a deep-blue accent, and orange for "act on this".

The exports themselves contain real physician names. They stay in the git-ignored `reference/` folder and must not be committed.

Lorick's tool suggestions, and where each fits:

- **shadcn/ui.** Use its React Native port, react-native-reusables, with NativeWind. The component names and patterns stay the same.
- **impeccable.style and tasteskill.dev.** These are design-quality skills for AI coding agents. Use them as review passes on the React Native screens once they exist.
- **Magic UI and React Bits.** These are web (React DOM) component sets and do not run in React Native. Use them for motion and pattern ideas only, such as list reveals, number tickers and the voice orb.
- **saaspo.com and other reference sites.** Collect three to five product screens the team likes, and give them as examples when generating or reviewing screens.

## Suggested build order

1. **Shell.** Expo app with the design's tabs and centre button, theme tokens, large-text support, sign-in, and each account's setup from the server.
2. **Book and profiles.** Targets search, then HCP and HCO profiles on live data, with loading, empty, offline and error states.
3. **Planning.** Multi-select, plan review and a saved day plan. This depends on the day-plan contract above.
4. **Record and Activity.** Recording, insights, notes and follow-ups, kept offline and synced when back online.
5. **Ask.** Typed and push-to-talk, on the Ask service. Then hands-free.
6. **Live voice mode,** once the Ask service is fast enough.
