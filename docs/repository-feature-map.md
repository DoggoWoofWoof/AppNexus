# Field Pro app: repository feature map and flow discussion

Latest product direction: `sales-rep-daily-flow.md` makes Today inside Field Pro the proposed landing experience for sales reps, with setup performed on our side. The 58 feature families below remain in the coverage register; navigation is still under discussion.

15 October 2026. Source review of the four supplied repositories, accessed with the user's existing terminal GitHub login. This is a feature-family inventory and navigation proposal, not a claim of complete field parity or tested production behavior. The current mockup is provisional; no new screens are being designed in this discussion pass.

## Evidence and scope

| Source | Reviewed revision | Main evidence |
|---|---|---|
| A — `docnexusai/docnexus-frontend` | `32ca636812f0449807205466bd15109fd11a61b6` | `src/routes/MainRoutes.tsx`; `AccountWorkspace`; provider profile config and tabs; `CaseLoss`; Field Admin; Advanced Search entry/config |
| B — `docnexusai/hospital-health-system-views` | `ed4da2f62a4b1708196d9d3971d8517ef1cd7637` | `src/pages/Index.tsx`; header, profile sections, claims sections, group controls, exports |
| C — `docnexusai/Hospital_Reports_Production` | `88c84e47c812523eb3c0008521d5019e8e14bf23` | `routes/reports_v2.py`, `reports.py`, `accounts.py`, `groups.py`; server router registration; API/handoff documents |
| D — `docnexusai/docnexus-ai-insights` | `53c2540fba8aaa104f8c79a2a1c2f8c3c414b8db` | client routes/layout/capture/transcript/list/CRM screens and corresponding server routes |

Local read-only reference checkouts are in `reference/repos/`. These repositories have not been installed, run or modified. No production calls, report generation, uploads, CRM sync or messages were performed during this review.

The agreed product scope is Field Pro, full HCP/HCO profiles and discovery, leakage/reporting, and Insights/capture/CRM. A contains other platform products; its entire route tree is not automatically the app scope. The supplied brief specifies existing Advanced Search endpoints for HCP/HCO discovery, and explicitly distinguishes this from importing the full Advanced Search product. This boundary needs a recorded decision if it changes.

Repository presence proves that a screen or implementation exists at this revision. It does not prove that the feature is enabled for the current customer, that its backend is deployed, or that its data is available. Visibility must respect existing company/persona permissions and entity-specific availability.

## Findings that change the earlier flow

1. `/field-pro` uses `AccountWorkspace`. `/field` uses the separate original Field/Workflows product. The design ZIP and shared helpers must not make us conflate them. See A `src/routes/MainRoutes.tsx:50`.
2. Field Pro has four substantive views, a HEMA Workbench and manager Team functions. A universal minimal account brief cannot replace all of their workflows. See A `AccountWorkspace/lib/views.ts`, `lib/registry.ts`, and `components/TopBar.tsx`.
3. The full HCP profile config contains 18 named sections, including Conferences, Affiliations and SDOH. HCO sections also extend beyond the earlier inspected web snapshot. They need an explicit section index, not an unnamed Details bucket.
4. Insights is a product with capture, transcripts, personal insights, summaries, target lists, analytics, documents, data sources, compliance, referral analysis and restricted administration. It is broader than an Ask AI screen or a short visit note.
5. Field Pro's `SyncModal` disables its push action and says sending is not switched on. Insights has separate sync routes and a company gate; D `client/src/constants/crm.ts` enables the current client flow only for Stemline. Provider CRM also mixes an interaction push path with mock/coming-soon paths. Preserve these distinctions rather than promising a universal sync.
6. Field Pro visit notes are saved per selected HCP NPI, including when started from an account. There is no account-level note store in that path. See A `components/VisitModal.tsx`. An account-level Log visit must first identify the people met.
7. Reports include drug and national variants beyond the older handoff examples. Current code takes precedence over older documentation. Some backend capabilities are not selectable through the current frontend.
8. Field Pro depends on services referred to as `Field_Backend` in A `src/backend-services/field-workspace.ts`. Its server repository was not among the four supplied references. Frontend contracts are available here; full server verification needs that source too.

## Feature-family coverage register

Every row must retain an explicit destination. Grouping rows reduces visual clutter; it does not remove them from the scope discussion. Status below means source evidence, not production verification.

