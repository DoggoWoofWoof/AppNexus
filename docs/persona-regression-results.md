# Ten-persona regression review

17 October 2026. This reruns the original five behavioral personas and adds five new ones. These are scripted scenario walkthroughs and automated regressions, **not interviews, measured rep productivity, or production certification**. The baseline findings remain in [persona-usage-audit.md](persona-usage-audit.md).

## What changed

The primary flow is now **Today → Log visit → choose the actual outcome**. Notes, voice and follow-ups are optional. A stable draft owns its visit, day, attendees and attachments. The browser acknowledges IndexedDB transactions before claiming a device save. Background mock jobs let the rep continue immediately.

Activity combines unfinished drafts, processing failures, suggested next steps, searchable conversations and accepted tasks. One conversation retains original text/audio, separate corrections and demo-generated summaries. Corrections in progress survive background redraws. Editing an outcome retains the existing manual follow-up. Rescheduling clears the old confirmation.

Preparation creates viewable fixture briefs with an actual offline file. Booking distinguishes personal holds, unsent drafts, requests and simulated office responses. Cancellation recovery uses an explicit mock driving matrix, visit duration and buffer against the next commitment. Unknown availability remains tentative. Maps retain the real geographic basemap.

## Persona results

| Persona | Scenario exercised | Observed result |
|---|---|---|
| P1 Arjun · minimum effort | Today → Log visit → Not met; refresh | Two activations, no preselected Met, no required notes. Attempted outcome persisted. Undo restored the original appointment and draft. |
| P2 Meera · interrupted/offline | Start a synthetic recording, interrupt, refresh, log while offline | Received audio portions and draft reopened with a playable source. Outcome saved while processing remained queued. Automated quota test retained unsaved bytes for download and retry. |
| P3 Kabir · new territory | Targets → HCP brief → preparation | Correct HCP/site, reason, last conversation and next step stayed together. Full profile remains a separate drill-down. HCO captures require an attendee instead of guessing. |
| P4 Riya · cancellations | Cancel the 10:00 visit, try no suitable candidates, then replace | Fallback offered call/search/leave open. Replacement used fixture travel and availability. The 14:00 commitment stayed fixed. |
| P5 Dev · evidence and group meetings | Generate/open/save a procedure brief; record a conversation linked to two HCPs | Actual fixture content and offline file created; one conversation linked to both attendees. Source input retained separately from correction/summary. Suggestions required acceptance before becoming tasks. |
| P6 Sana · bilingual/noisy conditions | Hindi/English text, simulated microphone denial, transcription failure/retry, correction/search | Typed fallback worked. Original Hindi phrase remained searchable after an English correction. No claim of real speech accuracy, noise handling or language recognition. |
| P7 Oliver · booking uncertainty | Draft → mock request → decline → new request → accept → external cancellation | Each visible state was distinct. Cancellation reopened the correct slot and kept the later appointment. Automated duplicate/stale/wrong-request events were ignored. |
| P8 Nikhil · multitasking | Separate Jordan/Sam drafts, resume and log one, edit/undo outcomes | Both drafts stayed independently resumable. Exact visit/day completion and task idempotency passed automated checks. Editing retains existing follow-up details. |
| P9 Asha · small phone/large text | New screens at 320 px/200% text, 390 px, 840 px | 26 distinct screen/size combinations fit without HTML/control overflow. Map geometry intentionally clips inside its SVG viewport. HTML-looking note text rendered literally. |
| P10 Elena · shared browser/privacy | Rep One → Rep Two, refresh, Trash/Restore | Other rep history did not appear; selected sample workspace survived refresh. Trash and restore worked. Automated atomic deletion removed linked media/tasks in one scope while retaining another rep's bytes. |

All ten scenario walkthroughs completed. The automated suite has **19 passing tests**, run with `npm test`. Tests use the real model/recording/storage modules and an IndexedDB test implementation; browser walkthroughs also exercised actual browser IndexedDB. No real microphone or customer data was used. Sample audio is a synthetic tone.

Responsive combinations: 320 px with 200% text covers Today/map, recovery, capture, Activity, conversation, Trash, saved work, preparation, booking and workspace (10). At 390 px and 840 px, Today/map, recovery, capture, Activity, conversation, preparation, booking and workspace were checked (8 each). The initial map-boundary check also counted intentionally clipped SVG path extents; the repeated check measured the SVG viewport and HTML controls. No browser console errors were observed.

## Disposition of the original gaps

| Gap | Current demo disposition | Remaining production work |
|---|---|---|
| G01 Durable capture | IndexedDB chunks, interrupted recovery, download/retry after write failure | Native process death, phone call/lock, low-memory and eviction tests. A browser can only save portions it has received. |
| G02 Identity/idempotency | Stable local conversation/draft/visit IDs, duplicate chunk/task protection, versioned mock booking events | Server idempotency, outbox reconciliation and cross-device ownership. |
| G03 Accurate evidence | Explicit outcome; preserved source; separate corrections; reviewed suggestions | Production provenance and model quality evaluation. |
| G04 Recording lifecycle | Explicit start, meeting intent, typed fallback, interruption/error states | Real OS permission/lifecycle behavior and company policy enforcement. |
| G05 Short asynchronous flow | Two-action minimal outcome, background mock jobs, truthful device/cloud distinction | Upload/processing observability and real retry policies. |
| G06 Retrieval | Search, filters, source audio, correction, retry, profile history | Authenticated remote retrieval and expiring signed links. |
| G07 Rich input | Multi-HCP links, language selection, Unicode text, file input up to 100 MB, source playback/download | Real speech/noise/long-duration/codec testing; diarization and speaker attribution remain unclaimed. |
| G08 Preparation | Actual fixture brief, generation states/retry, view/download/offline copy | Real report data, provenance, entitlements and existing document-service integration. |
| G09 Replacement | Explicit mock driving matrix, slot fit/buffer, tentative availability, booking response/cancel lifecycle | Routing/calendar/availability providers, origin verification and live feasibility. |
| G10 Scope/deletion | Company/rep local key, Trash/Restore, scoped atomic media cleanup, explicit manual retention | Authentication, tenant authorization, logout/device purge and server/object-store retention policy. |

These gaps are addressed within the requested **mock demo scope**. They are not marked production-complete. Source endpoint availability is still recorded in [plan-status-and-endpoint-audit.md](plan-status-and-endpoint-audit.md); no production endpoint has been exercised by this pass.

## Running and reviewing

`npm ci && npm test` runs regression tests. `python scripts/build-demo.py` bundles the maintained app modules into the public static demo. Serve the repository and open `/demo/`.

The external demo guide provides offline, permission denial, storage full, transcription/report failure, booking decline and no-candidate scenarios. These controls are outside the product navigation. Local data stays until the user resets the sample workspace or deletes a conversation; Trash has no automatic expiry in this demo. Embedded opaque-origin previews explicitly use temporary memory, while the published `/demo/` uses durable browser storage.
