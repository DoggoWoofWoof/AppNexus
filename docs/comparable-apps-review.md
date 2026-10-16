# Comparable apps and daily-flow gaps

Research date: 15 October 2026, Asia/Calcutta. Official product/help sources reviewed. This is a documentation comparison, not a hands-on trial or proof of usability. Platform, license and customer configuration can affect availability. Vendor performance, AI effectiveness and compliance marketing claims have not been adopted as facts about our app.

Read alongside `repository-feature-map.md` and `sales-rep-daily-flow.md`. A feature can already exist in a repository while still being underspecified in the proposed daily flow. Candidate additions below have not automatically become committed build scope.

## Relevant comparables

| Product | Documented pattern | Implication for our flow |
|---|---|---|
| [Map My Customers — mobile planner](https://hs.mapmycustomers.me/en/support/smart-planner-1) | Mobile activities can be completed, postponed, opened against their related record and annotated; planner dates and map view connect planning with history. | Today can be the working entry while My targets and full profiles remain reachable. |
| [Map My Customers — Smart Planner](https://hs.mapmycustomers.me/en/support/using-the-planner-1) | Suggestions include nearby records, accounts approaching their contact frequency and gaps in the agenda. | Proximity, revisit need and available time should be separate inputs. |
| [Map My Customers — product FAQ](https://mapmycustomers.com/faq) | The vendor describes offline account/activity use, visit-frequency flags and healthcare provider/claims enrichment. | A close comparator for joining healthcare intelligence with daily field work; offline reading deserves attention alongside note capture. |
| [Badger Maps — features](https://www.badgermapping.com/features/) | Routing is combined with appointment lengths/times, lateness alerts, saved routes, start/end places, nearby suggestions, reminders and a simplified route mode. | Make travel practical and keep the active-day view focused; future/reusable plans are a separate need from today's route. |
| [Salesforce Maps Advanced — visit windows](https://help.salesforce.com/s/articleView?id=000362663&language=en_US&type=1) and [visit constraints](https://help.salesforce.com/s/articleView?id=sf.salesforce_maps_adv_visitplan_options.htm&language=en_US&type=5) | Plans can account for customer visit windows, workday length, visit spacing and travel limits. The documented window rule constrains visit start, rather than guaranteeing that the entire visit fits. | We must define our own full-visit, travel and buffer constraints explicitly. |
| [Veeva Vault CRM — call planning](https://vaultcrmhelp.veeva.com/doc/Content/CRM_topics/CallPlanning/CPOverview.htm) and [Engage brief](https://www.veeva.com/resources/veeva-crm-engage-datasheet/) | Scheduling connects account context with planned activities. Engage describes HCP-provided availability/channel preferences and office policies. | Clinical data, operating weekdays, office access and actual meeting availability are different kinds of information. |
| [RepMove — AI assistant](https://repmove.app/ai-sales-assistant/) | The vendor describes voice notes, structured summaries, follow-up drafting and CRM/deal updates in the field workflow. | Capture should lead to an explicit next step, with the original discussion and rep review preserved. |
| [IQVIA — Next Best Action](https://www.iqvia.com/solutions/commercialization/commercial-analytics/orchestrated-analytics/next-best) | Recommendations consider customer, channel, message and contact cadence, using rules and/or ML. | A useful suggestion is a proposed action with context, not merely an account sorted by distance or claim volume. Start with rules grounded in available data. |

## What is already covered

The agreed flow already includes assigned targets, full HCP/HCO profiles, mixed fixed/flexible agendas, map/list discovery, route planning, visit outcomes, capture, follow-ups, visible save/sync states, and the deeper reports/Insights/role-specific features. Those are foundations to connect and validate, not newly discovered omissions.

The following are design/product gaps or refinements. They do not assert that every related service is absent from all repositories.

## Candidate improvements

| ID | Gap or refinement | Proposed behavior and example | Current evidence/status | Priority |
|---|---|---|---|---|
| CG01 | Visit feasibility | Use workday start/end, optional visit duration, known office visit windows, travel and a configurable buffer. If a stop does not fit, explain the conflict. | Mixed timed/flexible planning accepted; these constraints are not fully specified. Salesforce visit-window/constraint docs inform the pattern. | Specify before next planner mockup |
| CG02 | Contact cadence and balanced coverage | Allow admin/rep-configured revisit frequency where supported. Surface due/overdue targets; consider actual recent contact and territory coverage. Missing history remains unknown, and an attempted visit need not reset a successful-contact cadence. | Follow-ups exist; a recurring coverage policy and canonical cross-source history are unverified. Map My Customers planner/frequency documentation informs this addition. | Specify rules now; validate data before promising ranking |
| CG03 | Recovery when plans change | A cancellation exposes optional alternatives that fit the actual free window and route. Lock fixed commitments. Offer replacement, remote follow-up or leaving the gap open; do not silently refill every minute. | Reordering and skipping are planned; gap-aware alternatives need added behavior and feasibility checks. Smart Planner suggests the opportunity; these control rules are our proposal. | Include cancellation case in next mockup |
| CG04 | Correct site and campus grouping | Select the HCP's intended practice address. Group several HCP visits at one HCO into one travel stop while retaining separate meetings/outcomes. Show access notes if known. | Multiple affiliations and visit-person selection exist. Appointment-specific site, access-note provenance and campus grouping need validation/design. This grouping is our inference from our HCP/HCO model. | Specify before routing implementation |
| CG05 | Prepared offline work | Cache the selected day's brief, contact/site information, last relevant interaction and selected report documents, with last-updated and download state. Keep online-only research clearly identified. | Draft recovery exists; a complete offline day pack is not established. Veeva's [mobile sync documentation](https://vaultcrmhelp.veeva.com/doc/Content/CRM_topics/Getting_Started/MobileDeviceSetup/Sync/SyncOverview.htm) distinguishes data download and pending uploads. | Define offline minimum now |
| CG06 | Promises and follow-up ownership | From a reviewed note such as a promise to send an account report, propose a task with due date, owner and relevant document. Track unresolved work through completion. Draft communication for review when a supported channel exists. | Capture/follow-ups/documents exist separately. Joining a specific promise to owner, artifact and completion needs explicit design. RepMove illustrates the capture-to-follow-up pattern. | Include in visit review |
| CG07 | Future plans, history and calendar boundaries | Add Tomorrow and date selection, preserve prior outcomes, and later offer reusable weekly plans. Keep imported calendar events linked to their source so resync does not duplicate items. | Reviewed Field Pro route storage is local and date-scoped. Durable history/future plans and calendar integration are not established. Badger saved routes and the mobile planner provide useful references. | Specify storage boundary now; stage integration separately |
| CG08 | Engagement preferences and contact eligibility | Display known preferred channel, access restrictions and applicable company-managed opt-out status before suggesting outreach. Unknown remains unknown. Direct sending must use the actual supported customer integration. | Current contact/CRM availability does not establish a complete preference model. Veeva Engage and [Approved Email consent configuration](https://vaultcrmhelp.veeva.com/doc/Content/CRM_topics/Multichannel/ApprovedEmail/ManagingContent/SetConsentEmailTemplate.htm) show product patterns, not legal rules to copy. | Establish source before adding outbound automation |
| CG09 | Useful feedback on suggestions | Support reasons such as Wrong location, Already contacted, Not relevant and Later. Explain the data behind a suggestion. Do not treat rejection as evidence that the underlying HCP profile is wrong. | Basic dismiss-for-today is proposed; reasoned feedback and policy effects need design. IQVIA provides a recommendation context; these interaction rules are ours. | Include lightweight feedback |
| CG10 | Team context and corrections | Show authorized account ownership/recent team touch where available; provide report-a-correction and handoff actions. A field correction is not automatically a verified source-data change. | Manager/assignment features exist; cross-team interaction projection, correction ownership and authoritative write rules need verification. This is a data-workflow inference. | Specify identity/source rules; stage UI |

## Implications for the next mockup

Keep the small Today surface and show the refinements in context:

1. **Unplanned morning:** a short list of suggestions carrying distinct relevance, cadence and proximity reasons; persistent My targets entry. Where inputs are unavailable, do not invent a score or elapsed-since-contact value.
2. **Day review:** a timed appointment plus flexible visits/calls, visit-duration/buffer treatment and a conflict example; the actual selected HCP site is visible.
3. **Cancellation:** one action reveals feasible options and preserves fixed commitments.
4. **Preparation:** a compact brief with history and outstanding promises; show whether it is available offline and when it was updated.
5. **After the visit:** a short outcome/capture flow leading to accepted follow-ups, attached report references and separate saved/CRM states.

This leaves existing full profiles, maps, HEMA, reports and Insights accessible through their named destinations. The candidate improvements mostly affect the transitions between those capabilities.

## Useful extras to assess later

Approved collateral/version-aware sharing, live calendar booking, recurring route templates, business-card scanning, mileage/expenses, samples/inventory/signatures and deeper manager coaching may matter for particular customers. None is established as a universal need by our brief. Do not add a new top-level navigation item for each competitor feature. Existing agreed product coverage remains intact while these additions are evaluated.

GPS presence should remain distinct from a completed meeting. A missed visit and a completed visit with an unfinished note are also different states. These are proposed workflow semantics, not claims about a competitor's verification accuracy.

## Validation after the source review

Test a small set of scenarios with a rep or a customer-facing teammate when available: a new day, two HCPs at the same hospital, a physician at multiple sites, a cancelled appointment, no connectivity, interrupted capture, an already-contacted suggestion and a failed CRM sync. The user has already selected a mixed-day model; further sales-domain uncertainty should not block the next mockup.

The reviewed vendor pages support feature existence claims. They do not establish that a particular interaction is easy, that recommendation quality is high, or that our existing APIs can support it. Those require product testing and contract verification.