### Field Pro

Paths in this table are relative to A `src/pages/Dashboard/AccountWorkspace/` unless stated otherwise.

| ID | Capability to preserve | Proposed destination | Evidence |
|---|---|---|---|
| FP01 | Capital Sales, Clinical Sales, HEMA and Sales Enablement; assigned default and View as behavior | Field Pro workspace/view selector | `lib/views.ts`; `hooks/useViewAs.ts` |
| FP02 | Assigned HCO/HCP books; list selection, search, geography/type/code filters, year/scope, sorting and pagination | Field Pro → My book | `components/HomeView.tsx`; `components/ListControls.tsx`; `AccountWorkspace.tsx` |
| FP03 | Target uploads, row matching/review, account additions, removal history and restoration | Field Pro → Targets / list actions | `TargetListUpload.tsx`; `RemovedModal.tsx`; `lib/matchAccounts.ts`; `lib/removed.ts` |
| FP04 | Account volume and trends, procedure mix, capacity, facility finances, robotic footprint and technology | Account → Clinical activity / Organization & performance | `lib/registry.ts`; `components/AccountView.tsx` |
| FP05 | Leakage by quarter, destinations, DRG case loss, market share and competitive mix | Account → Leakage & market | `lib/registry.ts`; `components/CompetitiveMixCard.tsx` |
| FP06 | Payer mix, site of care, payer by setting, economics, industry payments and payment alerts | Account/HCP → Economics & industry | `lib/registry.ts`; A `src/backend-services/field-workspace.ts` |
| FP07 | Linked HCPs; procedure activity, practice sites, operating weekdays, referrals in/out, destinations and primary hospital | Account → People; HCP → Clinical activity / Relationships | `SurgeonView.tsx`; `HcpCasesCard.tsx`; `lib/registry.ts` |
| FP08 | Scoped questions and role-specific AI account/HCP briefs; brief PDF output | Field Pro → Ask; profile → AI brief / Export brief | `AskAiView.tsx`; `BriefCard.tsx`; `components/pdf/` |
| FP09 | Visit types, select one/multiple HCPs, save note per person, partial-save recovery and history | Profile → Log visit; Activity → Visits | `VisitModal.tsx`; `lib/visit.ts`; `lib/notes.ts` |
| FP10 | Route origin, stop selection, accounts/doctors outside the book, driving order, manual reorder, times and directions handoff | Field Pro → Routes | `RouteView.tsx`; `OriginPicker.tsx`; `lib/route.ts`; `hooks/useRouteFinder.ts` |
| FP11 | Opportunity Map, geographic exploration and account drill-down | Field Pro → Opportunity Map | `OppView.tsx`; `OppMapPanel.tsx`; `hooks/useOppHeat.ts` |
| FP12 | Territory list/detail, edits and ZIP upload/edit; add accounts/HCPs to territories | Field Pro → Territories | `TerritoriesView.tsx`; `TerritoryView.tsx`; `ZipUploadDialog.tsx`; `ZipEditDialog.tsx`; territory hooks |
| FP13 | HEMA comparison: groups/custom scope, national/state/account, years and care-setting schemes; overview, payers and economics | Field Pro → HEMA Workbench, for supported views | `HemaWorkbench.tsx`; `hema/HemaViews.tsx` |
| FP14 | Manager team/reps, account assignments and assignment history | Workspace → Team, for authorized managers | `TeamView.tsx`; `RepDialog.tsx`; `ChooseReps.tsx` |
| FP15 | My/shared reports, running generation status, report drawer and sharing | Reports; contextual account shortcut | `ReportsView.tsx`; `ReportDrawer.tsx`; shared CaseLoss report hooks |
| FP16 | CRM connection/status explanation | Activity → CRM, with source-specific availability | `SyncModal.tsx` — push disabled in reviewed code |

### Full HCP profiles and discovery

