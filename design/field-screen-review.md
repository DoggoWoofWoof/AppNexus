> Latest workspace review: discovery is Explore in the selected territory, with a single chooser/creator/editor and one shared Ask or search input. My targets / Explore and HCO / HCP tabs replace the older four-button block. Identity image left, route selection right. See [latest QA](field-layout-review-qa.md) for cohort semantics and both navigation variants.

# Screen review and correction — 29 October 2026

The user rejected the previous mock's exposed workflow stages, changing Route label, text-link clutter and Ask presentation. This review supersedes those design choices. Only the clickable mock is revised; app implementation remains unauthorized.

## References and precedence

1. The five screenshots supplied on 29 October define the requested mobile navigation, voice-first Ask and contained action styling.
2. Current FieldPro defines target/exploration groups, specialty/code scope, territories, map filters, profile fields and account/provider actions.
3. Current Field defines the route sequence and one-HCP-at-a-time execution, with run sheet, preparation, Log note, Leakage report, Book appointment, next/back, Not today and End the day.
4. Dev WEBSITE Ask supplies the existing answer/intent logic, conversation, evidence, contextual preparation, hands-free and spoken-answer behavior. Its currently published visual layout differs from the supplied older voice-first screenshot; the user's screenshot takes precedence for presentation.
5. The Ottava archive remains a theme reference only. Its old data sections are not copied as the current product specification.

## Screen-by-screen findings

| Screen | What was wrong | Source / user reference | Corrected mock |
|---|---|---|---|
| App shell | Targets / Ask / Map elevated a view into navigation; a five-step progress strip introduced extra app stages | User screenshot: Field / raised central Ask / History | Exactly those three bottom items. Map remains a Field tool. No workflow stepper on Route or visit pages |
| Field home | Route changed to Resume work; territory/create/filter actions competed as loose links | FieldPro search, navigation, Specialty, measured summary and target groups | Fixed Route and Map shortcuts below search; current territory opens scope. Territory management lives with target tools. Source summary periods retained |
| Target groups | Four equal tabs flattened FieldPro's two related groups | Live FieldPro: My HCOs / My HCPs in one group, Explore HCOs / Explore HCPs in another | Two labeled groups, with all four source choices and shared filters/code scope. No reintroduced Saved lists / Everyone / My hospitals starting choices |
| Specialty/code scope | Compressed scopes were disconnected from the profiles and discovery context | FieldPro Specialty chips and code viewer | Source specialty names; More specialties opens the complete sample group selector. Applied scope carries through results, profiles, maps and reports. The mock contains representative code rows, not the live 123-code dataset |
| Territory selection/creation | Controls scattered between home links and cards | Live Territories: List/Map, All/States/ZIP, create, upload ZIP, export; Name + States form | One Territories screen and reusable creation form. Membership remains separate from today's selected calls |
| Discovery / Map | Bottom navigation implied Map was a separate product workflow | Live Opportunity Map: Accounts/Doctors, type, nearby origin/radius, geography, heat-map lenses | Accessible from Field's Map control; keeps the existing scope and common profile entry points. Static geographic data remains a mock limitation |
| HCO | Profile action links lacked the visual weight of real controls | FieldPro Account overview / HCPs at account, source report/PDF/export/map actions; user's action-card example | Icon-and-label action cards plus a compact secondary action row. Existing expanded account sections retained. Account-specific map keeps Opportunity / Where cases go |
| HCP | Identity, target management, prep and other actions appeared as disconnected text | FieldPro HCP identity, contact/actions and expanded evidence sections | Identity and scope metadata grouped; core actions in cards; target assignment/removal/route actions collected in Profile actions. Contextual Ask stays with the profile |
| Route | Scope → Plan → Route → Work → Summary appeared as an extra navigation system; “Step 3” and duplicate call listings added noise | Source route orders facility stops before the first pre-read; user explicitly rejects exposing stages | One Your route page: start, dated plan, ordered facility stops, individual calls, map, Start visits / Continue visits. Shortcut and header remain Route |
| Current visit | Multiple Ask/prep/full-profile/alternative text links competed with core visit actions | Source run sheet alongside HCP identity, three actions, evidence card and pre-read tabs | Expandable run sheet with clinicians/map; one identity block; Log note / Leakage report / Book appointment cards; bounded evidence and secondary controls; source Overview / Clinical profile / Referral network |
| Visit navigation | Changing labels and extra screens obscured the one-by-one loop | Field: Done next, Back one, Not today, End the day | Same actions, grouped in a compact footer. Next/back changes the clinician at the current facility before advancing. First-call Back is disabled |
| Log note | Main action was visually lost amongst generic controls | Field note type/text/topic/date form; requested voice improvements | Same form with Dictate and Improve note. Save stays on the active pre-read tab. Logging does not itself complete a visit |
| Leakage report | Source action diluted into plain links | Account report generation and Field hospital/group/title/radius form | Distinct action card; same scoped form in the visit; shared generating/ready/report-preview flow. Back returns to the originating profile/call |
| Appointment | Needed to preserve the actual calendar handoff | Field duration/date/time/email/agenda + Open invite | Same form and draft preview. No invented doctor availability or confirmed booking |
| Ask entry | Reproduced dev's current grouped starter view despite the user's preferred voice-first screen | Supplied Ask screenshot: four rounded questions, large mic, Tap and talk, typed field | That presentation, with dev's real intent/answer builders underneath; hands-free and speaker controls retained quietly below the input |
| Ask results | Actions and evidence needed context without extra destination screens | Dev answer facts/rankings, Do this, Ask next and full profile links | Multiple turns, pronoun context, ranked results, same manual action forms; preparation applies back to the current call. Clearing conversation prevents pending replies from resurrecting it |
| History | Activity naming and a generic Log visit for a hardcoded doctor were confusing | Supplied History navigation; requested dated visit records/follow-ups | History opens Visit records, alongside Follow-ups. Each record contains identity/date/type/outcome/note and contained Profile / Edit / Ask / Transcript controls; no arbitrary log action |
| Day end | Summary was presented as an always-visible stage | Field End the day → review | Day summary is reached when ending/reviewing the route; not an app navigation item |

## Current verification

Live sites were reopened for FieldPro home/grouping, exploration requirements, Specialty choices, Territories and its unsaved creation form, Opportunity Map controls, HCP actions and Field's run-sheet/pre-read composition. No live notes, territories, reports or invitations were saved.

The revised mock was walked through Route → first HCP → next colleague → back, clinical tab → note save → same tab, full profile → same call, fixed Route label after starting, territory creation → exploration, HCO report → Ask, History → dated-note Ask, simulated voice and fresh Ask queries. The weekly prompt resolves to dated records and follow-ups; a fresh briefing resolves the selected clinician. No workflow stepper remains in rendered Route/visit content. Inspected Route, visit, HCP, Ask and forms fit the 320px phone width; Ask was also measured at 430px. JavaScript syntax checking passed and the browser reported no script errors.

This is a source-informed mobile mock with fictional records, not pixel-perfect web parity or a production integration audit. Real AI/audio, road routing, report rendering, exports, sharing and calendar delivery remain mocked. Separate legacy full-provider modules remain outside the mock. Detailed source card inventory and existing limits are in `field-live-workflow.md`.
