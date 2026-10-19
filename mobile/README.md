# Field Pro · React Native app

This is the start of the production Field Pro app, built with Expo following [docs/integration.md](../docs/integration.md). It runs on the same fictional sample data as the browser prototype in [demo/](../demo/) and has no live services, sign-in or credentials.

## Run it

You need Node 22 or later.

```bash
npm install
npx expo start
```

Then open the app in one of these:

- **Phone.** Scan the QR code with Expo Go (Android) or the Camera app (iOS).
- **Simulator.** Press `i` for the iOS Simulator or `a` for an Android emulator.
- **Browser.** Press `w`.

## Check it

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
npx jest           # tests
npx expo-doctor    # dependency and config check
```

GitHub Actions runs the typecheck, lint and tests on every push.

## What's here

```
src/app/            routes (Expo Router)
  _layout.tsx       fonts, theme and the five tabs
  today/ targets/ ask/ activity/ insights/
    _layout.tsx     the tab's own stack (src/components/tab-stack.tsx)
    index.tsx       the tab's screen
    hcp/[id].tsx    profiles, re-exported from src/screens
    hco/[id].tsx
src/screens/        HCP and HCO profiles, shared by every tab
src/components/     screen layout, list rows, and ui/ from react-native-reusables
src/lib/            types, plan and search rules, formatting, sample data, workspace state
__tests__/          Jest ports of tests/plan.test.js and the search part of tests/state.test.js
```

- **Real data, placeholder features.** Each tab and profile renders the sample data. A note at the bottom of each screen says what is still to come: plan editing, maps, visit logging, Ask answers and voice. Changes are kept in memory only, until on-device storage is added.
- **Each tab keeps its own Back.** Every tab is a real folder with its own stack, and links open profiles inside the tab you are in (`/targets/hcp/alex`), so switching tabs and coming back returns you to the same screen.
  - Use `useProfileHref()` from `src/components/entity.tsx` to link to a profile.
  - Expo Router's shared `(group)` routes were tried first. They always opened profiles in the first tab, because every tab had the same URL.
- **Theme.** The colours in `global.css` are copied from [demo/css/tokens.css](../demo/css/tokens.css), in light and dark.
  - Tailwind names them in `tailwind.config.js` (`bg-brand-soft`, `text-signal-text` and so on).
  - Headings use Source Serif 4, kickers IBM Plex Mono, and body text the system sans.
- **Large text.** Text follows the system font size up to 200%, and every touch area is at least 44pt (small buttons and chips extend theirs with `hitSlop`).
  - Tab bar labels follow it on Android, and the bar grows to fit. iOS keeps them fixed and shows the large content viewer on long press, as Apple recommends.
- **Icons.** `lucide-react-native`, with the same names as the prototype.

To add a reusables component:

```bash
npx shadcn@latest add https://reactnativereusables.com/r/nativewind/<name>.json
```

Run it once per component. The reusables CLI fails when given several at once.