| ID | Capability to preserve | Proposed destination | Evidence in A |
|---|---|---|---|
| HP01 | Identity, contact, biography, conditions, training, credentials, licenses and memberships | HCP → Overview / Profile | `providers/tabs/Overview`; `ProfileSummary` |
| HP02 | Publications and their search/filter/record views | HCP → Research → Publications | `providers/tabs/Publications` |
| HP03 | Clinical trials and research role/sponsor/status views | HCP → Research → Clinical trials | `providers/tabs/ClinicalTrials` |
| HP04 | General/research industry payments | HCP → Industry → Payments | `providers/tabs/Payments` |
| HP05 | HCP graphs and relationships | HCP → Research & relationships → HCP graphs | `providers/tabs/HcpGraphs` |
| HP06 | Multimedia, social media and conferences | HCP → Professional activity, with each item named | `src/config/profileTabs.config.ts`; corresponding tabs |
| HP07 | Diagnosis, procedure, prescriptions, payer mix/remittance and referrals | HCP → Clinical & claims, with named subsections and scoped filters | profile tab config; corresponding claims tabs |
| HP08 | Affiliations and SDOH | HCP → Affiliations; Clinical & claims → SDOH | profile tab config; corresponding tabs |
| HP09 | Notes and CRM interaction timeline/push paths | HCP → Activity / CRM | `providers/tabs/Notes`; `CRM/CRM.tsx`; `CRM/SyncToCRM.tsx` — some paths mocked or coming soon |
| HP10 | Profile export, section filters, team/persona visibility and US/international differences | Profile actions and section index | `providers/Profile.tsx`; `ProfileExport`; profile tab config |
| SR01 | Find HCPs/HCOs outside assignments and open full profiles using existing search services | Search → People / Organizations | `AdvancedSearch/AdvancedSearch.tsx`; filter configuration; brief |
| SR02 | Existing HCP/HCO search filters, result modes, saved/bulk/export/cohort capabilities | Search → named filters/actions; exact mobile subset still to decide | `AdvancedSearch/WORKFLOW.md`; `config/filterFieldsConfig.ts`. Full product import is not established by the brief |

### Full HCO profiles

Paths are relative to B `src/`.

| ID | Capability to preserve | Proposed destination | Evidence |
|---|---|---|---|
| HO01 | Summary, identity/contact, capacity, operational/clinical metrics and network | HCO → Overview / Organization & performance | `pages/Index.tsx`; `GeneralInfoCard`; `SizeAffiliationsCard`; summary components |
| HO02 | HCP/executive contacts, KOLs, hospital children and affiliations/linked locations | HCO → People & network, with separate named destinations | `HCPExecutivesCard`; `HCPsTab`; `KolTab`; `HospitalsTab`; `OrgLinkedLocationsSection` |
| HO03 | Clinical trials and activity calendar | HCO → Research & activity | `ClinicalTrialsTab`; `ActivityCalendarTab` |
| HO04 | Diagnosis, procedure, prescription, payer mix, remittance and referrals | HCO → Clinical & claims | `pages/Index.tsx`; corresponding tab components |
| HO05 | Quality, patient experience, financials, reimbursements, clinical data, technology and media | HCO → Organization & performance / Professional activity, each named | `pages/Index.tsx`; corresponding cards/tabs |
| HO06 | Code/group selection and creation, claims trends, top HCPs and row/table exports | Within the applicable analysis section | `GroupsDropdown`; `CreateGroupDialog`; `VolumeChartSheet`; `TopHcpsSheet`; `ExportButton` |
| HO07 | AI brief, leakage report entry, PDF export and report sharing | Profile actions; Reports shortcut | `HealthSystemHeader.tsx`; `AIBriefModal`; `CaseLossModal`; `pdf/OrgPdfExportButton`; `ShareReportDialog` |

HCO section availability varies by organization/hospital/health-system type and actual data. Preserve those distinctions; a loading section must not be mistaken for a removed capability.

### Reporting and analytics services

