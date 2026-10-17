# Actions and cancellation recovery

Implemented 18 October 2026. [Review the actual screens](../demo/screens.html) or [open the interactive demo](https://doggowoofwoof.github.io/AppNexus/demo/).

Frequent actions have visible button boundaries. Preparation and capture are separate sections, and the four main tabs stay available throughout.

| Screen | Action placement |
| --- | --- |
| Today | Prepare visit is primary. Cancel or reschedule expands two explicit choices. Log visit has an outlined button in Notes, audio & outcome. Edit day, Add visit and Open map are outlined. |
| HCP / meeting prep | Edit time sits with the appointment time. Full profile and Conversation history are visible. Add report or insight is an outlined expandable control. Log visit follows the preparation content. |
| Appointment | The request/save actions follow the form. Confirmed appointments, personal holds and mock requests remain distinct. |
| Capture | Optional note, recording and attachments precede Save visit as. Selecting an outcome saves the visit; no extra Save step or assumed outcome. |
| Activity / conversation | Log a visit and Saved work are visible at the top. Conversation entries have boundaries and arrows. Summary and reviewed actions precede original audio/transcript and editing. |
| Recovery | Cancelled person/time and Undo come first. Leave time open and Search other targets appear before suggestions. Each candidate offers Plan this visit/call and View brief. |
| Targets / map | List and Map share the discovery context. Open brief and Add to day stay with the selected target. |
| Insights | Three frequent destinations are outlined button rows. Specialist tools have a labelled expandable control. |

## Cancellation path

1. Today → **Cancel or reschedule** → **Doctor cancelled** marks that exact visit cancelled and opens **Fill the opening**.
2. The screen identifies the freed time, next fixed appointment and Undo. Nearby visits and phone calls are separate choices.
3. Suggestions show the reason, mock travel, proposed start/duration and availability status. Already scheduled, completed or cancelled targets for that day are excluded from automatic suggestions.
4. **View brief** preserves the opening context and provides **Plan this replacement**. Planning returns to Today with the selected person/time and a confirmation-needed message.
5. **Leave time open** resolves the recovery prompt without adding a replacement. **Undo cancellation** restores the original visit while the opening is unresolved.

**Reschedule appointment** opens the existing appointment editor directly; it does not automatically cancel or move the visit to tomorrow. Changing a time clears the existing confirmation.

## Verification

- 12 screen/states checked at each of 320px / 200% text, 390px / Phone, and 840px / Wide screen: Today, brief, appointment, capture, targets list, targets map, Activity, Insights, expanded specialist tools, cancellation choices, visit recovery and call recovery. No measured horizontal overflow. Additional profile, history, replacement-context and empty-state checks are recorded in [the measurements](action-placement-checks.json).
- Browser walkthroughs verified direct Full profile and Conversation history navigation, cancellation/undo, candidate brief → replacement, rescheduling, no suitable matches and leaving the time open.
- A 10:00 cancellation was replaced by Sam at 10:20. Jordan's confirmed 14:00 appointment stayed fixed. The replacement was a personal hold. Editing it to 11:00 worked. Leaving a later cancellation open preserved Jordan's appointment.
- The existing 19 automated model/storage/recording regressions pass. This is an action-placement pass, not another ten-persona study.

All services remain mocked. Driving times, availability, report generation, transcription and office responses are fixtures; no real booking or cancellation is sent. These are browser layout checks, not physical-device or native-client certification. The full feature inventory still includes unimplemented analysis previews.
