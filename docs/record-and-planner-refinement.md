# Visit records and Today planning

Implemented 18 October 2026. [Interactive demo](https://doggowoofwoof.github.io/AppNexus/demo/) · [Screens](../demo/screens.html).

## The record opened from Activity

The page now has one main Edit visit action and a clear order: Summary, Follow-ups, then Notes & recording. Outcome, person/account and date/time remain together at the top. Back identifies Activity or the meeting brief as appropriate.

Accepted follow-ups use the same completion/Undo controls as Activity. Suggested follow-ups are grouped and require review before becoming tasks. An explicit Review suggested follow-up entry opens that group directly. Audio playback stays with the transcript; transcript correction opens in place. Original notes are collapsed when showing them would repeat the summary. Downloads, storage information and removal are together under Record options.

Correction-save failure retains the entered text and restores the previously saved correction. Original input remains preserved. A changed transcript marks the summary as needing refresh. Edit visit opens the existing capture form with its saved note, audio and follow-up.

## Today keeps planning available

View plan and Add targets now appear regardless of whether visits are planned, completed or cancelled. The former conditional branches hid adding visits when only a cancellation remained.

Who to speak to previews two candidates using the shared Targets ranking, distance and row components. Already planned, cancelled or contacted targets for that day are excluded from automatic suggestions. The section explains when no new suggestions remain. Add targets opens the shared search, filters and List/Map discovery screen; the preview plus adds a flexible visit. Opening a person still allows preparation and timed appointment setup.

A flexible visit has Change visit → Remove from plan / Set a time. Removing it offers Undo and does not invent a timed opening. Confirmed appointment cancellation retains the existing replacement flow through Targets. Logged counts include records from unplanned visits.

## Verification

The 19 domain/storage/recording regressions pass. Browser walkthroughs verified shared Targets entry and direct quick-add from Today, the resulting flexible visit in the planner, fixed appointment cancellation with no active visits left, flexible removal/Undo, audio record editing, transcript correction/refresh and save failure, follow-up completion/Undo, suggested follow-up acceptance, and record removal/restore.

Eight screen/states were measured at 320px / 200% text, 390px Phone and 840px Wide screen. The cancelled-only Today state was additionally measured at each width, confirming View plan, Add targets and Suggested targets remain present. All 27 combinations had no measured horizontal overflow. [Measurements](record-planner-checks.json).

Actual captures: [record](screenshots/actions-conversation.jpg), [wide record](screenshots/record-detail-wide.jpg), [Today planner](screenshots/today-planner.jpg).

Services remain mocked and storage remains local to the browser. These are browser checks, not physical-device or native-client validation. This is not another ten-persona study.