| ID | Capability to preserve | Proposed destination | Evidence |
|---|---|---|---|
| RP01 | Facility selection, organization/state/type autocomplete, group scope, title, radius and years | Reports → New report, prefilled from an account when relevant | A `CaseLoss/CaseLossReports.tsx`; C report request/routes |
| RP02 | Generic procedure and diagnosis reports; special Monarch, Monarch one-pager, Abiomed, Ottava and manual-capital families | Report configuration, offered according to supported group/context | C `routes/reports_v2.py:179` |
| RP03 | Drug intelligence and national procedure/diagnosis/drug report routing | Reports → Scope/type configuration | same backend detector; A national/drug selection paths. Validate selectable combinations before implementation |
| RP04 | Streamed actual phases/progress, completion, failure and report retrieval | Reports → Generation detail / My reports | C `routes/reports_v2.py`; A generation handler |
| RP05 | My/shared reports, download, delete and share-management actions | Reports → My reports / Shared with me | C `routes/reports.py`; A report sharing hooks/dialogs |
| RP06 | Account/HCP volume, leakage and market analytics; group site-of-care/payer/economics services | Contextual Field Pro/profile analysis | C `routes/accounts.py`; `routes/groups.py` |
| RP07 | Drug volume, NBRx, persistence, line of therapy, switching, prescribers, economics, payer, competition and leakage APIs | Coverage candidates for drug analysis under profiles/Reports | C `routes/accounts.py:1630`. API-only evidence here; not proof that all are exposed in the reviewed web UI |
| RP08 | Advanced-cohort report payloads | Explicit compatibility decision in report configuration | C accepts cohort paths; A's report selector excludes advanced-cohort groups. Do not silently enable all backend combinations |

### Insights, capture and follow-up

Paths are relative to D.

| ID | Capability to preserve | Proposed destination | Evidence |
|---|---|---|---|
| IN01 | Type/paste, file upload and record audio; meeting date/type, HCPs, tags and company-specific fields | Add insight, reachable from HCP/account/Activity/Insights | `client/src/components/AddInsightSheet.tsx` |
| IN02 | Draft recovery, upload status, transcription/analysis processing and retry | Activity → Drafts / Processing | capture component; `PendingDraftsBanner`; draft helpers; transcript routes |
| IN03 | Transcript library/detail, audio playback/download, attendees, tags, editing, summaries, insight extraction and tagged views | Activity → Conversations → Conversation detail | `client/src/pages/Transcripts.tsx`; `TranscriptDetail.tsx`; server transcript routes |
| IN04 | My Insights, sentiment analysis/trends and analytics dashboard | Insights → My insights / Analytics | `MyInsights.tsx`; `Analytics.tsx`; `Dashboard.tsx`; transcript/AI routes |
| IN05 | Insight/congress summaries, selected conversations/insights, editable/verbatim choices, templates, generation and history | Insights → Summaries; resulting documents in Reports | `CongressSummaries.tsx`; `CongressSummaryDetail.tsx`; summary server routes |
| IN06 | PDF/PPT generation, individual/batch documents, library, download and deletion | Reports → Insight documents; source link from conversation/summary | `GenerateDocumentDialog`; `pages/Documents.tsx`; `server/routes/documents.js` |
| IN07 | Target/smart lists, HCP records, notes, meetings, follow-ups, pre-call briefs, signals/sentiment, export, sharing, archive/restore and digest settings | Insights → Target lists; contextual HCP shortcut | `TargetLists.tsx`; `TargetListDetail.tsx`; `components/targets`; `server/routes/targetLists.js` |
| IN08 | Data source library, upload/connect, sync, file insights and reanalysis | Insights → Data sources; connections in workspace settings | `DataSources.tsx`; corresponding server routes. Provider-specific support requires validation |
| IN09 | Compliance checks, supported standards and result history | Insights → Compliance; conversation-level check shortcut | `ComplianceCheck.tsx`; transcript detail; compliance routes. Existing company gate applies |
| IN10 | Referral analysis with NPI/ICD selection and presentation generation | Insights → Referral analysis; profile referral shortcut | `Referrals.tsx`; `server/routes/referrals.js` |
| IN11 | CRM sync status, individual/batch sync, connection status and tasks | Activity → CRM | `CRM.tsx`; `server/routes/crm.js`; `constants/crm.ts` — company-gated |
| IN12 | Restricted transcript administration and company modes | Workspace → Administration, authorized users only | `App.tsx`; Layout; `AdminTranscripts.tsx`; company/admin gates |

### Workspace and administration

| ID | Capability to preserve | Proposed destination | Evidence |
|---|---|---|---|
| AD01 | Field Pro company/unit configuration, people, views, code/referral groups, drugs, account lists and readiness | Workspace → Administration, restricted | A `Admin/FieldAdmin/FieldAdminPages.tsx`; `FieldAdminSetup.tsx`; `fieldAdminSteps.ts` |
| AD02 | Manager assignment and usage | Workspace → Administration / Team | A `FieldManagersTab.tsx`; `FieldUsageTab.tsx`; AccountWorkspace Team |
| AD03 | Existing feature/persona visibility, company context and CRM configuration | Workspace → Access/configuration, restricted | A profile feature gates and Field Admin; D company mode and CRM gates |

