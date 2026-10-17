# Shared Targets and visit records

Implemented 18 October 2026. Supersedes the separate recovery screen, extra Open map button, and Recent / With audio / Trash controls from the preceding action-placement pass. [Review the actual screens](../demo/screens.html).

## Simplified flow

**Today → Doctor cancelled → Targets → Replace → Today.**

Cancellation directly opens the existing Targets screen with the exact visit, freed time, next commitment, Undo and Leave time open. Search, People/Accounts, List/Map, suggested/distance ordering, radius and origin all use shared discovery code. Opening a profile and returning preserves the replacement context. The primary navigation returns to normal discovery; the unresolved opening remains accessible from Today.

Automatic suggestions exclude scheduled, completed and cancelled targets for that day and require the mocked travel-window check to pass. A chosen replacement remains a personal hold until confirmed. No separate candidate list or visit/call discovery modes remain. Phone call is a meeting type in appointment setup; calls do not create physical route stops.

The Today map opens through its existing title/arrow and facility pins. The additional labelled Open map button is removed.

## Activity is a visit ledger

- Open follow-ups and meaningful unfinished work appear when present. Merely opening an empty capture form does not add a Needs attention entry.
- Visit history groups records by meeting date. Each entry shows person/account, scheduled time when available, actual outcome, and an audio indicator only when a recording exists.
- Notes, original audio, original/corrected transcripts, summaries and linked follow-ups belong to that visit record. Search covers names, accounts, dates and note/transcript content.
- Cancelled appointments also appear in history. Expanding one shows its replacement or open-slot status; unresolved openings link back to Targets.
- Deleted records, completed follow-ups and device storage are secondary Record options. Restoring a record restores access to its retained notes, media and linked follow-ups. Main Activity navigation always returns to the ordinary ledger.
- Profile Visit history scopes the ledger to that person/account and provides All visit records to clear the scope.

## Verification and limits

The 19 automated domain/storage/recording regressions pass. Browser walkthroughs covered cancellation → Targets, shared search and radius filtering in List/Map, brief/back context, direct replacement, Undo, no suitable matches, leaving time open, visit recording with a sample tone, record search, deletion/restore, cancelled-appointment history, and meeting-type route exclusion. Replacing Maya's 10:00 visit with Sam produced a 10:20 personal hold while Jordan's confirmed 14:00 appointment stayed fixed.

Fourteen screen/states were checked at each of 320px with 200% text, 390px Phone, and 840px Wide screen: 42 distinct combinations, with no measured horizontal overflow. A separate visual check corrected a wrapped Replace label and verified the final buttons at 320px / 200%. [Check summary](unified-flow-checks.json).

Services remain mocked. Distance is explicitly approximate straight-line distance from a selected sample site; travel windows use a demo driving matrix. No live GPS, routing, availability, booking, transcription, CRM or cloud-backup integration is claimed. The capture demonstration used a generated tone, not microphone access. Physical-device and native-client validation remain integration work. This pass is not a new ten-persona study.
