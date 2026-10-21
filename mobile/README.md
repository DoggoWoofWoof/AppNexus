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
  saved/ activity/ insights/ you/  opened from the ☰ menu
    _layout.tsx       the tab's own stack (src/components/tab-stack.tsx)
    index.tsx         the tab's screen
    target/[id].tsx   someone's page, the only one for each doctor and account
    chat/[id].tsx     Ask about one person
    doc/[id].tsx      someone's full summary or a saved report (saved/[id].tsx in Saved)
    history.tsx       every Ask conversation, opened again to carry on (Ask only)
src/screens/          the screens above, shared by every tab
src/components/       sheets, rows, map, charts, and ui/ from react-native-reusables
src/lib/              types, plan, search, Ask and Saved rules, sample data, workspace state
__tests__/            Jest tests for the plan, search, brief, notes, planner, the day as it goes, Saved, improving the Summary, figures, week summary, reminders, keeping work, History, someone's page, changing the day and You page rules
```

- **One or two big buttons, and filters for the rest.** Reps should never have to hunt for the next step.
  - **Today:** the day's map and stops, with one "Add a visit" button that opens Targets.
    - The button at the top switches to the next working day: "Tomorrow", or "Monday" on a Friday (`planDays()` and `dayWord()` in `src/lib/workspace.ts`). Messages say a day the way people do: "today", "tomorrow", its weekday in the week ahead ("Friday"), or else its date (`dayInWords()` in `src/lib/format.ts`).
    - Each stop says why they're worth seeing, and where: the site for a visit, or "Phone call". A visit with a time says "Not logged yet" once it's over, and an "Any time" stop from 17:30 (`notLogged()` in `src/lib/plan.ts`); each has its own Log button. Today checks the time every minute.
    - From 17:30 the day is over. One banner at the top says how many visits weren't done, "2 visits not done today", with "Move them to tomorrow". One tap moves them all to the next working day as "Any time", or someone not in then to the next day they're in, with one Undo: "3 visits moved to tomorrow · Dr. Raman to Thursday, when they’re in" (`notDoneToday()` in `src/lib/workspace.ts` and `moveNotDone()` in `src/lib/store.tsx`). A booked visit stays, as it moves with Change the time. One done but not logged keeps its Log button, and logging it takes it out of the count.
      - Those visits stop showing a time worked out for today, or a warning about it, and the line over the stops stops saying when the day should finish. Best order goes too, as nothing is left to put in order.
      - A "Move to tomorrow" on each visit was the other choice. One banner was picked, to keep it to one button.
    - Every stop has a time: its own, or "About 10:50" for an "Any time" stop still to come. The app works it out from the drive between stops and their usual times that day, and never puts an "Any time" stop where it would make the rep late for a visit with a time. Today, nothing still to do goes before now (`scheduleDay()` in `src/lib/plan.ts`).
      - The drive is a city guess from straight lines: 5 minutes to park and walk in, and 4 a km, rounded up to 5 (`travelMinutes()`). A call needs no drive.
      - The line over the stops says how many, the driving and, while anything is still to come, when the day should finish: "6 stops · 1 h 5 min driving · finish about 16:15".
      - The drive to each stop is on a line between it and the one before, like directions in a maps app: "20 min drive". The line to the next visit in person also says when to set off, "· Leave by 09:50", or "Leave now" when that's in the next five minutes. It skips calls and a visit going on now, and on the next day it's the first visit's. A call has no line.
      - A stop that isn't a good day or time for them says so, with a better one (`timeWarning` in `src/lib/workspace.ts`): "Not in on Wednesdays · try tomorrow" on a day they aren't in, and "Not their usual time · usually 08:00–11:00" outside their usual times. An account, or a doctor whose own times aren't known, goes by office hours: "Outside office hours · 09:00–17:00", and an account is "Closed on Saturdays" rather than not in (`outsideTimes()` and `notInOn()` in `src/lib/booking.ts`). A booked visit says neither, as its time was agreed with them. Any stop after 17:30 says "After 17:30".
      - Two visits with a time too close to drive between say so on the line between them: "Too tight: 15 min drive from Dr. Lee, only 5 min between". The drive is from the last place visited, so a call in between doesn't count.
      - Putting all of this as lines of text on each stop was tried too, and read as a wall of words.
    - One "Still to do" card at the top holds what's left from before, in the app's plain card style rather than a coloured bar:
      - visits from the last seven days that were never logged, each with Log (dated that day) and "Didn't happen" side by side;
      - "2 follow-ups due", with how many are late, which opens Activity.
    - An empty day offers "Pick 5 for me": the five most worth seeing, in route order, with Undo. So does a day whose visits were all cancelled ("Nothing left planned"). Once today is over it says "Nothing left today", and the five go on the next working day. Suggestions are people who work that weekday, and for the next day anyone planned or seen today waits.
    - The map grows with the screen and says where the route starts, and that lines are straight, not roads.
    - "Best order" shows above the stops when the "Any time" ones still to come could go in an order with less driving, and puts them in it, with Undo. It keeps people in their usual times, even when that means a little more driving. Visits with a time keep it, and nothing moves before a visit that has happened (`bestOrder()` and `dayCost()` in `src/lib/plan.ts`).
    - There is no edit mode. Each stop has a ⋯ that opens "Change visit" (below) right on Today, like tapping an event in a phone's calendar, and a line under the stops says so.
    - "Any time" stops have dots on the left: hold them and drag the stop up or down, and the others move to make room. The drives fade while it moves, then show the new ones. Visits with a time keep it and have no dots, and so does a stop with nowhere else to go, such as the last one after visits that have happened. A stop dropped before one it can't fit before goes straight after it, and the message says where it went, with Undo (`moveStop()` in `src/lib/workspace.ts`). With a screen reader, swipe up or down on the dots to move it one place.
      - A "Go here next" choice in Change visit was tried first. Dragging was liked better: the order is right there to change, and a stop can go anywhere, not only next.
    - Each cancelled or moved visit whose time hasn't come leaves its own "14:00 is free" banner, so a second one doesn't hide the first. A banner goes once its time has gone or someone else is in it, or when the rep taps "Leave it free", and filling it says why when someone can't go in (`fillSlotError()`). Targets doesn't offer a time that has gone either (`fillingSlot()`).
    - Cancelling a visit, its banner's "Find someone", or logging "Not in" opens one sheet with the three best people to see instead: in that day, free then, close to where the visit was and most worth seeing (`standIns` in `src/lib/workspace.ts`). Each is one tap to add. "See everyone" opens Targets with the same things set as filters: in that day, not planned, nearest to where the visit was first (`insteadFilters()` in `src/lib/search.ts`). A line at the top says who it's instead of, Filters shows each one to change, and the X shows everyone again. After "Not in" it offers their next usual time first. After a call nobody answered it offers "Call again tomorrow" instead, as a call isn't anywhere to be close to.
  - **Choosing a time:** one sheet for "Book a time", "Change the time" and "Set a time", like booking on a scheduling page (`src/components/time-sheet.tsx`). It shows only the free times, as big buttons: their usual times first with the best one already picked, and "Other times" one tap away. Times too close to another visit to drive between aren't shown, and a line says what else the rep has that day and how far each is. Booking can switch between the next five working days, and it says when they aren't usually in that day (`dayGrid()` in `src/lib/booking.ts`). Picking the visit's own time again says "Keep 10:00" and changes nothing.
  - **Targets:** a search box, one Filters button, and "+ Add" on each row. "Select" picks several people, and one button at the bottom adds them all, with one toast and Undo.
    - Each doctor says whether they usually work that day ("In 12:30–13:30" or "Not in on Tuesdays"; an account "Closed on Saturdays"), and those who do come first (`inOnDay()` in `src/lib/booking.ts`). It goes by their usual days only, so adding is always a plain "+ Add". Filters can also show only who's in that day. Once they're planned the row says when, or, as Today does, why it isn't a good day or time ("Not in on Wednesdays · try tomorrow"), and once logged today how it went ("Met today").
    - Sorted by name, doctors go by surname, as the rows show them ("Dr. Lee").
    - Adding puts each person where they add the least driving, in their usual times and between the visits with a time (`placeStops()` in `src/lib/plan.ts`). The message says where, as the map numbers the stops: "Dr. Kenji Watanabe added today · stop 2, after Dr. Patel". Someone already in the plan at any time gets "Set a time".
    - Someone added on a day they aren't in is still added, as the rep may know better, but the message says so and offers the next day they're in: "Dr. Priya Raman added today, but they’re not in on Wednesdays" (for an account, "but it’s closed on Saturdays"), with "Tomorrow instead" and Undo (`moveDayFor()` in `src/lib/workspace.ts`). Adding several says how many aren't in.
    - After 17:30, adding to today adds to the next working day and shows it: "Today’s over: Dr. Marcus Bell added tomorrow", with "Today instead" for someone met late. Once the rep picks "Today instead", adds go to today for the rest of the evening (`addingTo()` in `src/lib/store.tsx`). "Add to …" on someone's page and "Pick 5 for me" follow the same day.
    - A message with a choice like these stays up 10 seconds instead of 6, with the choice next to Undo (`src/components/notice-bar.tsx`).
    - While filling a free slot, people on site that day and usually seeing people then come first with "+ 14:00". Everyone else says when they usually are, e.g. "Usually Tue/Thu 07:30–08:30". Other free slots that day show as "Also free".
  - **Someone's page:** one page for every doctor and account, the same layout whether they're new or well known (`src/screens/target.tsx`).
    - The name, what they do and when the next visit is, then the **Summary**, one paragraph. It starts with where they work and when they're in (office hours, for an account), the last contact and follow-ups owed, written from the data each time so it stays up to date (`summaryOf()` in `src/lib/brief.ts`). Then come the rep's own words, written with Edit or by Ask, or why they matter until there are some (`summaryParagraph()`). The next step goes under it, and "Full summary" opens the rest.
    - Then "Log visit" and "Change visit" (or "Add to today"), then Ask, Call, Directions and Listen. Listen reads the Summary as the card has it, the volume, why they matter if the Summary doesn't say it, the next step and the points to bring up that it doesn't say already (`speechFor()`).
    - "Change visit" (also the ⋯ on Today) is a short list of choices. A booked visit offers "Change the time" and "Cancel the visit", since someone is expecting the rep. An "Any time" stop, or one the rep gave a time themselves, offers "Set a time" (or "Change the time"), "Move to tomorrow" and "Remove from today", with Undo. The move goes to the next working day they aren't planned already and, in person, are in, as "Any time": "Move to Thursday, when they’re in" when that skips a day. On a day they aren't in, it comes first. Either kind can be made a phone call or a visit in person ("How"; a meeting, for an account) and take 15 to 60 minutes ("How long"). These change straight away, with Undo, and the day's times and driving follow; a call made a visit goes where they are that day. "Done" closes it. A cancelled visit can be put back at its time while that's still to come. A visit still waiting for a reply says how it was booked, with a "They confirmed" button.
    - Below that are short cards (`src/components/target-info.tsx`, `src/lib/target.ts`, `__tests__/target.test.tsx`). "See all" opens a card in full where it is, and each figure at the top opens its card, so nothing opens another page. A link from Ask opens the card it's about (`cardFor()`):
      - The volume, patients leaving and last contact.
      - "Follow-ups": open ones, how late each is, and Done.
      - "Last time": the last note; See all shows every note.
      - "You asked before": the last 3 questions asked about them in Ask. Each opens the conversation it was asked in, to carry on, as History does.
      - "Visits so far": every visit and call, planned or noted, with what happened (Met, Not in, Cancelled, Not logged yet) and when, plus a line like "Tried 3 times, met once." Once enough have worked it says when, e.g. "Tuesday mornings have worked."
      - "How to get in": who books, how they like to be asked, their usual times and whether they usually confirm, and "Book a time". The notes on how to ask are fictional sample notes (`access` in `src/lib/data`).
      - "Similar doctors nearby" (doctors only): up to 3 who do the same procedures or specialty, or see the same main conditions, work within 3 km that day and usually see people then. Each has + to add them to that day.
      - Top procedures; See all shows every procedure and diagnosis with its quarters (`src/components/volumes.tsx`).
      - "Who they refer to" (by doctor or centre, with how many went outside the system); See all adds who sends patients to them and who they work closely with. Then where they work.
      - "Contact and details": phone and email or address; See all adds the rest of the record.
    - An account has "Where patients go" (See all adds leaving by procedure), who sends patients out (the doctors there with the most referrals outside the system), its busiest doctors, the people to meet, each with a call button, and its health system.
  - **Logging:** Met or Not in, tap and talk (or type), then Save. With nothing planned it first asks "Visit or call?", and a call is Talked or No answer. A meeting with an account is Met or Didn’t meet. "Add a follow-up" saves something to do next and when. "Not in", or "No answer" for a call, shows on Today, Targets, their page and the week as itself, not as done, and never as "Attempted" (`outcomeWord()` in `src/lib/brief.ts`). The note and follow-up boxes say to keep patient details out.
    - At an account, Met asks who was there, with doctors planned there today first. Ticking one marks their visit that day done too (`visitsLogged()` in `src/lib/workspace.ts`).
    - A note of the same kind on the same day logs a planned visit with them too, but a call doesn't stand for a visit.
    - Meeting someone by chance, with nothing planned, counts as logged today too: their page says "Logged. Nice work.", Targets says "Met today", and "Add a note" keeps how they were seen (`loggedToday()` in `src/lib/workspace.ts`).
    - An "Any time" stop logged out of turn goes where it happened in the day's order, and a visit with a time logged early doesn't hold back the stops before it (`visitsLogged()`, and `fixedStops()` in `src/lib/plan.ts`).
    - Saving a note or a follow-up puts away the Undo from before it, so Undo can't take the note with it.
  - **Activity:** one list of follow-ups, soonest first, each saying how late it is, with Done. The top says how many are due now, as the menu does. Then every visit and note in short rows (who, when, what kind and how it went), newest first, found by any word.
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
- **Menu screens are tabs without a button.** Saved, Activity, Insights and You keep their own Back like the other tabs, and their buttons are left out of the bar. The menu's History opens History on Ask.
  - Don't use `href: null` for them. Expo Router 58 now sends a hidden tab back to the first tab.
- **Saved.**
  - **Summaries** open from the card on someone's page ("Full summary") or from Saved. Each is one working copy, always up to date: written from the data and the plan, with the rep's own words, or Ask's, in it. What they asked stays in the chat, and in "You asked before" on their page. Inside the app it's still called prep (`prepId`, `src/lib/prep.ts`, `src/components/prep-actions.tsx`, `src/components/summary-card.tsx`, `__tests__/prep.test.tsx`):
    - The card and the full summary each have two buttons, "Improve with Ask" and "Edit" ("Edit summary" on the full one).
    - Edit shows the facts from the data, which keep themselves up to date, with a box under them for the rest of the paragraph, and the goal. Only the rep's words and goal are kept, with the workspace on the phone (`prep` in `Workspace`, as `{ goal, text }`). Lines kept by an older version become one paragraph (`restorePrepEdits()`). The card, Listen and the full summary all start with the same paragraph. The full summary then has the goal, why now if the paragraph doesn't say it, the talking points it doesn't say (`pointsBesides()` in `src/lib/brief.ts`) and anything owed. Their goal becomes the next step. Clearing both goes back to the data.
    - "Improve with Ask" asks "How can I improve their summary?" in the person's own Ask. The answer is the whole Summary as it would read: the facts, then the rep's words with what matters most that they don't say yet, up to three things in all, such as why they matter now, where their patients go or who refers to them (`betterSummary()` in `src/lib/prep.ts`). "Use this summary" puts it in place of the rep's words, keeping their goal, with Undo, and goes back to the card or the full summary. Once it says those, asking again gets "already says what matters most". A promise or last time changes from one visit to the next, so it's left to the facts and the talking points.
    - With nothing planned, owed or written (`isThinPrep()`), the button says "Write a summary with Ask", and the full summary leads with it. Ask writes the paragraph the same way, and "Write my own" opens Edit.
    - Asking Ask for help with the summary isn't counted as a question about them.
  - **Reports** are answers kept with Save or by saying "save that". Once a report is removed, or its save undone, the answer can be saved again.
- **History.** Like the list of chats in a chat app. "History" at the top of Ask opens it, and so does History in the menu, under Saved (`src/app/ask/history.tsx`, `src/lib/chat.tsx`).
  - **Conversations:** what was asked in Ask, about the territory or one person, under Today, Yesterday and Earlier, newest first (`groupConversations()`). Each is titled by its first question, with how many questions and when. "New chat" at the top starts afresh.
    - "New" on Ask ends a conversation and starts another; so does the day ending. Both stay in History.
    - Tapping one opens that chat itself, on Ask or in the person's own Ask, to carry on asking (`reopenConversation()`). Whatever was going there goes to History in its place, so today's stays in the list. One from an earlier day says when it started and that its answers are as they were then.
    - The last 30 are kept on the phone under `CHATS_KEY`, written a moment after each change. A question still waiting for its answer isn't kept. Chats this version can't carry on from are copied to `CHATS_BACKUP_KEY` before it starts afresh, and chats that can't be read at all aren't written over.
  - **People you opened:** the last 10 doctors and accounts whose page was opened, once each, newest first.
  - Pressing and holding a conversation deletes it, and "Clear history" clears the lot. Each asks first. Neither touches saved reports, notes or the plan, but Saved stops showing the Summary of anyone only asked about.
  - A question is kept with the person it's about, even when asked in someone else's chat. Saved's list of people asked about only covers the last seven days.
- **Ask says when it can't help.** "Thanks", "hi" and "bye" get a short reply instead of a search, and a doctor who isn't in the data gets "I can’t find Dr. Smith in your data" rather than someone else's figures (`smallTalk()` and `unknownDoctor()` in `src/lib/ask.ts`). "What have I saved" lists the same Summaries as Saved.
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
  - The choices on the You page are kept with the workspace, but they don't count as a change: the sample is still seeded again, and keeps them. Undo leaves them, and the day shown, alone too.
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
