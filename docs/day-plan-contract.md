# Daily plan: proposed integration contract

17 October 2026 · **Proposed API and implementation sequence. These routes do not exist in the reviewed services and are not connected to the demo.** Read the [endpoint audit](plan-status-and-endpoint-audit.md) for existing contracts. This proposal fills the durable mixed-agenda gap without replacing the existing profile, notes, transcript or task stores.

## Ownership and identity

The server resolves the signed-in rep's company, unit, sales view and permitted records using the existing identity and assignment rules. The mobile client cannot gain access by changing a workspace ID or persona label. Accounts are provisioned by our team; the rep signs in, verifies their workspace and arrives on Today.

A day belongs to one workspace, rep, local calendar date and IANA timezone. Store the local date separately from UTC timestamps. A visit has a stable UUID independent of its target, date or position. The same HCP can have distinct visits on different days, or several interactions on one day. Never use NPI, account ID or array position as the visit ID.

Persist both the target and actual visit site. A target reference includes its source system, entity kind and stable upstream identifier; an HCP reference can also carry a verified NPI. A site reference includes a stable facility/practice ID, address, coordinates, coordinate source and verification status. Headquarters coordinates must not silently substitute for the chosen practice.

## Data carried by each visit

| Field | Purpose and rule |
|---|---|
| `id`, `version` | Stable identity and optimistic concurrency |
| `target`, `site`, `attendees` | Exact account/person and place; attendee IDs remain distinct from site grouping |
| `activityType` | In-person visit, phone call, case observation or email, following reviewed source vocabulary |
| `timing` | Flexible or timed; timed items carry an offset-aware start and duration; flexible items have no invented appointment time |
| `confirmation` | Unconfirmed or confirmed, with provenance; choosing a planned time does not book or confirm an appointment |
| `position`, `goal`, `bufferMinutes` | Rep's manual order and preparation context; a buffer is configured input, not calculated road travel |
| `status` | Planned, in progress, completed, attempted, skipped, cancelled or rescheduled; log the actual outcome separately |
| `captureLinks`, `followUpLinks` | Source system + record ID + delivery state; editing one note cannot complete every visit for that person |
| `createdAt`, `updatedAt`, `changedBy` | Server audit times and actor; preserve history when rescheduling or cancelling |

Lifecycle transitions need server validation. A reschedule records the previous date/start and retains the visit ID. A skip leaves the assigned target in the book. Completion references one visit ID. Recording an attempted contact is an outcome, not proof of a meeting. A retry cannot create another visit or conversation.

## Proposed routes

Use a mobile composition service or a deliberate extension of Field Backend. The `/api/mobile` prefix below is a proposal, not an existing gateway.

| Route | Responsibility |
|---|---|
| `GET /api/mobile/day-plans/{date}?timezone={ianaZone}` | Authorized plan snapshot, version, ordered items, source-link delivery states and last remote save time; return a valid empty day when no plan exists |
| `POST /api/mobile/day-plan-commands` | Apply a typed, idempotent command: add, update, reorder, skip, cancel, reschedule or record outcome; return updated snapshots and versions |
| `POST /api/mobile/day-plans/{date}/route-preview` | Calculate a proposal using verified sites, real road travel and fixed commitments; return feasibility and provider provenance without saving a reordered plan |
| `POST /api/mobile/day-plans/{date}/alternatives` | Return up to three candidates for a cancelled slot, excluding declined/cancelled people and existing commitments, with reasons, actual travel feasibility and explicit availability provenance |
| `POST /api/mobile/appointment-requests` | Send an explicitly reviewed request through the chosen connected calendar/contact channel, persist delivery and provider event identity, and link it to one visit |

Each command contains a client-generated `commandId`, expected version(s), affected plan date(s), timezone, command type and payload. Resolve ownership on the server. Deduplicate retries by authenticated workspace/rep and `commandId`; the same ID with a different payload is a conflict. Return the original operation result for an identical retry.

For rescheduling, check both source and destination plan versions and move atomically. Never remove the source visit if the destination write fails. Reordering must include stable visit IDs and the expected plan version. Applying a route proposal requires an explicit subsequent command against the version it was computed from. Preserve confirmed commitments; infeasible insertions produce an explanation, not a silently moved appointment.

Example command shape (illustrative IDs):

```json
{
  "commandId": "cf4bf3d8-0673-4f80-8e71-81bef0f38a07",
  "type": "reschedule",
  "timezone": "America/New_York",
  "expectedPlans": [
    {"date": "2026-10-16", "version": 7},
    {"date": "2026-10-17", "version": 2}
  ],
  "payload": {
    "visitId": "35f41c94-c37f-4ae5-b70e-52e06bb4128a",
    "fromDate": "2026-10-16",
    "toDate": "2026-10-17",
    "timing": {"mode": "flexible", "durationMinutes": 30}
  }
}
```

