# Activity refinement

Implemented 18 October 2026. [Open the demo](https://doggowoofwoof.github.io/AppNexus/demo/) and select Activity.

Activity combines a short work queue with a dated visit journal. Log visit is a compact header action. There are no Recent / Audio / Trash tabs or statistic cards.

- **To do** combines unresolved cancellation openings, open follow-ups, meaningful drafts and items awaiting review. Three items appear initially, with inline expansion for the rest. Empty drafts are omitted.
- Follow-ups support completion from the queue, with Undo. The update is saved to the device. A failed save restores the previous task state and shows the storage error. Buttons disable while the update is being saved.
- **Visit history** groups entries by date and orders known appointment times from latest to earliest. Rows show the person, account, outcome, a short discussion preview and a recording indicator when audio exists. The full source and transcript remain inside the linked record.
- Cancelled appointments show whether the time was left open, remains available or has a replacement, without an extra expansion step.
- Search remains available for existing records; empty history hides the unused search field. Empty search results provide Clear search.
- Completed follow-ups, deleted records and storage controls remain under Record options. Wider layouts place the work queue beside the journal; phone and large-text layouts stack them.

## Verification

The existing 19 automated model/storage/recording regressions pass. Browser walkthroughs verified completion, Undo, persistence after refresh, rollback under the mocked device-storage-full condition, draft resumption, expanded queues, note-content search and clearing an empty search, secondary deleted-record access, and opening the linked visit record with audio retained.

Five populated screen/states were checked at 320px / 200% text, 390px / Phone, and 840px / Wide screen, with no measured horizontal overflow. Empty history was checked at those three widths as well. Light and dark phone layouts were visually inspected. [Measurements](activity-layout-checks.json).

Actual captures: [phone](screenshots/actions-activity.jpg), [wide](screenshots/activity-wide.jpg), [light](screenshots/activity-light.jpg).

The browser demo still uses mocked services and local device persistence. No production API or native-device certification is implied. This refinement does not constitute another ten-persona study.
