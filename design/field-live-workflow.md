> Latest revision: one territory chooser/creator/editor replaces the My territories / Someone new start choice. Use My targets / Explore with HCO / HCP tabs and one top Ask or search input. Both navigation variants use this same workspace. Specialty is separate from the assigned 123-code cohort; leakage/share retain the cohort while volume/opportunity/HCPs follow specialty. See [current QA](field-layout-review-qa.md) for verified behavior and mock boundaries. Older descriptions below are historical where they conflict.

# Live FieldPro + Field walkthrough — 28 October 2026

Discussion prototype only. This replaces the rejected territory-preview mock as the current review candidate. It does not approve a specification or change the app.

**29 October revision:** the exposed workflow stepper and Targets / Ask / Map navigation below are superseded. The mock now uses Field / Ask / History, a stable Route label, source action cards, an inline expandable run sheet and the supplied voice-first Ask layout. See `field-screen-review.md` for the current screen-by-screen findings and verification. Source data sections and integration limits below still apply.

## Source ownership

- [Live FieldPro](https://platform.docnexus.ai/field-pro?company=J%26J_MedTech): target/explore hierarchy, measured summary and period labels, code scope, territories, opportunity maps, shared account/provider pages and report entry points.
- [Live Field](https://platform.docnexus.ai/field/commercial?step=work): facility route order, individual calls, run sheet, pre-read, clinical/referral views, note, calendar draft and leakage form, next/back/Not today/Summary.
- [Dev website](https://doggowoofwoof.github.io/AppNexus/dev/demo/): question-first Ask, grouped suggestions, scope, evidence, ranked answers, follow-up questions, action suggestions, hands-free and spoken-answer controls. The prototype embeds the actual dev `demo/js/ask.js` parser/builders with its formatting/series helpers and a local sample-data adapter.
- Ottava ZIP/screenshots: visual theme only. Their older data sections are not the product specification.

## Screen and return-path mapping

| Surface | Source content retained | Phone treatment / selected additions |
|---|---|---|
| Targets | My HCOs, My HCPs, Explore HCOs, Explore HCPs; codes; procedures, share, YoY, stayed/left, opportunity, cumulative leaking dollars; search/filter/sort/export | Four source tabs; compact row metrics; visible territory creation; territory summary hidden while finding someone new |
| Starting scope | Territory selection and discovery | Only My territories / Someone new; no Saved lists, Everyone, My hospitals or configuration/upload-account screens |
| Territories | List/Map, search, State/ZIP coverage, creation, ZIP import and export | Name + states form; sample ZIP review; HCO/HCP membership separate from daily calls |
| Opportunity Map | Doctors/Hospitals, geography/radius/type/code scope, heat-layer choices | Shared selection and profiles; projected real Manhattan geography; illustrative heat layers |
| HCO | Account overview / HCPs at account; five scoped metrics; AI brief; mix; yearly volume; capacity; S2900; quarterly leakage; destinations; DRG loss; market share; robot/company payments; notes; referrals | Expanded cards with On this page navigation; same shared account page from targets, map and Work |
| HCO actions | Generate leakage report; Log a visit; Save as PDF; Export; View on a map | Report job/ready/Open/PDF return path; account map panel has Opportunity / Where cases go; own contextual Ask added |
| HCP | Claims/lightest weekday/top procedure/referrals; AI brief and email purpose; robot/company payments; primary information/hospital; nearby colleagues; procedures; affiliations; weekday activity; referrals; destinations; notes | Shared full-length source sections; Ask, territory assignment and route controls accompany the source actions |
| HCP actions | Log visit, PDF, export, email, full profile | Full provider record is a bounded preview, not a clone of the separate legacy provider platform |
| Route | Order the day, starting point, grouped facilities and individual calls | One Route page opens the first pre-read; no exposed stage stepper |
| Current visit | Run sheet; Log note / Leakage report / Book appointment; Overview / Clinical profile / Referral network; current clinician; Done next; Back one; Not today; End day | Run sheet and map expand inline; full profile returns to the same call; contextual Ask and alternative discovery stay grouped |
| Note | Interaction type, required text, topic, date | Dictation/improvement simulation, retained draft and optional outcome/follow-up; saving stays on the current pre-read and does not complete the call |
| Booking | Duration, day/time, invite email, agenda, Open invite | Calendar draft preview; no fabricated availability or booking confirmation |
| Report | Account/code/radius/title, generating, ready metadata, share/download/Open | Background continuation and PDF preview; report-specific Ask; no live job launched |
| Summary/history | Completed, remaining, skipped calls and dated interactions | Append records; follow-ups; tomorrow planning; visit context survives profile/report navigation |
| Ask | Actual dev intent/answer logic, multiple turns, entity resolution, facts, ranked lists, Do this, Ask next | Own app assistant; context from entity/visit/report; reviewed actions use manual controls; applying preparation returns to its call |

## Verification

Browser walkthroughs covered fresh targets, expanded HCO/HCP sections, account-map lenses and geographic paths, state/ZIP territory creation, route grouping and start, clinical pre-read, note save returning to that tab, full-profile return, background report continuation, ready report/PDF/Ask, booking draft, next/back between calls at one facility, Ask briefing and pronoun follow-up, applying preparation, explicit replacement selection/confirmation, Summary and next-day planning. The new fragment passes JavaScript syntax checking. Account/profile map, Ask, note and booking surfaces were measured at phone widths 320 and 430 where relevant; inspected content did not overflow horizontally. This is targeted prototype QA, not a full app regression or an integration test.

## Deliberate limits

- Fictional doctors and clinical/business amounts; public facility locations. No customer dataset copied from the ZIP or live session.
- AI answers are scripted by dev's engine; voice, dictation, report generation/PDF, export/share and calendar are simulations. No audio recorded, email sent, production note saved or report job created.
- Real static geography and approximate straight-line distances; no road routing, live location, travel-time guarantee, true ZIP choropleth or appointment availability.
- Territory assignment is a proposed local contract. The production membership/coverage adapter still needs reconciliation before implementation. No claim of verified endpoints for every mocked action.
- Full legacy provider modules and every source loading/error/data-size state are not cloned. Report source controls are reproduced with representative output, not a production report rendering engine.

## Files

- Review fragment: `design/mockups/field-live-workflow.html`.
- Inline conversation copy: thread visualization directory, same filename and content.
- Authoring helpers: `.assemble-live.py`, `.live-views.js`, `.live-theme.css` in `design/mockups/`. The assembler uses the prior mock only for common local state/form/map utilities, then replaces its visible screen hierarchy and injects dev Ask. The rejected mock remains unapproved.
- No app implementation, commit, deployment or push in this revision.
