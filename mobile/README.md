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
src/app/              routes (Expo Router)
  _layout.tsx         fonts, theme, the three tabs and the menu's screens
  today/ ask/ targets/          the tab bar: the day, Ask, who to see
  saved/ activity/ insights/    opened from the ☰ menu
    _layout.tsx       the tab's own stack (src/components/tab-stack.tsx)
    index.tsx         the tab's screen
    target/[id].tsx   someone's page: the big buttons, then what to know
    chat/[id].tsx     Ask about one person
    doc/[id].tsx      visit prep or a saved report (saved/[id].tsx in Saved)
    hcp/[id].tsx      the full profile, behind "All details"
    hco/[id].tsx
src/screens/          the screens above, shared by every tab
src/components/       sheets, rows, map, charts, and ui/ from react-native-reusables
src/lib/              types, plan, search, Ask and Saved rules, sample data, workspace state
__tests__/            Jest tests for the plan, search, brief, notes, planner and Saved rules
```

- **One or two big buttons, and filters for the rest.** Reps should never have to hunt for the next step.
  - **Today:** the day's map and stops, with one "Add a visit" button that opens Targets.
    - Each stop says why they're worth seeing. A visit whose time has passed and isn't logged says "Not logged yet" and has its own Log button.
    - A "follow-ups due" bar opens Activity. An empty day offers "Pick 5 for me": the five most worth seeing, in route order, with Undo.
  - **Targets:** a search box, one Filters button, and "+ Add" on each row. After a visit is cancelled, the rows show "+ 14:00" to fill that time, nearest first.
  - **Someone's page:**
    - The top has "Log visit" and "Can't make it" (or "Add to today"), then Ask, Call, Directions and Listen.
    - "Can't make it" asks whether to move the visit or cancel it. A cancelled visit can be put back at its time. A visit still waiting for a reply says how it was booked, with a "They confirmed" button.
    - Below that are short cards: what to talk about, last time, top procedures, where patients go, where they work and how to reach them. An account also lists the people to meet, each with a call button.
  - **Logging:** Met or Not in, tap and talk (or type), then Save. At an account, Met asks who was there. The note box says to keep patient details out.
  - **Activity:** follow-ups by when they're due, each with Done, and every visit and note, found by any word.
- **Menu screens are tabs without a button.** Saved, Activity and Insights keep their own Back like the other tabs, and their buttons are left out of the bar.
  - Don't use `href: null` for them. Expo Router 58 now sends a hidden tab back to the first tab.
- **Saved.**
  - **Visit prep** is rebuilt each time from the data, the plan and what the rep asked in Ask.
  - **Reports** are answers kept with Save or by saying "save that".
- **Voice.**
  - Answers and saved items are read aloud with `expo-speech`.
  - Listening only works in the browser for now (Web Speech). On a phone, the mic buttons are hidden until a speech recognition module and a development build are added.
- **Sample data only.** Changes are kept in memory, so reloading starts the day again.
- **Each tab keeps its own Back.** Every tab is a real folder with its own stack, and links open screens inside the tab you are in (`/targets/target/alex`), so switching tabs and coming back returns you to the same screen.
  - To link to a person's page, a prep or a chat, use `useProfileHref()`, `useDocHref()` and `useChatHref()` from `src/components/entity.tsx`.
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
