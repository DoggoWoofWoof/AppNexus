# Sales-rep personas and usage audit

17 October 2026 · Baseline: demo commit `5de664d`; Insights source `53c2540fba8aaa104f8c79a2a1c2f8c3c414b8db`.

The major recording/transcript capabilities are mapped. The complete mobile recording lifecycle is **not implemented or fully specified**. The demo has interactive text notes and follow-ups, but Record/Upload and the transcript-library destination remain previews. Existing upstream code is a foundation, not proof of a working mobile integration.

These five fictional behavioral personas and their usage patterns are hypotheses for a task walkthrough, not interviews, measured adoption or production usage analytics. The same rep may behave like several personas on different days. The method is informed by [NN/g's cognitive-walkthrough questions](https://www.nngroup.com/articles/cognitive-walkthroughs/): would someone identify the next step, find it, understand it and recognize progress? [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) informs the recommendation to defer infrequent detail. The product findings below come from the prototype and source inspection.

## Five personas

| Persona | Situation and job | Current friction / likely failure | Required refinement |
|---|---|---|---|
| P1 · Arjun, the minimum-effort relationship rep | Knows his doctors; wants to record an outcome or a short memo and move on. Low appetite for typing and administration. | Today → Prepare → Log visit is a detour. Quick note versus Insight asks him to understand the product. Record stops at a preview. The current default outcome is Met, so saving an empty note can incorrectly complete a visit. | Direct Log visit from the appointment. Explicit one-tap outcome; optional typed note or voice memo. Prefill known visit context and save durably before analysis. |
| P2 · Meera, the interrupted/offline field rep | Works across weak connections. A phone call, app switch or screen lock can interrupt capture. | Prototype drafts vanish on reload. Upstream recording's durable snapshot occurs on Upload; stopping a recording is not itself established as durable storage. A recovery banner is too late if the audio never reached that snapshot. | Persist audio during capture and immediately on stop; make saved/unsaved status truthful; recover partial audio and retry the same operation without duplication. |
| P3 · Kabir, the new territory rep | Needs to identify the correct doctor, practice and reason for visiting without knowing the account structure. | The compact brief helps, but account → person attribution remains important. A generic Capture requires finding the person again. Full profile sections and lists can pull him away from the immediate job. | Carry the exact visit, HCP and site through prep/capture. Confirm identity once, then reuse it. Keep the brief first and the named full profile available one level down. |
| P4 · Riya, the cancellation-heavy planner | Has fixed commitments and needs a useful replacement in an opened slot quickly. | Replacement flow preserves commitments, but proximity is only straight-line and availability is unknown. Use this slot creates a plan, not a booking. An unsent request cannot solve an urgent availability problem. | Verified travel + slot fit + availability/contact action, with reasons. Offer up to three candidates, call instead or leave open. Preserve booking and confirmation provenance. |
| P5 · Dev, the evidence-led specialist | Prepares account evidence and records longer or multi-HCP discussions; later needs the exact statement and supporting source. | Prep materials are checklists, not generated reports. Transcript playback/search/editing exist upstream but are not rendered in the mobile concept. A single-person quick note cannot represent a group conversation reliably. | One conversation with linked attendees, source audio, original/corrected transcript and reviewed summary/actions. Attach an existing or generated report to the visit; do not duplicate records per tab. |

The minimum-effort persona is a design constraint, not a judgment about motivation. Capture should remain useful even when the rep adds only an accurate outcome. Recording every meeting or completing rich analysis must not become the price of logging a visit.

## Task walkthrough

The following counts are control activations derived from the current prototype paths, not timed user tests. Typing, scrolling, OS permission prompts and first-time sign-in are excluded. Proposed counts are design targets, not implemented improvements.

| Task | Current path and outcome | Recommended path / target |
|---|---|---|
| Record a minimal outcome | Today → Prepare → Log visit → Save to preview: 3 activations, but Met is preselected and notes are optional | Today → Log visit → explicit outcome: target 2 activations, with a reversible confirmation. Never assume the visit happened. |
| Start a post-visit voice memo | Today → Prepare → Log visit → Record: 3 activations to a nonfunctional preview; no recorder starts | Today → Log visit → Record voice memo: target 2 activations to start, then Stop & save. Carry HCP/date/site/visit automatically. |
| Record a live meeting | Same generic Record preview; no separate meeting-recording intent or live capture lifecycle | Start from the meeting/prep context with an explicit user action and the applicable recording permission/policy state. Show recording and interruption status; provide a note fallback. |
| Replace a cancelled visit | Appointment changed? → Doctor cancelled → Use this slot: 3 activations for a tentative replacement | Keep this short path, but establish road feasibility and availability. A replacement plan stays tentative until confirmed. |
| Choose evidence for a meeting | Today → Prepare → Add report or insight → choose material: 3 activations; item is not generated | Prefer an existing relevant document in Prep. One action attaches it. Generate a missing item in the background; retain visit context and real job status. |
| Retrieve a past recording/transcript | Activity → Transcripts & recordings: 2 activations to a generic destination preview | Activity → search/filter a recent conversation → open one detail. Summary/actions first; transcript/audio accessible without choosing another product. |
| Resume after interruption | In-page text draft can resume; page reload loses demo work. Upstream has recording/typed-draft recovery code with different scopes | Reopen the exact visit/draft after app termination. Do not require remembering which input mode or storage system held it. |

## Recording and transcript coverage

The machine-readable companion is [capture-transcript-coverage.json](capture-transcript-coverage.json). It distinguishes source evidence, current prototype and remaining work per capability.

| Capability | Mapping | Existing source | Current mobile concept / remaining gap |
|---|---|---|---|
| Type a quick note or insight | IN01 / FP09 / HP09 → S17 | `AddInsightSheet.tsx`; provider Notes services are a separate path | Text works in memory. One capture entry should hide the storage distinction. |
| Record audio | IN01 → S17 | `AddInsightSheet.tsx:1016`: microphone request, MediaRecorder, stop, segments and interruption handling | Preview only. Distinguish a rep's voice memo from recording other meeting participants. Native lifecycle remains unverified. |
| Persist/recover audio drafts | IN02 → S17/S20 | `draftStorage.ts`: durable audio bytes, ownership, rebuild/download; snapshot invoked in recording submit at `AddInsightSheet.tsx:1351` | No durable mobile recording. Checkpoint before submit; handle interrupted capture, storage failure and app termination. |
| Typed draft autosave | IN02 → S17/S20 | `AddInsightSheet.tsx:1581`; `draftStorage.ts` typed store | Existing web store has one typed slot per user. New app needs stable draft/visit identity so different visits do not overwrite each other. |
| Upload and remote file storage | IN01/IN02 → S17/S20 | `POST /api/upload`, `/presign`, `/complete`; Transcript file references and S3 service | No mobile upload. Show device save separately from remote acknowledgement. File-source upload and recording recovery must both work. |
| Transcription and insight processing | IN02 → S25/S18 | Transcript status fields; upload processing; retry routes | No processing integration. Leave capture after durable acknowledgement; do not wait for a sentiment result to continue the day. |
| List, find and reopen transcripts | IN03 → S16/S18 | `GET /api/transcripts`, `/search`, `/by-hcp/:npi`, `/:id` | Library is a preview. Search by HCP/date/content and open the same conversation from Activity or profile history. |
| Audio playback, seek and download | IN03 → S18 | `GET /api/transcripts/:id/audio-url`; `TranscriptDetail.tsx` audio controls | Not built in the concept. Signed-link expiry and unavailable audio need recoverable states. |
| Original and corrected transcript | IN03 → S18 | Transcript model raw/edited fields; `PUT /api/transcripts/:id` | Only text-note review is interactive. Keep original input separate from user corrections and generated content. |
| Summary, insights, tags, attendees | IN03/IN04 → S18 | Summary route/model; transcript update; detail UI | Not rendered as a usable mobile conversation detail. Defer advanced tags unless required for the selected company/workflow. |
| Speaker/time segments | IN03 → S18 | Optional tagged-segment schema contains speaker/timestamp; gated tagged-view generation | This is not certification of reliable diarization or word-synchronized playback. Unknown speakers must remain unknown; validate supported languages and speaker attribution. |
| Suggested actions → actual follow-up | IN07/IN11 → S18/S19 | Existing tasks/target-list follow-ups and transcript action data | Local follow-ups work. AI suggestions need review before becoming commitments; link the accepted task to the exact source/visit. |
| Company/team access and personal notes | IN12/AD03 → S18/S37 | Transcript routes use organization/team isolation; list route includes source-specific personal-note rules | Demo has no auth. Do not treat all conversations as automatically team-visible or infer uniform tenant behavior. |
| Delete and retention | IN03/IN12 → S18/S37 | `DELETE /api/transcripts/:id` removes a database record in the reviewed handler | End-to-end audio/blob cleanup, retention and recovery policy are not established by that handler. Define what deletion covers before presenting one universal Delete action. |

These are source-level findings only. No real microphone, recording, transcript, authenticated service write or customer data was used in this audit.

Useful foundations already exist: MIME/codec fallback, microphone-interruption handling, recording-byte recovery after submission, a stable recording draft ID for multipart retries, typed-draft autosave, searchable transcript records and signed audio retrieval. Reuse and validate those adapters rather than rebuilding their behavior from scratch. Native durability before submission and the complete mobile experience remain separate work.

## What is too complex

1. **Input mode and product taxonomy are mixed.** Quick note, Insight, Record and Upload put two meanings on the same control row. Use Note / Voice memo / Meeting recording / Add file as input intentions, with the right context and permissions. The rep should not choose Dynamo versus Insights storage.
2. **Saving and analyzing are coupled in the reviewed web flow.** Recording submission polls for a transcript and sentiment up to 60 times at three-second intervals before routing away. Remote file acknowledgement should free the rep to continue; analysis can complete later in Activity.
3. **Metadata arrives too early.** The upstream upload form validates HCP/date and company-specific requirements. Carry known values from the visit, let missing fields remain a clearly incomplete durable draft, and ask only for the fields required to send that capture. Rich tags and research classification should not obstruct saving original evidence.
4. **Transcript tools risk becoming a second app.** Keep Activity as the recent-work home and one conversation detail with summary, actions, transcript and audio. Named advanced tools still exist in Insights; they do not need to appear on every capture screen.
5. **The demo can record success without an explicit outcome.** Preselecting Met reduces effort by assuming a business fact. Replace that default with an explicit outcome choice; low effort must not create false activity data.

## What is missing or insufficiently proven

| ID | Priority | Gap | Done means |
|---|---|---|---|
| G01 | P0 | Durable recording before Upload, including app termination and interrupted capture | Partial/stopped audio and exact context recover after process death; a failed local write is not labelled saved. |
| G02 | P0 | Unified visit/conversation/draft identity across current stores | Retry creates one remote conversation; the correct attendees/site/visit remain linked; different visits retain different drafts. |
| G03 | P0 | Explicit outcome and safe original/generated distinctions | No default Met; original audio/transcript retained; corrections identifiable; generated actions remain suggestions until accepted. |
| G04 | P0 | Native microphone/permission/interruption and company-policy states | Permission denial has a note fallback; recording starts explicitly; a phone call or lock has an accurate status and recoverable result. |
| G05 | P1 | Short capture entry and background completion | Target low-effort paths above; no forced wait for transcription/insights; save/upload/analysis/CRM are distinguishable. |
| G06 | P1 | Usable transcript library/detail | Find by person/date/content; play available audio; distinguish original/corrected text; recover expired links and failed processing. |
| G07 | P1 | Rich capture across people, languages and devices | Correct multi-HCP attribution and supported language handling; validate noisy speech, short memos, long meetings, codec and storage limits. No automatic speaker identity claim. |
| G08 | P1 | Preparation material actually ready for a meeting | Existing report attach or real generation job; source/updated time visible; offline-ready only after a verified download. |
| G09 | P1 | Availability and road-feasible cancellation recovery | Respect next commitment and duration/buffer; unknown availability remains tentative; rejection and cancellation do not silently move other bookings. |
| G10 | Before release | Ownership, retention and deletion across audio/text/generated copies | The authorized user understands scope; verify storage cleanup and access after deletion, logout, account switch and tenant changes. |

P0 means required for trustworthy capture, not proof of a current production incident. P1 means required to make the main workflow usable; advanced analytics can follow. Gap priority is this design audit's recommendation.

## Recommended common flow

**Today → appointment → Log visit → explicit outcome + optional note/voice → durable save → continue day.** Processing finishes in Activity. The detail opens with a concise summary and next steps; full transcript and source audio remain accessible. An optional live-meeting recording starts from Prep before the meeting and uses the same eventual conversation detail.

Prefill verified HCP/site, local date, rep and exact visit ID; keep these editable. Ask for an ambiguous attendee or missing site instead of guessing. Keep the user-facing next action clear while adapters retain source-specific records and permissions. Do not blindly dual-write a quick note and an Insights transcript as two independent authoritative conversations.

Offer an end-of-day **Finish remaining work** list containing only incomplete captures, failed uploads and unaccepted follow-up suggestions. Avoid a second mandatory reporting exercise or repeated reminders for work already saved.

## Validation with real reps

Use these as scenario tests with recruited reps; findings here are not results of such tests. Include a minimum-effort rep and someone who routinely works with poor connectivity. Measure completion, backtracking, repeated input, loss/recovery and confidence in save status. Tap counts and time targets should be validated in those sessions, not converted into fabricated success percentages.

1. Log an outcome without notes; check that the rep must choose the actual outcome.
2. Save a short voice memo from the scheduled visit without re-entering the doctor/date.
3. Stop recording, terminate the app before upload, reopen and recover it.
4. Interrupt a longer recording with a call/lock; recover captured portions and identify the gap.
5. Go offline, reconnect and retry after a timeout; confirm one conversation and one follow-up.
6. Switch between two visits/drafts; verify that neither content nor attendee context is replaced.
7. Cancel a visit, inspect an alternative, replace it and keep the next fixed booking unchanged.
8. Find last month's conversation by a phrase, correct a name and return to the original source.
9. Record a group discussion and confirm which attendee a statement/action belongs to.
10. Prepare a report, lose connectivity, and distinguish selected, generated and downloaded material.
11. Review an AI-suggested follow-up/date; confirm it is not already sent or promised.
12. Switch user/company or delete a conversation; validate access and the defined audio/text retention behavior.

Suggested instrumentation for implementation: capture opened/started/stopped, local save acknowledged/failed, upload acknowledged/failed, processing completed/failed, transcript opened, correction saved, follow-up accepted/completed and recovery succeeded. Use stable opaque IDs and coarse interaction events; do not log audio, transcript text or note contents into analytics. Instrumentation is proposed and not installed by this audit.