Use structured errors: `403` for denied scope, `409` for version/idempotency conflict, `422` for invalid time/site/transition or conflicting commitments, and `503` for an unavailable dependency. Include a request ID and retryability. A stale edit returns the current permitted snapshot for reconciliation; it must not overwrite the newer plan. Exact route/error schemas still need backend-owner agreement and deployed tests.

## Route feasibility

The existing web implementation uses Mapbox Directions/Matrix. The app can deliberately reuse that or implement the discussed Google Routes / OSM plus routing-engine option. Keep the provider adapter behind the plan service; do not embed privileged server credentials in the mobile client.

Return provider, travel mode, calculation time, departure-time assumptions, leg durations/distances, route geometry where available, and a reason for each unrouteable or infeasible stop. Feasibility accounts for fixed times, visit durations, travel and buffers. Calls and emails remain in the agenda but are not road stops. Co-located visits may share consecutive travel legs while retaining separate visit outcomes; returning to a site later is a separate stop.

Straight-line proximity is a candidate filter. An unavailable road matrix means **travel feasibility unknown**. It must not become zero travel time, an invented ETA or a feasible badge. Location permission is optional: a verified site or manually chosen origin must work.

## Capture, offline work and recovery

### Appointment and cancellation integration

A personal plan, an unsent draft, a sent request, acceptance, and manual confirmation are different states. The demo implements personal plans, unsent drafts and rep-marked confirmation only. Production must retain the exact provider event/request ID, organizer, verified recipients, timezone, delivery state, acceptance state, latest provider revision and confirmation provenance. Calendar permission and provider choice remain open; the booking UI must not infer the doctor's availability from the rep's free calendar.

A provider cancellation event and a rep's report of a cancellation both target one visit. Deduplicate events and reject stale provider revisions. Preserve the cancelled visit and any prep history, open a gap, and offer recovery without moving later fixed commitments. Several cancellations must remain independently recoverable. Candidate availability or road travel that cannot be verified remains unknown; a tentative replacement cannot silently become a confirmed booking.

Sending a request is an explicit external action with reviewed recipient, time, place and purpose. Handle failure, retry, decline, reschedule, acceptance, disconnect and missing calendar access. Do not call a draft “requested,” or a calendar export “accepted.” A cancelled doctor's slot should not be refilled with that same doctor unless a later verified availability change permits it.

### Notes and recovery

Keep quick provider notes, rich Insights capture and follow-ups in their established stores behind explicit adapters. Persist the source record ID and visit link. Where stores cannot commit atomically, expose pending/failed delivery per adapter and retry with the same operation identity. Saving the note, generating insights and pushing CRM are separate operations. CRM remains gated by the actual supported company/integration.

Durable local storage must save a draft before navigation, process termination or connectivity loss. Key a draft by its own ID and exact visit/source, rather than the person alone. Keep a durable outbox, acknowledge commands only after server confirmation, and reconcile a newer server version after reconnect. A success label distinguishes device draft, queued operation, remote save and CRM delivery. Do not infer any of these from being online.

Remote saves and offline synchronization solve daily recovery first. A separate backup/restore policy must define scope, retention, ownership and a tested restore path; the prototype's memory queue is not backup.

## Delivery order and acceptance

| Slice | Concrete completion evidence |
|---|---|
| 1. Workspace and assigned targets | Sign in with a provisioned account; permitted assignments load; no-assignment, expired-session, denied and retry states work; no cross-company record access |
| 2. Real briefs and profile sections | Stable identity/site mapping; each exposed field has its source, permission, freshness, loading/empty/error behavior; maintain all named section destinations |
| 3. Durable mixed agenda | Same person on two days remains independent; multiple visits on one day have separate IDs; timezone/day-boundary cases pass; cross-device reload recovers the plan; conflicts cannot silently overwrite |
| 4. Road travel | Provider-backed legs and provenance; fixed appointments remain fixed; a failed matrix yields unknown feasibility; calls are excluded; repeated-site routes retain chronology |
| 5. Capture and follow-ups | Saving/retrying one conversation creates one upstream record; editing it retains identity; only its linked visit changes; a draft survives a terminated app and offline reconnect; follow-up completion retains the source link |
| 6. Reports, wider analysis and CRM | Implement supported families/entitlements with processing and error states; validate the intended CRM tenant and payload before enabling push |
| 7. Backup and device release | Verified restore drill; physical-device keyboard, safe-area, text-scaling, accessibility and map SDK tests; no loss during interrupted saves |

The current demo demonstrates parts of these behaviors with sample state. It does not satisfy these production acceptance gates. The full design scope remains 58 feature families, 39 screen families and 12 reusable overlays; implementing the first slices does not imply the whole inventory is complete.
