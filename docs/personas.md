# Rep personas and usage check

Five fictional reps, walked through the demo on `clean-rebuild`. They are design hypotheses, not interviews or usage analytics, and one real rep can be several of them in the same week. The point is to find where the app asks too much, or where it can't do the job at all.

The rule they add up to: **logging a visit must stay useful when the rep does the minimum.** One honest outcome is a good record. Recording, transcripts and analysis are extras, never the price of logging.

## The five

| Rep | Their week | What they need | Where the demo let them down |
| --- | --- | --- | --- |
| **Ravi**, does the minimum | Eight years in the territory, knows every doctor, seven to nine visits a day. Logs when chased. | Log a visit in a couple of taps from Today. Talk instead of type. Never re-enter who or when. | Outcome defaulted to **Met**, so saving an empty sheet recorded a meeting that may not have happened. Voice existed in Ask but not in Log visit. |
| **Leila**, plans around fixed appointments | Most visits are booked with schedulers. Cancellations are common. | When a doctor cancels, put someone nearby in that slot within a minute, and keep every other appointment where it is. | There were two ways to fill a slot (a ranked sheet and Targets) and they could disagree. Distance is straight-line and availability is unknown. |
| **Tomás**, new to the territory | Three weeks in. Doesn't know who refers to whom or which site a doctor is at on a Tuesday. | Who is this, why now, what to say, where to go. In one place. | **Prepare** opened a separate brief screen that repeated the profile Overview, so there were two places to look. |
| **Nadia**, evidence-led specialist | Long meetings with several clinicians at an account. Wants the exact words and the agreed actions. | Record the meeting (with consent), then get a transcript, a short summary and suggested follow-ups. Find it again by a phrase. | Nothing in the app does this yet. Notes are typed, about one person, and "with" is free text. |
| **Ben**, patchy signal | Hospital basements and rural sites. Calls interrupt him mid-note. | Never lose what he captured, and know whether it is saved on the phone or sent. | Typed drafts are kept on the device, which works. Nothing syncs yet, so there is no "sent" state, and audio would have to be saved while recording, not on upload. |

## Recording and transcripts: what exists, and where

"Web platform" is the DocNexus web product the app sits beside.

| Capability | Web platform | Demo | App | Decision |
| --- | --- | --- | --- | --- |
| Typed note with outcome | Yes | Yes | Yes | Keep. The outcome is chosen, never assumed. |
| Speak a note (speech to text) | No | Ask only, until this pass | No | Add to **Log visit**, reusing Ask's voice input. |
| Record meeting audio | Upload of recordings | No | No | Later. Needs native recording, a consent step and background upload. |
| Transcript, original and corrected | Yes | No | No | Later, with recording. Keep the original next to any correction. |
| Summary and suggested follow-ups | Yes | No | No | Later. A suggestion becomes a follow-up only when the rep accepts it. |
| Find a past visit by person, date or words | Transcripts only | Notes, in Activity | Notes, in Activity | One search over notes and transcripts, in Activity. |
| Play back audio | Yes | No | No | Later, inside the visit record. |
| Delete | Yes | Yes, with Undo | Not yet | Undo toast. No Trash tab. How long audio is kept is a backend policy. |
| Draft survives closing the app | Partly | Yes | In Log visit | Keep. |
| Offline queue with "saved" and "sent" | No | No | Saved on the phone, nothing sent yet | Needed before recording ships. |
| Several attendees in one record | Yes | Sample data only | Who was there, at an account | Later: who said what, and follow-ups per person. |

## How records are kept

**One record per visit.** Everything about a visit hangs off it: the outcome, the note (typed or spoken), the recording and transcript when there is one, the summary, and the follow-ups it created.

- **Activity** lists those records by date. A mic mark shows when a note was spoken or recorded. Search covers names, outcomes and the words in notes and transcripts.
- **A profile's Activity tab** shows the same records for one person or account.
- There are **no Recent / With audio / Trash tabs**. They split one history three ways. Search replaces the filters, and Undo replaces Trash.

## Tap counts

Counted from the demo, excluding typing and scrolling. They are targets to check with real reps, not timings.

