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
- **Browser.** Press `w`. On a computer the app runs inside a phone, with a switch to iPad size (`src/components/preview-frame.tsx`); on a phone or a tablet, which have touch screens, it fills the screen. Add `?frame=off` to the address to see it on its own.

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
  saved/ activity/ insights/ history/ you/  opened from the ☰ menu
    _layout.tsx       the tab's own stack (src/components/tab-stack.tsx)
    index.tsx         the tab's screen
    target/[id].tsx   someone's page, the only one for each doctor and account
    chat/[id].tsx     Ask about one person
    doc/[id].tsx      someone's full summary or a saved report (saved/[id].tsx in Saved)
    history/[id].tsx  an ended conversation, read again (History only)
src/screens/          the screens above, shared by every tab
src/components/       sheets, rows, map, charts, and ui/ from react-native-reusables
src/lib/              types, plan, search, Ask and Saved rules, sample data, workspace state
__tests__/            Jest tests for the plan, search, brief, notes, planner, the day as it goes, Saved, improving the Summary, figures, week summary, reminders, keeping work, History, someone's page, changing the day and You page rules
```

- **One or two big buttons, and filters for the rest.** Reps should never have to hunt for the next step.
  - **Today:** the day's map and stops, with one "Add a visit" button that opens Targets.
    - The button at the top switches to the next working day: "Tomorrow", or "Monday" on a Friday (`planDays()` and `dayWord()` in `src/lib/workspace.ts`).
    - Each stop says why they're worth seeing, and where: the site for a visit, or "Phone call". A visit with a time says "Not logged yet" once it's over, and an "Any time" stop from 17:30 (`notLogged()` in `src/lib/plan.ts`); each has its own Log button. Today checks the time every minute.
    - One "Still to do" card at the top holds what's left from before, in the app's plain card style rather than a coloured bar:
      - visits from the last seven days that were never logged, each with Log (dated that day) and "Didn't happen" side by side;
      - "2 follow-ups due", with how many are late, which opens Activity.
    - An empty day offers "Pick 5 for me": the five most worth seeing, in route order, with Undo. Suggestions are people who work that weekday, and for the next day anyone planned or seen today waits.
    - The map grows with the screen and says where the route starts, and that lines are straight, not roads.
    - "Best order" shows above the stops when the "Any time" ones could go in a shorter order, and puts them in it, with Undo. Visits with a time keep it, and nothing moves before a visit that has happened (`bestOrder()` in `src/lib/plan.ts`).
    - One small "Edit" on the list shows arrows to move an "Any time" stop between the fixed visits, "Set a time" (their usual times that day, or type one) and "Remove", with Undo. A visit with a time stays at its time and offers "Can't make it" (move or cancel) instead of Remove, since someone is expecting the rep. Edit closes when the rep leaves the screen.
    - Each cancelled or moved visit whose time hasn't come leaves its own "14:00 is free" banner, so a second one doesn't hide the first. A banner goes once its time has gone or someone else is in it, and filling it says why when someone can't go in (`fillSlotError()`).
    - Cancelling a visit, its banner's "Find someone", or logging "Not in" opens one sheet with the three best people to see instead: in that day, free then, close to where the visit was and most worth seeing (`standIns` in `src/lib/workspace.ts`). Each is one tap to add, with "See everyone" for Targets. After "Not in" it offers their next usual time first.
  - **Targets:** a search box, one Filters button, and "+ Add" on each row. "Select" picks several people, and one button at the bottom adds them all, with one toast and Undo.
    - Each doctor says whether they're in that day ("In 12:30–13:30", "Not in on Tuesdays" or "Gone for today"), and those who are come first (`inOnDay()` in `src/lib/booking.ts`). Someone who isn't gets "+ Call", a phone call instead of a visit.
    - Adding puts each person where they add the least travel, between the visits with a time (`placeStops()` in `src/lib/plan.ts`). Someone already in the plan at any time gets "Set a time".
    - While filling a free slot, people on site that day and usually seeing people then come first with "+ 14:00". Everyone else says when they usually are, e.g. "Usually Tue/Thu 07:30–08:30". Other free slots that day show as "Also free".
  - **Someone's page:** one page for every doctor and account, the same layout whether they're new or well known (`src/screens/target.tsx`).
    - The name, what they do and when the next visit is, then the **Summary**: where they work and when they're in, the last contact, follow-ups owed, why they matter and the next step (`summaryOf()` in `src/lib/brief.ts`). It's written from the data until the rep improves it through Ask, and "Full summary" opens the rest.
    - Then "Log visit" and "Can't make it" (or "Add to today", or "Add a call today" when they aren't in), then Ask, Call, Directions and Listen. Listen reads the summary, the volume, the next step and the points to bring up (`speechFor()`).
    - "Can't make it" offers three things: "Move to tomorrow" (or "Move to another time" for a visit with a time), "Cancel the visit" and "Keep it". A cancelled visit can be put back at its time. A visit still waiting for a reply says how it was booked, with a "They confirmed" button.
    - Below that are short cards (`src/components/target-info.tsx`, `src/lib/target.ts`, `__tests__/target.test.tsx`). "See all" opens a card in full where it is, and each figure at the top opens its card, so nothing opens another page. A link from Ask opens the card it's about (`cardFor()`):
      - The volume, patients leaving and last contact.
      - "Follow-ups": open ones, how late each is, and Done.
      - "Last time": the last note; See all shows every note.
      - "You asked before": the last 3 questions asked about them in Ask. An ended conversation opens in History; one from today opens where the rep can carry on.
      - "Visits so far": every visit and call, planned or noted, with what happened (Met, Not in, Cancelled, Not logged yet) and when, plus a line like "Tried 3 times, met once." Once enough have worked it says when, e.g. "Tuesday mornings have worked."
      - "How to get in": who books, how they like to be asked, their usual times and whether they usually confirm, and "Book a time". The notes on how to ask are fictional sample notes (`access` in `src/lib/data`).
      - "Similar doctors nearby" (doctors only): up to 3 who do the same procedures or specialty, or see the same main conditions, work within 3 km that day and usually see people then. Each has + to add them to that day.
      - Top procedures; See all shows every procedure and diagnosis with its quarters (`src/components/volumes.tsx`).
      - "Who they refer to" (by doctor or centre, with how many went outside the system); See all adds who sends patients to them and who they work closely with. Then where they work.
      - "Contact and details": phone and email or address; See all adds the rest of the record.
    - An account has "Where patients go" (See all adds leaving by procedure), who sends patients out (the doctors there with the most referrals outside the system), its busiest doctors, the people to meet, each with a call button, and its health system.
  - **Logging:** Met or Not in, tap and talk (or type), then Save. With nothing planned it first asks "Visit or call?", and a call is Talked or No answer. "Add a follow-up" saves something to do next and when. "Not in" shows on Today and the week as itself, not as done, and never as "Attempted" (`outcomeWord()` in `src/lib/brief.ts`). The note and follow-up boxes say to keep patient details out.
    - At an account, Met asks who was there, with doctors planned there today first. Ticking one marks their visit that day done too (`visitsLogged()` in `src/lib/workspace.ts`).
    - A note of the same kind on the same day logs a planned visit with them too, but a call doesn't stand for a visit.
  - **Activity:** one list of follow-ups, soonest first, each saying how late it is, with Done. Then every visit and note in short rows (who, when, what kind and how it went), newest first, found by any word.
  - **Insights:** accounts ranked by how many patients left, with the share under it. A big account losing 17% can lose more patients than a small one losing 36%.
  - **You:** the sample rep's name and team, marked "Sample profile", then one choice per row (`src/lib/prefs.ts`).
    - **Where your day starts:** Home or Office, two sample places (`START_POINTS` in `src/lib/data/seed.ts`). Today's map, distances on Targets, "Pick 5 for me" and Ask's "Who is near" all start from it through `ctx.start`. No live location is used.
    - **Reminders:** all, "17:30 only" or off (`ReminderChoice` in `src/components/reminders.native.tsx`). In the browser it says reminders come on the phone app.
    - **Appearance:** System, Light or Dark, with NativeWind's `setColorScheme` (`FollowAppearance` in `src/app/_layout.tsx`).
    - At large text sizes the choices stack instead of wrapping (`src/components/choice-buttons.tsx`).
    - One line each says text size follows the phone and "Connection: sample data, not connected."
- **Figures say which months they cover.** `DATA_PERIOD` in `src/lib/data/seed.ts` ("Sample data, Oct 2025 to Sep 2026") is the one place that says it.
  - It's on Ask answers, full summaries and saved reports, copied text, under the figures on someone's page, and on Volumes and Insights.
  - Labels say "12 months" and "on last year", and `PRIOR_PERIOD` names the year compared with ("Compared with Oct 2024 to Sep 2025").
  - Answers about notes, follow-ups and the plan end with "Sample data" instead, since they aren't from that period.
  - The sample figures are a fixed snapshot, so charts label their quarters from `FIGURES_END`, not today.
- **Plain words for tags.** "Patients going elsewhere" and "Busier than last year" replace "Leakage risk" and "Rising volume", on rows, the Targets filters and in Ask. Where patients go says "Same health system" and "Outside the system", not "In system" and "Out of system". `signalMeaning()` in `src/lib/data/index.ts` gives each tag's one-line meaning.
  - There's no "Leakage" or "code group": procedure codes show only when the volumes card is opened in full, and Ask offers "See where they go".
- **Menu screens are tabs without a button.** Saved, Activity, Insights, History and You keep their own Back like the other tabs, and their buttons are left out of the bar.
  - Don't use `href: null` for them. Expo Router 58 now sends a hidden tab back to the first tab.
- **Saved.**
  - **Summaries** open from the card on someone's page ("Full summary") or from Saved. Each is written from the data, the plan and what the rep asked in Ask, until the rep improves it. Inside the app it's still called prep (`prepId`, `src/lib/prep.ts`, `src/components/prep-actions.tsx`, `src/components/summary-card.tsx`, `__tests__/prep.test.tsx`):
    - The card and the full summary each have two buttons, "Improve with Ask" and "Edit" ("Edit summary" on the full one).
    - Edit keeps the rep's own summary, one point to a line, and their goal. Only these are kept, with the workspace on the phone (`prep` in `Workspace`). Their lines replace the one written from the data, on the card, in Listen (`improvedSummary()`) and at the top of the full summary, and talking points that say the same are left out. Their goal becomes the next step. Clearing both goes back to the data.
    - "Improve with Ask" asks "How can I improve their summary?" in the person's own Ask. It suggests up to three things the summary doesn't say yet, and "Add to summary" adds them to the rep's lines and goes back to the card or the full summary.
    - With nothing planned, owed, written or asked (`isThinPrep()`), the button says "Write a summary with Ask", and the full summary leads with it. Ask drafts a goal and what to bring up, and "Write my own" opens Edit.
    - Asking Ask for help with the summary isn't added to it as a question about them.
  - **Reports** are answers kept with Save or by saying "save that".
- **History.** In the menu, under Saved (`src/app/history/index.tsx`, `src/lib/chat.tsx`).
  - **Conversations:** what was asked in Ask, about the territory or one person, newest first, with when and how many questions.
    - "New" on Ask ends a conversation and starts another; so does the day ending. Ask's empty screen then links to History.
    - Today's conversation opens where the rep can carry on. An ended one opens read-only, as it was, saying figures and plans may have changed since. Its answers can still be saved, read aloud and followed, and one button carries on in Ask.
    - The last 30 are kept on the phone under `CHATS_KEY`, written a moment after each change. A question still waiting for its answer isn't kept.
  - **People you opened:** the last 10 doctors and accounts whose page was opened, once each, newest first.
  - "Delete this conversation" and "Clear history" each ask first. Neither touches Saved, notes or the plan.
  - A full summary uses every question kept about the person. Saved's list of people asked about only covers this week.
- **Summarise my week.** The report a rep sends their manager, from the last seven days (`week` in `src/lib/ask.ts`). It's one of the four chips on Ask, and "my week", "what did I do this week" or "weekly report" work too.
  - It covers visits logged out of those due so far ("2 of 3 visits logged", leaving out cancelled visits and those later today), which were cancelled, moved or never logged ("Dr. Rossi: visit cancelled (Fri)"), notes logged, follow-ups still open and late, and the accounts covered. "Not in" is counted on its own.
  - It ends with two or three people to see next week, one row each that opens them, with the app's own reasons and when they're usually free.
  - A moved visit remembers where it was (`movedFrom` on the plan item), so the week can say "Thu, moved from Wed".
  - Listen and the saved copy read every row.
  - It says "Sample data", since it comes from the plan and notes. Save keeps it in Saved as "Your week to 20 Oct". Copy ends, like other reports, with when it was made and "For internal use".
  - The sample has visits on the three working days before today, so there's always a week to show: two logged (one of them moved), one cancelled and one never logged.
- **Voice.**
  - Answers and saved items are read aloud with `expo-speech`.
  - Listening only works in the browser for now (Web Speech). On a phone, the mic buttons are hidden until a speech recognition module and a development build are added.
- **Sample data, kept on the phone.** There is no server yet. See `src/lib/persist.ts`.
  - The workspace (plans, notes, follow-ups, cancellations and Saved) is kept with AsyncStorage a moment after each change, and loaded on launch. In the browser that's `localStorage`.
  - A sample nobody has changed is seeded again each new day. Once the rep has changed something it's kept as it is, and only the selected day and past free slots move on to today.
  - Left open overnight, the app does the same at midnight, or when it comes back to the front on a new day (`LoadedWorkspace` in `src/lib/store.tsx`).
  - What an older version kept is copied to `BACKUP_KEY` before the sample starts again, and the rep is told. A write that fails is tried again with the next change.
  - The choices on the You page are kept with the workspace, but they don't count as a change: the sample is still seeded again, and keeps them. Undo leaves them alone too.
  - A half-written note in the log sheet is kept for that person and visit until it's saved, so closing the sheet by mistake loses nothing. If the visit is later moved or cancelled, the note stays as a draft for the person.
  - Nothing is sent anywhere, so the toasts say "saved on this phone", and one line at the bottom of Activity and of someone's page says notes stay on this phone for now.
  - Android backup is off (`allowBackup` in `app.json`), so notes don't go to the cloud.
  - To start the sample again, clear the site's storage in the browser, or the app's data on a phone.
- **Reminders on the phone.** Local notifications with `expo-notifications`; nothing comes from a server. They cover today and the next working day, so a plan made tonight reminds tomorrow.
  - 15 minutes before each visit with a fixed time: "Dr. Maya Patel at 10:00 · Mount Sinai Hospital". A tap opens their page in Today.
  - A reminder can show on a locked phone, so it never carries what the rep typed. The body only says "Not confirmed yet", "Something you promised is due" and "Tap for what to bring and talk about." Android shows them as private on the lock screen.
  - At 17:30, if any visits that day are still not logged, "Any time" stops included: "3 visits not logged yet". A tap opens Today, which flags them.
  - They follow the plan. After any change, `src/lib/reminders.ts` works out what's needed and cancels and schedules only what changed (`__tests__/reminders.test.ts`).
  - The app asks once, with one sentence on why, and not on launch: the first time the rep gives a visit a fixed time, or comes back to the app with one still to come. "Not now" turns them off, and only a real answer counts as asked.
  - The Reminders row on You turns them back on (asking the phone again, or opening Settings if it won't ask), keeps only the 17:30 one, or turns them off.

  - The web build has none (`src/components/reminders.tsx`); the phone's version is `reminders.native.tsx`. Local notifications work in Expo Go, which warns that push notifications don't.
- **Each tab keeps its own Back.** Every tab is a real folder with its own stack, and links open screens inside the tab you are in (`/targets/target/alex`), so switching tabs and coming back returns you to the same screen.
  - To link to a person's page, their full summary or a chat, use `useProfileHref()`, `useDocHref()` and `useChatHref()` from `src/components/entity.tsx`.
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
