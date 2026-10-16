# Daily sales-rep flow: decisions, prototype and endpoints

16 October 2026. This answers the original welcome → discover → select → plan → visit → review → CRM/backup flow. A source contract is evidence of an implementation in a reviewed repository; it is not evidence that the deployed endpoint is healthy, enabled for a customer, or integrated into the new app.

## What is settled and what is built

The agreed direction is a sales-rep app with admin-prepared accounts and assignments, Field Pro opening on Today, a mix of fixed appointments and flexible visits/calls, routing after selecting targets, full HCP/HCO navigation, contextual capture and follow-ups, and an uncluttered landing page. The current navigation proposal is Today / Targets / Activity / Insights. The cobalt/ink palette is retained.

We have built an interactive, responsive conversation prototype and a feature/screen inventory. We have **not** implemented or deployed a production mobile client. **No production API is wired into this prototype.** Its records and save/queue states are illustrative, and notes/plans disappear on reload.

The full inventory remains 58 audited feature families, 39 screen families and 12 reusable sheets/dialogs. These are design-scope counts, not completed implementation counts. The 18 HCP and 19 HCO destinations are exposed by name; most detailed datasets and the wider analysis tools remain previews.

| Your flow | Current concept | Existing source foundation | Remaining integration/product work |
|---|---|---|---|
| Welcome and a simple starting point | Interactive Today landing | Company/unit/view and assigned-book services | Authenticate the mobile session and resolve the assigned workspace; readiness/recovery UI |
| What is in today's day? | Local mixed agenda, editing, cancellation, tomorrow and completion states | Existing Field Pro route picks/order are local; Insights tasks and manual meeting records exist separately | A durable date/timezone-aware plan, stable item IDs, locations, durations, confirmations, ordering, conflicts and cross-device recovery |
| A brief of current stats | Some local completion/agenda context; a full daily-stat strip is not finalized | Account figures, activity/usage and transcript statistics exist | Agree which rep-progress measures are useful and how to join them; account commercial metrics are not the same as daily rep activity |
| Who to reach, relevance and nearest targets | Sample suggestions and reasons, shared list/map search and filters | Assigned accounts, Advanced Search, figures/analytics, contextual Field Ask, transcript suggestions and follow-up records | An auditable daily recommendation/ranking composition using permissions, freshness, due work, correct site and road travel feasibility |
| Inspect the target in depth | Interactive briefs and all named profile section entries; detail datasets are previews | Existing Advanced Search, provider services and the hospital/health-system profile package | Map each visible field to its actual schema/source/entitlement and integrate section renderers and independent loading/error states |
| Show candidates on a map | Real static geography, selectable public facility locations, fictional assignments; shared List / Map | Current web route planner uses Mapbox directions and matrix services | Choose/reuse a supported provider, connect maps/geocoding, verify site coordinates and routing configuration. Nearby's straight-line filter does not establish drive time |
| Select and then make a timeline/route | Interactive local visit selection, types, time/duration, confirmation and overlap warnings | Local route helpers and a road matrix/solver foundation; no complete day-plan persistence contract found | Persist the mixed agenda and its lifecycle; use a road travel matrix and preserve fixed commitments |
| Write up and review meetings | Interactive text capture, draft resume, note editing and review; audio/files are previews | Provider Notes REST and Insights upload/transcript routes | Keep quick notes and rich Insights storage distinct; map stable NPI/account/visit IDs; retry safely without duplicates |
| Preserve promises/follow-ups | Interactive local due task and completion | Insights tasks and target-list follow-up endpoints | Link them to the correct visit and expose them in the shared agenda; reconcile edits and status |
| Statistics and CRM later | Named tools/status previews | Reporting and statistics services; Insights CRM routes with company restrictions | Field Pro push is explicitly disabled in reviewed source. Validate a supported customer's CRM and the intended payload before offering a working push |
| Daily backup like WhatsApp | Memory-only preview queue, with explicit labels | Existing local route state, Insights draft storage and server-side notes/transcripts | Native durable drafts, offline outbox/retry and immediate remote saves; a separate backup/restore policy and verified restoration path. No complete daily plan backup/restore endpoint was established |

## Concrete contracts inspected

Relative paths below are scoped to their own service base URLs; there is no single assumed Field Pro gateway for every product.