| Task | Before this pass | After |
| --- | --- | --- |
| Log a visit, outcome only | Today → Log visit → Save: 2, with Met assumed | Today → Log visit → outcome → Save: 3, nothing assumed |
| Log a visit with a spoken note | Not possible | Log visit → mic → speak → outcome → Save |
| Doctor cancels; fill the slot | ⋯ → Cancel → reason → fill sheet → Add, or a second route through Targets | ⋯ → Cancel → reason → **Targets**, nearest first → **+**. Back on Today with the slot filled. |
| Prepare for the next visit | Prepare → separate brief screen | Prepare → profile, with the prep card first |
| Book a visit | Profile → Book → slot → Request | Same |

## What was too complex

1. **Two lists for a free slot.** The fill sheet ranked people one way and Targets another. Now there is one: Targets, sorted nearest to the cancelled site, with planned people hidden.
2. **A separate brief screen.** The goal, talking points and follow-ups now sit at the top of the profile Overview, above the numbers they come from.
3. **A crowded Today.** The Ask bar duplicated the Ask tab, and the weekly stats weren't something a rep acts on in the moment. The Ask bar is gone and the stats moved to Insights as **Your coverage**. The route map stays: it is the quickest way to see the day.
4. **Outcome as a dropdown with a default.** It is now four buttons, and none is pressed until the rep chooses.

## Second check: ten reps on the app

On 19 October 2026 ten fictional reps reviewed the Expo app in `mobile/`, looking for where it fails them: the five above, plus **Gloria** (new to smartphones, large text), **Omar** (compliance), **Jess** (plans tomorrow tonight), **Danielle** (drives all day, voice first) and **Kwame** (key accounts, meetings with several people). Each finding was checked against the code before anything changed.

| Raised by | What changed |
| --- | --- |
| Ravi | A visit whose time has passed and isn't logged says "Not logged yet" on Today, with a Log button on the row. The note is marked optional. |
| Gloria, Ravi, Leila | "Can't make it" asks first: move it, cancel it, or keep it. A cancelled visit shows "Put it back at 14:00". Cancelling a visit whose time has passed no longer offers the slot. |
| Leila | A visit waiting for a reply says how it was booked, with a "They confirmed" button. |
| Tomás | Each stop on Today says why they're worth seeing. |
| Jess | An empty day offers "Pick 5 for me". Activity has Done on each follow-up, rows that open the person, and a search over every note. |
| Gloria, Jess | A "follow-ups due" bar on Today opens Activity. |
| Danielle | Ask, Call, Directions and Listen sit under the big buttons on every page. |
| Kwame, Nadia | An account lists the people to meet, with a call button each. Logging a meeting there asks who was there, and "Last time" names them. |
| Omar, Nadia | The note box says to keep patient details out. Copied prep and reports end with when they were made and "For internal use". |
| Ben, Omar | The plan, notes, follow-ups and Saved are kept on the phone and loaded on launch. A note closed half-written in the log sheet comes back for that person and visit. Toasts say "saved on this phone", and notes say "On this phone · not sent yet". |
| Nadia | Figures say which months they cover: "Sample data, Oct 2025 to Sep 2026" on Ask answers, prep, saved reports, copied text, someone's page, Volumes and Insights. Answers about notes and the plan say "Sample data". |
| Kwame | Insights and Ask rank accounts by patients lost, with the share next to it. An account's page shows patients leaving as a number and lists who sends patients out. |
| Tomás, Gloria | "Leakage risk" is now "Patients going elsewhere" and "Rising volume" is "Busier than last year". Where patients go says "Same health system" and "Outside the system". On someone's page each tag has a line saying what it means. |
| Jess | One "Edit" on Today shows arrows to move an "Any time" stop between the fixed visits, "Set a time" (offering their usual times that day) and "Remove". The arrows move a stop back, and the other two have Undo. On Targets, "Select" picks several people and one button adds them all, with one toast and Undo. |
| Leila | A free slot is offered only to people on site that day and usually seeing people then. Everyone else's row says when they are, e.g. "Usually Tue/Thu 07:30–08:30". Each cancel keeps its own slot, so a second one doesn't hide the first, and Targets lists the others as "Also free". |
| Ravi | A reminder at 17:30 on the phone says how many of today's visits are still not logged, and a tap opens Today, which flags them. 15 minutes before each visit with a fixed time, a heads-up says who and when, with the goal or what was promised; a tap opens their page. The reminders follow the plan, and the app asks once before sending any. |

