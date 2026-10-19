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
- **Browser.** Press `w`. On a computer or an iPad the app runs inside a phone, with a switch to iPad size (`src/components/preview-frame.tsx`); on a phone it fills the screen. Add `?frame=off` to the address to see it on its own.

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
  today/ ask/ targets/             the tab bar: the day, Ask, who to see
  saved/ activity/ insights/ you/  opened from the ☰ menu
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
__tests__/            Jest tests for the plan, search, brief, notes, planner, Saved, figures, week summary, reminders and You page rules
```

- **One or two big buttons, and filters for the rest.** Reps should never have to hunt for the next step.
  - **Today:** the day's map and stops, with one "Add a visit" button that opens Targets.
    - Each stop says why they're worth seeing. A visit whose time has passed and isn't logged says "Not logged yet" and has its own Log button.
    - A "follow-ups due" bar opens Activity. An empty day offers "Pick 5 for me": the five most worth seeing, in route order, with Undo.
    - One small "Edit" on the list shows arrows to move an "Any time" stop between the fixed visits, "Set a time" (their usual times that day, or type one) and "Remove". Fixed visits stay at their times. Setting a time and Remove have Undo.
    - Each cancelled visit whose time hasn't come leaves its own "14:00 is free" banner, so a second cancel doesn't hide the first.
  - **Targets:** a search box, one Filters button, and "+ Add" on each row. "Select" picks several people, and one button at the bottom adds them all, with one toast and Undo.
    - While filling a free slot, people on site that day and usually seeing people then come first with "+ 14:00". Everyone else says when they usually are, e.g. "Usually Tue/Thu 07:30–08:30". Other free slots that day show as "Also free".
  - **Someone's page:**
    - The top has "Log visit" and "Can't make it" (or "Add to today"), then Ask, Call, Directions and Listen.
    - "Can't make it" asks whether to move the visit or cancel it. A cancelled visit can be put back at its time. A visit still waiting for a reply says how it was booked, with a "They confirmed" button.
    - Each tag under the name has a line in plain words saying what it means here, e.g. "Patients going elsewhere: 26% of patients here go to centres outside Mount Sinai Health System."
    - Below that are short cards: what to talk about, last time, top procedures, where patients go, where they work and how to reach them. An account also lists who sends patients out (the doctors there with the most referrals outside the system) and the people to meet, each with a call button.
  - **Logging:** Met or Not in, tap and talk (or type), then Save. At an account, Met asks who was there. The note box says to keep patient details out.
  - **Activity:** follow-ups by when they're due, each with Done, and every visit and note, found by any word.
  - **Insights:** accounts ranked by how many patients left, with the share under it. A big account losing 17% can lose more patients than a small one losing 36%.
  - **You:** the sample rep's name and team, marked "Sample profile", then one choice per row (`src/lib/prefs.ts`).
    - **Where your day starts:** Home or Office, two sample places (`START_POINTS` in `src/lib/data/seed.ts`). Today's map, distances on Targets, "Pick 5 for me" and Ask's "Who is near" all start from it through `ctx.start`. No live location is used.
    - **Appearance:** System, Light or Dark, with NativeWind's `setColorScheme` (`FollowAppearance` in `src/app/_layout.tsx`).
    - One line each says text size follows the phone and "Connection: sample data, not connected."
- **Figures say which months they cover.** `DATA_PERIOD` in `src/lib/data/seed.ts` ("Sample data, Oct 2025 to Sep 2026") is the one place that says it.
  - It's on Ask answers, visit prep and saved reports, copied text, under the figures on someone's page, and on Volumes and Insights.
  - Answers about notes, follow-ups and the plan end with "Sample data" instead, since they aren't from that period.
  - The sample figures are a fixed snapshot, so charts label their quarters from `FIGURES_END`, not today.
- **Plain words for tags.** "Patients going elsewhere" and "Busier than last year" replace "Leakage risk" and "Rising volume", on rows, the Targets filters and in Ask. Where patients go says "Same health system" and "Outside the system", not "In system" and "Out of system". `signalMeaning()` in `src/lib/data/index.ts` gives each tag's one-line meaning.
- **Menu screens are tabs without a button.** Saved, Activity, Insights and You keep their own Back like the other tabs, and their buttons are left out of the bar.
  - Don't use `href: null` for them. Expo Router 58 now sends a hidden tab back to the first tab.
- **Saved.**
  - **Visit prep** is rebuilt each time from the data, the plan and what the rep asked in Ask.
  - **Reports** are answers kept with Save or by saying "save that".
- **Summarise my week.** The report a rep sends their manager, from the last seven days (`week` in `src/lib/ask.ts`). It's one of the four chips on Ask, and "my week", "what did I do this week" or "weekly report" work too.
  - It covers visits done against those planned, who was cancelled, moved or not seen, notes logged, follow-ups still open and late, and the accounts covered.
  - It ends with two or three people to see next week, with the app's own reasons.
  - A moved visit remembers where it was (`movedFrom` on the plan item), so the week can say "moved from Thu to Fri".
  - It says "Sample data", since it comes from the plan and notes. Save keeps it in Saved as "Your week to 20 Oct". Copy ends, like other reports, with when it was made and "For internal use".
  - The sample has visits on the three working days before today, so there's always a week to show: two logged (one of them moved), one cancelled and one never logged.
- **Voice.**
  - Answers and saved items are read aloud with `expo-speech`.
  - Listening only works in the browser for now (Web Speech). On a phone, the mic buttons are hidden until a speech recognition module and a development build are added.
- **Sample data, kept on the phone.** There is no server yet. See `src/lib/persist.ts`.
  - The workspace (plans, notes, follow-ups, cancellations and Saved) is kept with AsyncStorage a moment after each change, and loaded on launch. In the browser that's `localStorage`.
  - A sample nobody has changed is seeded again each new day. Once the rep has changed something it's kept as it is, and only the selected day and past free slots move on to today.
  - The choices on the You page are kept with the workspace, but they don't count as a change: the sample is still seeded again, and keeps them. Undo leaves them alone too.
  - A half-written note in the log sheet is kept for that person and visit until it's saved, so closing the sheet by mistake loses nothing.
  - Nothing is sent anywhere, so the toasts say "saved on this phone" and notes and follow-ups say "On this phone · not sent yet".
  - To start the sample again, clear the site's storage in the browser, or the app's data on a phone.
- **Reminders on the phone.** Local notifications with `expo-notifications`; nothing comes from a server.
  - 15 minutes before each of today's visits with a fixed time: "Dr. Maya Patel at 10:00", with the visit's goal or what was promised. A tap opens their page in Today.
  - At 17:30, if any of today's visits have passed and aren't logged: "2 visits not logged yet". A tap opens Today, which flags them.
  - They follow the plan. After any change, `src/lib/reminders.ts` works out what the day needs and cancels and schedules only what changed (`__tests__/reminders.test.ts`).
  - The app asks once, with one sentence on why, and not on launch: the first time the rep gives today a visit at a fixed time, or comes back to the app with one still to come. After a no, it works as before.
  - The web build has none (`src/components/reminders.tsx`); the phone's version is `reminders.native.tsx`. Local notifications work in Expo Go, which warns that push notifications don't.
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
