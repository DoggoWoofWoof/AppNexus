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
| Find a past visit by person, date or words | Transcripts only | Notes, in Activity | Not yet | One search over notes and transcripts, in Activity. |
| Play back audio | Yes | No | No | Later, inside the visit record. |
| Delete | Yes | Yes, with Undo | Not yet | Undo toast. No Trash tab. How long audio is kept is a backend policy. |
| Draft survives closing the app | Partly | Yes | Yes | Keep. |
| Offline queue with "saved" and "sent" | No | No | No | Needed before recording ships. |
| Several attendees in one record | Yes | Sample data only | No | Later. |

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

## Still missing, in order

**Before reps rely on it**

- An end-of-day nudge for visits whose time has passed and aren't logged yet, so Ravi logs in one sitting instead of being chased.
- An offline queue that shows "Saved on this phone" and then "Sent", per record.

**With the backend**

- Meeting recording with consent, then transcript, summary and suggested follow-ups, all inside the visit record.
- Real availability and booking with schedulers, and driving time instead of straight-line distance.
- Several attendees on one record, with statements and follow-ups tied to the right person.
- A shareable leave-behind (PDF) from the prep card.
- A retention and deletion policy covering audio, transcripts and generated text.

## Scenarios to test with real reps

Include at least one "does the minimum" rep and one who works with poor signal.

1. Log a visit without a note, and check the rep has to say what happened.
2. Speak a note after a visit without re-entering the doctor or date.
3. Close the app mid-note, reopen it and carry on.
4. Cancel a visit, fill the slot from Targets, and check the next booked appointment hasn't moved.
5. Prepare for a doctor the rep has never met, using only the profile.
6. Find last month's visit by a word from the note.