Some findings were wrong when checked against the code: "+ Add" and Save already show a toast with Undo, "Can't make it" only opens Targets when a slot is freed, and the menu is on Today, Targets and Ask.

## Third check: the same ten, on reminders, You, the week and the phone frame

On 20 October 2026 the same ten reps went over what had been added since: reminders, the You page, "Summarise my week", editing the day, keeping work on the phone, clearer figures and the phone and iPad frame. Every finding below was checked against the code, and each one held up.

| Raised by | What was wrong | What changed |
| --- | --- | --- |
| Ravi, Jess, Ben, Danielle, Leila, Gloria | Left open overnight, the app stayed on yesterday. | At midnight, and whenever the app comes back to the front, it moves on to the new day as a fresh launch would, keeping the rep's work. |
| Leila, Jess, Danielle, Gloria | Reminders only covered today, so a visit planned tonight for tomorrow got none. | Reminders cover today and the next working day. |
| Ravi, Jess | "Any time" stops were never flagged as not logged, so a day built with "Pick 5" never was. | From 17:30 an "Any time" stop still open says "Not logged yet", and the 17:30 reminder counts it. Today checks the time every minute. |
| Ravi | A visit from an earlier day couldn't be logged against the plan. | A bar on Today lists visits from the last seven days that were never logged, each with Log (dated that day) and "Didn't happen". |
| Jess | "Tomorrow" on a Friday was Saturday. | Today switches to the next working day: "Tomorrow", or "Monday" on a Friday. Reminders, Targets, Saved and Ask say the same. |
| Jess, Tomás | "Pick 5" ignored the weekday, and could pick people already seen today for tomorrow. | Suggestions are people who work that weekday, and anyone planned or seen today waits for another day. Distances and directions use where they are that day. |
| Leila, Ben, Gloria, Omar | Edit put a red Remove on booked visits and cancelled ones, and stayed on after switching tabs. | In Edit a visit with a time offers "Can't make it" (move or cancel), since someone is expecting the rep. Only an "Any time" stop can be removed. Edit closes when the rep leaves the screen. |
| Leila | Moving a visit lost its time without a word, a freed time stayed up after it had gone, and a freed time could be filled twice. | A moved visit's old time is offered like a cancelled one ("14:00 is free. The visit with Dr. Lee moved."). Freed times leave Today once they've gone or someone else is in them, and filling one says why it can't when it can't. |
| Kwame | A meeting at an account left the doctors who were there still planned. "Who was there" missed some of them. | Logging a meeting marks done the visits of the doctors ticked as there. The list puts doctors planned there today first. A note of the same kind on the same day logs a planned visit too, but a call doesn't stand for a visit. |
| Ravi, Kwame | "Not in" looked the same as a visit done. | Today and someone's page say "Not in", and the week counts it on its own. |
| Nadia, Ravi, Omar, Kwame, Jess | The week counted a moved visit twice, counted cancelled and later-today visits as missed, and said "Dr. Rossi cancelled", blaming the doctor. Next week's picks couldn't be opened, and Listen and the saved copy skipped rows. | "2 of 3 visits logged": only visits due so far count. "Dr. Rossi: visit cancelled (Fri)". A move shows where the visit is counted ("Thu, moved from Wed"). Each pick for next week is its own row that opens the person, with when they're usually free. Listen and the saved copy read every row. |
| Ben | A half-written note for a visit that later moved was thrown away. An old save was wiped with no copy. A failed write was never tried again. | The note stays, as a draft for the person. An old save is copied aside before the sample starts again, and the rep is told. A failed write is tried again with the next change. "Last time" says when a note is only on this phone. |
| Omar | A reminder showed the goal or follow-up the rep typed, which could name a patient, on a locked phone. Android could back the data up to the cloud. | Reminders say only who, when and where: "Dr. Maya Patel at 10:00 · Mount Sinai Hospital", then "Something you promised is due" or "Not confirmed yet". Android shows them as private on the lock screen, and the app turns off Android backup. Follow-up boxes say to keep patient details out. |
| Danielle, Gloria, Leila | One "Not now", or a tap outside the question, turned reminders off for good, with nowhere to turn them back on. | You has a Reminders row: all, "17:30 only" or off. Only a real answer counts, and turning them on asks the phone again or opens Settings. |
| Nadia | "12 mo" and "YoY" were still on someone's page, the year compared with was never named, and Dr. Patel's insight said 18% where her figure is 17%. | "12 months" and "on last year", with the year named where figures are compared ("Compared with Oct 2024 to Sep 2025"). The insight says 17%. |
| Tomás | "Leakage", "code group" and CPT codes were still outside "All details". | Plain words: "Patients leaving", "See where they go", "None in this sample", and no codes in Ask. |
| Tomás | Dr. Patel was planned at Mount Sinai West on a Tuesday, when she works at Mount Sinai Hospital. | The sample puts her and Dr. Morgan where they are that day. |
| Gloria | The Ask button covered the bottom of Ask's text box and the "Add" bar in Targets. The question chips were small. Choices on You wrapped at large text. A long answer opened at its end. | Both have room for the button. The chips' touch area is 44pt. Choices stack at large text. A new answer opens at its start. |
| Kwame | A real iPad got the phone frame, and the map was small. | A touch screen gets the app itself, full screen. Today's map grows with the screen and says where the route starts and that lines are straight, not roads. |
| Danielle | Reminders and Today's rows didn't say where, Android's Directions dropped a pin instead of a route, Listen on someone's page said the promise twice, and "Read my report for this week" opened Saved. | The site is on reminders and on each row. Directions on Android opens Google Maps with the route. Listen says the promise once, and the question opens the week. |

