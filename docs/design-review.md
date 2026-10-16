# Field Pro mobile design review

15 October 2026 · Supersedes the initial mockup's information hierarchy.

## What changed

The first concept gave an invented dollar opportunity the most visual weight, repeated metrics on every card and hid much of the real profile structure behind placeholders. The revised concept starts with account identity and a short, configurable row of measures. There is no aggregated money headline. Claims, patients, procedures, billed charges and realized revenue are distinct measures; none should silently substitute for another.

Two reviewable book layouts share the same information model: Account cards for scanning and a Working list for denser use. Display settings expose layout, spacing and visible fields. Host design controls also expose corner radius, card padding, heading style and selected field visibility. Customization here is a proposal; it is not an observed feature of the existing web application.

## Research applied

- [NN/g: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): retain common tasks up front and expose secondary detail through clearly named destinations. Applied as identity/contact/note actions, then People/Research/Data sections.
- [Smashing Magazine: A Comprehensive Guide to Mobile App Design](https://www.smashingmagazine.com/2018/02/comprehensive-guide-to-mobile-app-design/): reduce cognitive load, prioritize frequent navigation, maintain web/mobile consistency and preserve sensible Back behavior. Applied as four labeled destinations, compact filters, a back stack and preservation of note drafts while navigating.
- [Android Developers: accessibility defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults): interactive targets should be at least 48dp in native Compose and icons need appropriate semantics. Preview uses native HTML controls, visible labels and roughly 44–48px touch targets; final native implementation must follow the chosen platform's sizing and text scaling.

These are design hypotheses supported by guidance, not proof of usability. Validate with reps using tasks: find an assigned account, identify the relevant person, inspect source context, log a visit and resume a draft.

## Live inspection findings

Earlier loading failures were transient. On the second pass, the signed-in browser loaded Field Pro and both full profiles. UI observation verifies visible fields, not backend contracts or accuracy of individual records. No production list, note or CRM record was changed.

### Field Pro

Observed: Capital Sales, Clinical Sales, HEMA and Sales Enablement views; HCO/HCP switching; procedure-code groups; territory, state, city and type filters; name/claims sorting; pagination; target-list controls; routes, map, territories and reports links; CRM sync. The inspected book showed 101 accounts and 123 selected codes. Some claims cells were loading and leakage displayed an explicit unmeasured state. Those counts and settings are specific to the observed workspace, not hardcoded product defaults.

Reference: https://platform.docnexus.ai/field-pro

### Full HCP profile

Observed on NPI 1962515551: identity, specialty, city, primary organization, NPI, professional contact fields with verification marks, publications and clinical trial counts, payments total/count, biography, associated conditions, education/training, certifications, licenses, professional memberships and AI-enriched content labels. Profile navigation includes Publications, Clinical Trials, Payments, HCP Graphs, Multimedia, Social Media and CRM. Claims have a separate navigation group. Some displayed payment totals differ slightly across summary and table components, reinforcing the need to define a canonical source before reusing figures.

Reference: https://platform.docnexus.ai/providers/1962515551

### Full HCO profile

Observed on Mount Sinai Hospital: organization type/name, location, provider count, staffed beds, employee count, address, phone, website, active network status, HCPs/executive contacts with department/role and contact availability. Additional profile sections include Summary, KOLs, Clinical Trials, Activity, Quality, Financials and Reimbursements. Claims use a separate section group. No full backend mapping has been performed.

Reference: https://platform.docnexus.ai/healthcare-organization/4885603996736062548

## Field placement proposal

| Surface | Visible by default | Optional / secondary | Reason |
|---|---|---|---|
| Assigned HCO | Name, type, city/state; period-labeled claims and YoY when measured | Health system, latest note; deeper metrics inside profile | Identify account, compare relevant scale, prepare next action |
| Assigned HCP | Name, specialty, city/state and primary affiliation | Research counts and latest note | Identify person without ranking every provider by research output |
| HCO overview | Identity, location, system; Log visit/Contact; scoped claims snapshot; basic account details | People, procedure mix, leakage, network/capacity, quality/financials | Preserve a short first screen with direct routes to detail |
| HCO people | HCPs and executives, role/department, work-contact availability | Paginated records and contact detail | People are a visit-preparation task, not a capacity KPI |
| HCP overview | Name, specialty, affiliation, NPI; Log visit/Contact | Biography/conditions, training, certifications | Make identity and relationship context accessible first |
| HCP research | Publications/trials summary and links to their records | Education, memberships, multimedia/social presence as needed | Preserve profile breadth without a wall of facts on the default screen |
| HCP data | Medical/pharmacy claims and industry payments with period/source | Provider graphs, product/company breakdowns | Keep clinical activity separate from research and commercial relationships |
| Visit note | Entity context, visit type, note, save state | CRM destination/mapping review | Never imply a remote save or successful sync from a local draft |

## Data rules

1. Missing, unavailable, loading and zero are different states.
2. Every measure needs a source, period, scope/code group and definition. Recent incomplete periods must be labeled.
3. An account's leakage percentage must not appear as the HCP's own leakage.
4. Show AI enrichment explicitly where the web does; avoid converting generated biographies or inferences into verified claims.
5. Role/team controls alter the workspace context; display preferences only alter presentation. The concept does not claim role switching is implemented.
6. Hide unsupported sections rather than prefill them with fabricated values in production.

The visualization uses a sample book combining reference identities for navigation. It does not reproduce the user's actual assignment. Claims values are illustrative and marked as such; HCP research counts are a dated observation of the reference profile. Contact records are not copied into the concept. Notes remain in memory; no API, CRM or report generation is connected.

## Next integration checks

Inspect the existing repositories and sanitize response examples before mapping fields. Confirm canonical metrics, permissions and contact provenance. Test the revised hierarchy with reps, then select the default density and fields. Keep configurable book fields schema-driven, route entity types by stable IDs and make display preferences independent of authentication and workspace settings.

## Preview verification

Browser checks verified switching to a list layout, hiding claims volume and showing health system; HCO → People → HCP → Research navigation; note creation and edit restoration. A 320px browser viewport produced a roughly 273px inner preview with no horizontal overflow. The default dark appearance was visually inspected. Light appearance follows the supplied light palette; no independent light-mode screenshot was captured. Host Tweak/carousel rendering cannot be exercised in the standalone wrapper, but the matching helper contracts are used.
