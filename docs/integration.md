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
| Maps | Mapbox's map tiles drawn by the app itself, so the pins, the radius circle and the ZIP areas sit on a map you can drag and pinch, with road times from Mapbox's routing |
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
| Recording a meeting on the phone | Built, not yet tried on a phone: recording keeps going with the screen locked. Insights accounts upload the audio for transcription; Field Pro accounts transcribe on the device, so no audio leaves the phone. |
| HCP and HCO profile: identity, affiliations, volumes, referrals, network, people | Largely exists, spread across several website calls. One profile call per entity would suit mobile better. |
| Leakage for an account and its top destinations | Exists |
| The hospital leakage report (a PDF, built on demand in 3–5 minutes) | Exists, as on the website |
| Account and HCP briefs | Exists |
| Ask | Exists: the Ask the Field Pro website uses, for every account, with the book or target list the phone holds. It needs to get faster for voice (see [ask-and-voice.md](ask-and-voice.md)). |
| Summaries of conversations | Exists for Insights accounts: the server writes the summary and a slide deck. For Field Pro accounts the phone writes it. |
| Log a visit or note | Exists: the app saves to each account's own backend, as its website does. A failed save comes back as a draft. |
| Follow-ups with due dates | Insights accounts: saved on Insights. Field Pro accounts: saved as a follow-up note; a store with due dates comes with unifying the accounts. |
| The route (the day plan) | Kept on the phone, as both websites keep it in the browser. The visits themselves reach the server. |
| Road routing and drive times | Mapbox's driving times, as the website uses, with its public token; without one, Add places stops by straight-line distance. The route shows the miles between stops and a map of them. |
| The opportunity map | Exists: Mapbox tiles you drag and pinch, with zoom and fit buttons, numbered pins that name the doctor on a tap, the radius around the start, and ZIP areas. It needs a latitude and longitude on each account, which the book gives. |
| Reading answers aloud | Exists: each answer has a Listen button, and a question asked by voice is answered aloud, using the phone's own voice. |
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
3. **Planning.** Add, the route plan, the run sheet and the day summary, with the route kept on the phone.
4. **Record and Activity.** Recording, insights, notes and follow-ups, kept offline and synced when back online.
5. **Ask.** Typed and push-to-talk, on the Ask service. Then hands-free.
6. **Live voice mode,** once the Ask service is fast enough.