Left as they are, on purpose: a tap on the 17:30 reminder opens Today, which flags every visit still to log, rather than one person's log; and someone's page keeps "Log visit" as its big button before the visit, with Directions and Call just under it.

## Still missing, in order

**Before reps rely on it**

- Send what's on the phone when there's signal, and mark each record "Sent". Until there's a server, notes say "On this phone · not sent yet" (Ben, Omar).
- Speech to text on the phone. Listening only works in a browser for now, so on a phone the rep types (Danielle).
- Delete or correct a note the rep wrote, with a reason kept (Omar).

**Decisions before showing it outside the team**

- The sample uses real Mount Sinai facility names with fictional people. A fictional health system would remove any doubt (Omar).
- Sample NPIs should be numbers that can't belong to anyone, by failing the real check digit (Omar).

**Planning and trust, on the sample data**

- Dates and plain words on the full profile behind "All details" too: its Network figures still say "12 mo", and it still uses "Leakage", "In system" and "Out of system" (Nadia, Tomás).
- The main and dev previews share the browser's storage, so work done in one shows in the other.


**With the backend**

- Meeting recording with consent, then transcript, summary and suggested follow-ups, all inside the visit record.
- Real availability and booking with schedulers, and driving time instead of straight-line distance.
- Statements and follow-ups tied to the right person when several were in the room.
- A shareable leave-behind (PDF) from the prep card.
- A retention and deletion policy covering audio, transcripts and generated text.
- Say where each figure comes from and when it was last refreshed, from the real data source (Nadia).
- Referrals split by site, so "Who sends patients out" counts only what a doctor sent from that account.

## Scenarios to test with real reps

Include at least one "does the minimum" rep and one who works with poor signal.

1. Log a visit without a note, and check the rep has to say what happened.
2. Speak a note after a visit without re-entering the doctor or date.
3. Close the app mid-note, reopen it and carry on.
4. Cancel a visit, fill the slot from Targets, and check the next booked appointment hasn't moved.
5. Prepare for a doctor the rep has never met, using only the profile.
6. Find last month's visit by a word from the note.
