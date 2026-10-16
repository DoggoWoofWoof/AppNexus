# HCP / HCO field inventory — full profile vs Field Pro limited view

16 October 2026 · Source-grounded. Read alongside `repository-feature-map.md` and
`plan-status-and-endpoint-audit.md`. Paths below are relative to the local
read-only clones in `reference/repos/` (ignored by git, never pushed).

## Decision recap (from team thread)

- Field Pro is the app landing: assigned book, admin-configured (DocNexus Admin →
  Field Pro tab). No new Field Pro endpoints.
- Full HCP/HCO data comes from **existing Advanced Search endpoints directly**,
  not via a Field Pro gateway. HCP/HCO search subset only — not full Advanced
  Search (revisit if Mahek asks).
- Field Pro shows a **limited, claims-scoped** slice; the full profile pages are
  separate destinations.

## HCP — 18 full-profile tabs

Source: `docnexus-frontend/src/config/profileTabs.config.ts:48-67` (`PROFILE_TABS`).
`overview` is always-on; the other 17 are persona-controllable. Team Admin toggles
live in Feature Control; `Profile.tsx` enforces the allow-list at render.

| # | Tab id | Label | Mobile destination (proposed) |
|---|---|---|---|
| 1 | `overview` | Overview | HCP overview (always-on anchor) |
| 2 | `profileSummary` | Profile | Overview → identity, biography, training, credentials |
| 3 | `publications` | Publications | Research → Publications |
| 4 | `clinicalTrials` | Clinical Trials | Research → Clinical trials |
| 5 | `payments` | Payments | Industry → Payments (CMS Open Payments) |
| 6 | `hcpGraphs` | HCP Graphs | Relationships → graphs |
| 7 | `multimedia` | Multimedia | Professional activity → multimedia |
| 8 | `socialMedia` | Social Media | Professional activity → social |
| 9 | `notes` | Notes | Activity / CRM |
| 10 | `diagnosis` | Diagnosis | Clinical & claims → diagnosis |
| 11 | `procedure` | Procedure | Clinical & claims → procedure |
| 12 | `payerMix` | Payer Mix | Clinical & claims → payer mix |
| 13 | `referrals` | Referrals | Clinical & claims → referrals |
| 14 | `prescriptions` | Prescriptions | Clinical & claims → prescriptions |
| 15 | `conferences` | Conferences | Professional activity → conferences |
| 16 | `affiliations` | Affiliations | Affiliations |
| 17 | `sdoh` | SDOH | Clinical & claims → SDOH |
| 18 | `crm` | CRM | Activity → CRM |

## HCO — section set varies by entity type

Source: `hospital-health-system-views/src/pages/Index.tsx:317-383`.
Organizations always show the base set; `summary`/`quality`/`financials`/
`reimbursements` appear only with Definitive data (or claims summary for Summary).
`hospitals` appears for IDN/health-system entities; `clinical` only for
non-health-system hospitals.

Base (all organizations): HCPs/executives, KOLs, Clinical Trials, Activity,
Diagnosis, Procedure, Prescription, Affiliations, Payer Mix, Remittance,
Referrals, Technologies.
Gated: Summary, Quality, Financials, Reimbursements, Hospitals/Clinical, Media.

## What Field Pro shows (limited, claims-scoped)

Source: `docnexus-frontend/src/pages/Dashboard/AccountWorkspace/`.

### Surgeon/HCP view (`components/SurgeonView.tsx`)

- Header: avatar, `specialty + NPI`, top site + city/state + code-group + window.
- 5-row Primary information only: NPI, practice city/state, top-2 specialties,
  first work email, practice phone (`SurgeonView.tsx:905-953`).
- KPI strip scoped to rep's code group + window: volume vs prior + YoY, busiest
  weekday, top code + share, referrals in/out (`:708-776`).
- Top-6 procedure mix, top sites/weekdays (all-claims sources, labeled as such).
- Referral network, payer mix, payments aggregate, research aggregates
  (papers/h-index/latest, trials/phases), primary-hospital card, cases-kept
  card (`HcpCasesCard.tsx`), competitive mix (only with own drugs).
- Actions: Log a visit, Add to territory, Save PDF, Email (first email), Full
  profile link → `/providers/{npi}`.

### Account/HCO view (`components/AccountView.tsx`)

- Header: type/state/parent, city + group + code count + window + NPI scope,
  link to full organization page (`:1615-1681`).
- KPIs: procedures in window + YoY, share leaving, billed-charges opportunity,
  in-radius share, leaking charges (`:1233-1332`).
- Cards: yearly/quarterly volume, destinations, DRG case loss, HCPs-here rows,
  team notes, market, procedure/diagnosis mix, capacity, finances, robotic
  (S2900 only), payers, referrals, payments (top HCPs), HEMA workbench slices.
- `technology` is never listed (`lib/registry.ts:9-14`).

### Visit note (`components/VisitModal.tsx`, `lib/visit.ts`)

- One `Dynamo.put.Notes` **per picked doctor** — no account-level note store.
- Payload: `npiNumber, typeOfInteraction, topic, notes, noteDate, entryType:note`
  (max 2000 chars). Account passes top-8 shown doctors; surgeon passes self.

## Explicitly NOT in Field Pro (open full profile instead)

- Full biography, education, residency, boards, credentials, full address book,
  secondary emails/phones, full affiliation roster (top-4 sites shown),
  publication/trial/payment record detail (aggregates only), any volume outside
  the rep's code group + window, rank/book-share, technology share, drug-only
  referral/payer detail. Truncation is the norm (mix 6/15, sites 4/8, HCPs 8).

## Wiring implication

Mobile client needs two adapters: (a) Field Pro workspace/book + scoped
claims/brief endpoints for the landing and Brief screens; (b) Advanced Search
profile endpoints for the 18 HCP tabs and HCO sections, gated by persona +
entity availability. Never present a Field Pro aggregate as a full-profile fact.
