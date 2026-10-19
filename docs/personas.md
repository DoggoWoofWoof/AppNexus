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

## Still missing, in order

**Before reps rely on it**

- Send what's on the phone when there's signal, and mark each record "Sent". Until there's a server, notes say "On this phone · not sent yet" (Ben, Omar).
- Speech to text on the phone. Listening only works in a browser for now, so on a phone the rep types (Danielle).

**Planning and trust, on the sample data**

- Dates and plain words on the full profile behind "All details" too: its Network figures still say "12 mo", and it still uses "Leakage", "In system" and "Out of system" (Nadia, Tomás).

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
