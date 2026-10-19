# Field Pro app: product scope

## Who it is for

The primary user is a **field sales rep** covering a territory of hospitals, practices and physicians. Their week is mostly visits, and the gaps between them are short: a car park, a corridor, a waiting room.

Secondary users:

- **Managers**, who want to see that the right accounts are being covered.
- **Clinical specialists**, who join visits and need the same brief.

## The jobs the app does

Each job is a flow the prototype can walk through end to end. Together they make one loop: **plan → book → prepare → visit → log**, with **cancel → replace** when a doctor drops out.

| Job | When it happens | Flow in the prototype |
| --- | --- | --- |
| Decide who to see | Evening before, or first thing | **Today → Who to see** (the top of the Targets list, same rows), or **Targets** with signal filters → select several → **Review plan** → save |
| Book a time | When planning, or when the office moves a visit | **Book a time** on a profile, or **Visit options → Reschedule**. Suggested times fall inside the person's own windows and skip clashes with the plan. The sheet says who to book through. The visit shows **Requested** until the rep taps **Mark confirmed**. |
| Fill a gap | A doctor cancels | **Visit options → Cancel visit** → reason. For a timed visit, **Targets** opens straight away with the usual search and distance, nearest to the cancelled site first. People already planned that day, and the person who cancelled, are left out. **+ 10:00** on a row puts them in the slot as a requested visit and goes back to Today. Undo puts it back; **Leave it free** keeps the gap. |
| Prepare in a minute | Walking in | **Today → Prepare** opens the profile. The first card is the brief: why now, the best time and who to book through, the goal, up to three talking points and open follow-ups. **Copy brief** gives the same as plain text. Volumes, referrals and the last notes follow. |
| Answer a question | Any time, often hands busy | **Ask**: type, tap the mic, or use **Hands-free**. You get a ranked answer, one "Do this", and follow-up questions. |
| Record the visit | Straight after | **Log visit**: choose what happened (nothing is pre-selected), then a note, attendees and a follow-up in one sheet. **Speak** turns speech into the note text, and the record is marked as spoken. Drafts survive closing the app. |
| Keep promises | Through the week | **Activity → To do** groups follow-ups into Overdue, Due today and Coming up. **Journal** keeps the history. |
| Understand the territory | Weekly | **Insights**: your own coverage (logged in the last 7 days, people seen, open follow-ups), where patients leave the system, top outside destinations, and rising and declining HCPs |

## The website and the app

They do different jobs. The app should not try to be a small copy of the website.

| On the website today | In the app |
| --- | --- |
| Ask anything / search accounts and HCPs | **Ask tab and Targets search.** Ask answers in one sentence with ranked figures and a next step, and can be spoken. |
| Targets list and account pages | **Targets plus HCP and HCO profiles**, reorganised around "why see them now" and the next action |
| Route planner, Opportunity Map | **Today's route map and the Targets map.** Planning starts from people, then orders the stops. |
| Account KPIs: procedures, cases that left, opportunity, in-radius share | **HCO Overview and Volumes**, and **Leakage** with top destinations |
| Log a visit | **Log visit sheet**, offline-first, with the follow-up in the same step |
| Generate leakage report, Save as PDF | **Coming later** (labelled as such in the app) |
| Territories, Reports, team and book management | **Stays on the web.** These are desk and admin tasks. |
| Sync to CRM | **Coming later.** Notes stay on the device for now. |
| "View as" for each sales team (capital, clinical and others) | **Not shown.** The app is set up for the rep's team by the company configuration. |

## Profiles

### HCP profile

| Asked for | Where it is |
| --- | --- |
| Identity, specialty, location, contact | **Overview:** header, details, and contact with copy buttons |
| Associated HCOs and practice locations | **Affiliations:** share of cases by organisation, each linking to the HCO |
| Procedure and diagnosis volumes with trends | **Volumes:** a switch between procedures and diagnoses, quarterly bars, and growth year over year |
| Referrals and professional relationships | **Referrals:** who refers to them, where they refer, and professional relationships |
| Notes and previous interactions | **Activity:** a timeline of visits and notes, plus open follow-ups |
| Add note, create follow-up | **Actions in the header**, and from every visit |

### HCO profile

| Asked for | Where it is |
| --- | --- |
| Organisation type and location | **Overview:** type, ownership, parent, phone, address and a location map |
| Parent health system and child facilities | **Network:** a tree from the system down to its facilities |
| Key HCPs and executives | **People:** HCPs by volume, and executives with their buying role |
| Volumes | **Volumes:** procedures and diagnoses, with trends |
| Leakage summary and top destinations | **Leakage:** share of cases that left, and where they went |
| Notes and interactions | **Activity** |
| Add note, create follow-up | **Actions in the header** |

## Quality bar for each screen

These were the review points for this round. The prototype now meets them, and the production app should keep meeting them.

- **Back** returns to exactly where you were: search text, filters, tab and scroll position.
- **Every button works.** A button that can't yet is disabled and says "Coming later".
- **Every data view has a loading, empty, offline and error state.** Use **Preview settings → Network** to see them.
- **Every layout works:**
  - at phone width and at wide width;
  - at 200% text;
  - in light and dark themes.
- **The language is plain.** It names the action ("Log visit", "Review plan") rather than the feature.