| Capability | Contract found | Evidence and limit |
|---|---|---|
| Workspace and assignments | `GET /api/field/unit-config`, `/api/field/config`, `/api/field/views`, `/api/field/company-accounts` | Field Backend server handlers and frontend `backend-services/field-workspace.ts`; require the existing identity/group context |
| Briefs and scoped questions | `POST /api/field/account-brief`, `/api/field/surgeon-brief`, `/api/field/ask`; `GET /api/field/brief-purposes` | Field Backend server handlers. These do not constitute a persisted day-planner service |
| Field analytics and activity | `POST /api/field/figures`, `/api/field/account-block`, `/api/field/leakage`, `/api/field/activity`; `GET /api/field/usage` | Source implementations found. Activity logging/usage is not automatically an authoritative agenda or visit log |
| Provider discovery | `GET /MultiLevelSearchTest` on the configured SAM search host | Frontend `backend-services/search/search-service.ts`; source/client contract inspected, not a live mobile validation |
| Quick provider notes | `GET /notes?npiNumber=…`, `PUT /notes`, `PUT /notes/{id}` on the Dynamo REST service | `provider-notes-service.ts`, `dynamoDbRestService.ts` and read-only Lambda reference `restDynamo.mjs`. Field Pro notes are attached to selected HCPs. The Lambda is deployed separately from the frontend |
| Rich capture | `POST /api/upload`, `/api/upload/presign`, `/api/upload/complete`; `GET /api/transcripts`, `/api/transcripts/{id}`; `PUT /api/transcripts/{id}` | Insights server mounts and route handlers inspected. Files, processing and transcript edits have distinct workflows |
| Insight suggestions/statistics | `GET /api/transcripts/stats`, `/api/transcripts/analytics`, `/api/transcripts/ai-suggestions` | Suggestions here analyze transcript context; they are not proof of a complete nearby/available-next-visit planner |
| Tasks and follow-ups | `GET/POST /api/tasks`, `GET/PUT /api/tasks/{id}`; `POST /api/target-lists/{listId}/targets/{targetId}/followups`, `PUT …/followups/{followUpId}` | Insights server implementations found, with identity/list-write access. They need a deliberate shared-agenda adapter |
| Manual meeting records | `POST /api/target-lists/{listId}/targets/{targetId}/meetings`, `PUT …/meetings/{meetingId}` | Persists meeting date/type/sentiment/notes. It is not the complete mixed day-plan contract with stop order, constraints and travel |
| CRM | `POST /api/crm/sync`, `/api/crm/batch-sync`; `GET /api/crm/status` | Insights routes exist; reviewed client enables CRM only for Stemline. Field Pro `SyncModal.tsx` has its push disabled and explicitly says the integration is not switched on |
| Reports | `POST /api/reports/generate`; account volume/leakage/summary routes | Hospital Reports server routes inspected. Supported report families and frontend/backend compatibility constraints still apply |
| Road travel | Mapbox Directions `/directions/v5/mapbox/driving/…` and Matrix `/directions-matrix/v1/mapbox/driving/…` in existing web code | `Workflows/routePlanning.ts`. The new prototype does not call them. Google Routes or OSM plus an actual routing engine remain valid implementation choices |
| Full timed day-plan save/load/sync and backup/restore | **No complete contract established** | Neither the reviewed Field Backend route set nor local web helpers establish the required durable plan and recovery lifecycle |

Current prototype visit choices match the reviewed Field Pro vocabulary: in-person visit, phone call, case observation and email. Case observation counts as a site visit for routing. Video-call persistence is not presented as an established existing contract.

## Verification level and provenance

The four original reference repositories and their revisions are recorded in `repository-feature-map.md`. Additional Field Backend source was read through the user's existing terminal GitHub access after a clone transport failure. The fetched revision is `fbe6487ee2a524f428930918333dabd7ec1f3607`; read-only snapshots are in `reference/field-backend-source/`. An AST scan found 44 server route handlers; the inventory is `field-backend-routes.json`. No timed day-plan, calendar appointment or daily backup/restore route appears in that reviewed route set. This is a statement about the inspected source, not every service the company might operate.

No deployed authenticated calls or writes were made during the audit. Authentication, customer entitlements, deployed-version parity, actual response schemas, errors, pagination and the supported CRM tenant must be validated before marking a production integration complete. The new app also needs a shared contract for the plan/recommendation/persistence work identified above.

The next implementation slice should connect workspace + assigned targets + real profiles first, then establish durable agenda storage and real road routing, then connect typed notes/follow-ups with offline recovery. CRM and backup/restore can follow once their customer-specific behavior is verified. The mockup can continue to evolve while those contracts are resolved; its polished appearance is not a substitute for that verification.
