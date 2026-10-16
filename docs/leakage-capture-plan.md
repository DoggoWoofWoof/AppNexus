# Leakage reports + capture/CRM — contract plan

16 October 2026 · Source-grounded. Paths relative to `reference/repos/`
(git-ignored). No live calls made; verify auth/entitlements before wiring.

## 1. Leakage reports — SSE-streamed PDF, not queued/polled

Backend: `Hospital_Reports_Production/routes/reports_v2.py`, `reports.py`;
frontend: `docnexus-frontend/.../CaseLoss/caseLossApiService.ts`,
`Workflows/useLeakageJob.ts`, `AccountWorkspace/ReportDrawer.tsx`.

- Generate: `POST /api/reports/generate` (`Accept: text/event-stream`).
  Inputs: hospital/org/npi/state, user/email, CPT group + procedure/diagnosis
  codes (or advanced-cohort verbatim), drug fields, national flag, title,
  radius 0–250 mi, year_from. Router picks docnexus/icd/drug/national/monarch/
  abiomed/ottava/manual-capital. Hospital name required unless national.
- Progress: `event:start → progress{phase,message,0-100} → complete{download_url,
  s3_key} | error`. Client state machine: idle → running → done{url} | error.
  Cancel aborts the watch only; the server still finishes.
- Library: `GET /api/reports/{userId}`, download via 1h presigned URL,
  `DELETE /api/reports/{userId}?s3_key=…`. Share = link (`?sharedFrom=&s3Key=`)
  plus revocable Dynamo grants (`hospital-report-shares-service`).
- Fast JSON (no PDF): `POST /api/accounts/{org_id}/{volume|leakage|
  market-share|summary|full}`, `POST /api/providers/{npi}/leakage`,
  drug variants, legacy `/api/case-loss` + `/api/map-data`. Field Pro reads
  these via `/api/field/leakage`, `/api/field/account-block`,
  `/api/field/provider-leakage` passthroughs.
- Mobile plan: Report config wizard → SSE progress → library/download/share.
  Reuse `buildGroupCodeFields` payload rules; never flatten advanced cohorts.

## 2. Capture — two distinct stores, do not merge

### A. Quick visit notes — per-HCP NPI (DynamoDB)

- Store: `Notes-Provider-prod` via `https://dynamodb.docnexus.ai/notes`.
- `GET /notes?npiNumber=…` (read), `PUT /notes` (create, client UUID),
  `PUT /notes/{id}` (patch / `{_deleted:true}` soft-delete).
- Writer: `VisitModal` → one put per picked doctor
  (`visitNoteData(npi,type,note,place,at)`). No account-level store — starting
  from an account must pick the HCPs met.
- Mobile plan: short form (type + note + entity context), per-entity drafts,
  explicit saved-local vs saved-remote states.

### B. Rich insights — transcripts (MongoDB)

- `POST /api/upload` (multipart: files + hcps[] + meeting context + tags),
  presign/complete for large files; `GET/PUT/DELETE /api/transcripts…`;
  AI actions: polish, tagged-view, topics, sentiment, summary,
  compliance-check, reanalyze, retry, audio-url.
- Follow-ups live in two places: standalone `Task` (`/api/tasks…`) and
  target-list embedded follow-ups/notes/meetings
  (`/api/target-lists/{list}/targets/{target}/{followups|notes|meetings}…`).
  Manual meetings are explicitly not transcripts.

## 3. CRM — three paths, different gates

1. Manual Salesforce push: `POST /api/crm/sync{transcriptId,…}`,
   batch-sync, status/health/stats. Gate: Salesforce credentials. Writes
   `Transcript.crmSyncStatus/crmRecordId/crmSyncDate`.
2. Auto-sync (Stemline-only): fire-and-forget from upload; writes Dynamo
   provider-notes row + Veeva `Call2_vod__c` + Note. Gate: stemline company
   domain/mode; drops observations, already-synced, NPI-less items.
3. Field Pro push: **disabled in reviewed source** (`SyncModal` says not
   switched on). Never promise universal sync — preview only until a
   supported customer + payload is verified.

## 4. Mobile sequencing

Profiles first (inventory doc), then leakage config + progress, then quick
notes with honest sync states, then rich capture, then CRM per supported
tenant. Each needs loading/empty/denied/error/offline variants.