Whether every administration screen needs a native mobile editor is a separate platform decision. The coverage register retains them until that decision is explicit; nothing is silently excluded because it is infrequent.

## Flow proposal for discussion

### Stable top-level destinations

| Destination | User question | Named destinations inside |
|---|---|---|
| Field Pro | Which accounts/people should I work with, and how do I plan the day? | My book, Targets, Routes, Opportunity Map, Territories, HEMA Workbench; manager Team entry where authorized |
| Search | Who or which organization do I need to find? | HCP search, HCO search, appropriate filters/results and explicit list/territory actions |
| Reports | What analysis do I need to generate, open or share? | New report, My reports, Shared with me, Insight documents, running jobs |
| Insights | What have conversations and evidence taught us? | My insights, Analytics, Summaries, Target lists, Data sources, Compliance, Referral analysis |
| Activity | What have I captured, what is processing, and what needs follow-up or sync? | Visits, Conversations/transcripts, Drafts, Processing, Follow-ups, CRM |

Workspace/company/view context and restricted Team/Admin/configuration live in app chrome with named entries. Capture is a contextual action, not a sixth navigation destination. These five destinations are a recommendation to discuss, not an accepted decision.

Insights is where analysis is selected and generated; Reports is where its output can be retrieved. Activity is the work/history view; opening an item uses the same conversation or insight record, not a duplicate mobile store. Field Pro assigned targets and Insights target lists remain labeled by their existing source until their identity/permission contracts are reconciled.

### Six connected journeys

1. **Start work:** sign in → resolve company/unit/view/permissions → open assigned Field Pro book. Incomplete setup leads to a clear existing setup/admin route. Reps with an assigned book do not repeat admin setup.
2. **Prepare a visit:** book → account → role-relevant brief → person → full profile section or Ask/AI brief → choose contact/visit action. Keep account, selected code scope and Back path.
3. **Discover a new target:** Search → HCP/HCO results → full profile → explicitly add to a supported list, territory or route. Viewing a profile does not assign the person to the rep.
4. **Investigate and report:** account/profile/HEMA or Reports → choose scope and valid group/type → configure required inputs → generate → real progress/error → open/download/share. Contextual entry preselects identity and group; national reports omit account selection.
5. **Capture and review:** choose Quick visit note or Add insight. Quick visit started from an account selects the HCPs met and writes existing per-HCP notes. Add insight chooses type/paste, record or upload, supplies meeting/HCP context, then processes → reviews transcript/insights/summary → saves edits/tags/follow-ups. These are distinct existing storage paths; a common entry does not imply an automatic data migration.
6. **Follow up and sync:** Activity → relevant item/follow-up → CRM preview/status → push only for a supported, connected context → show actual pending/success/failure state. Field Pro's disabled push remains explicitly unavailable until its real integration exists.

### Profiles without a wall of tabs

Keep a short overview, primary actions and a visible **All sections** entry. That entry lists every available section by name, grouped by purpose. A person can jump directly to Publications, Remittance, Conferences or Quality without guessing what is hidden under Details. The current section stays named; returning restores scope and list position.

HCP groups: Overview & profile; Clinical & claims; Research & relationships; Industry & professional activity; Notes & CRM. HCO groups: Overview; People & network; Clinical & claims; Research & activity; Organization & performance; Reports & briefs. These group names are proposals; the register's actual features must stay visible in the section index.

## Before the next mockup

- Settle top-level destinations and the capture/analysis/history boundaries.
- Give every register ID a screen, action, permission rule, read/write source and availability state; preserve source-specific restrictions and disabled features.
- Resolve the HCP/HCO search boundary, native administration coverage and backend-only analysis candidates explicitly.
- Follow with a field/action-level parity checklist, including detail filters, exports, loading, empty, denied, retry and partial-success states. This first source pass is not that completed certification.

The existing three-destination mockup is a visual experiment. It does not supersede this coverage review and should not be treated as final scope.
