# AppNexus · docnexus Field App

[Open the field app design](https://doggowoofwoof.github.io/AppNexus/design/)

The docnexus Field App is one app for both DocNexus products: Field Pro (the book of accounts and doctors, the opportunity map, claims) and Insights (logging what doctors say). Every customer gets the same flow; each account shows only the fields that customer uses.

## The design

- **Pick a customer account** in the left panel. Ottava is a Field Pro customer; Stemline, Kura Oncology, BeOne Medicines, Targeted Oncology and Gilead Sciences use Insights.
- **Tabs:** Targets, Ask, Map (Field Pro only) and Activity.
- **The centre button records straight away.** When you stop, tag who was there: one doctor, a group, or a conference session. For an account with Record turned off it opens Add insight instead.
- **Every Insight button opens the same sheet,** with Notes, Upload and Record.
- **Activity** holds insights, follow-ups and Summaries.

| Account | Record | What its sheet adds or drops |
|---|---|---|
| Ottava | Yes | Field Pro screens; advocacy 1–5 |
| Stemline | No | Insight or Note; topics with subtopics; Live or Virtual; no tags; syncs to Veeva |
| Kura Oncology | Yes | Named advocacy scores; five fixed topics; short meeting-type list |
| BeOne Medicines | Yes | Therapeutic area (CLL or MCL) first, which picks the topics |
| Targeted Oncology | Yes | No fixed topics; Live or Virtual |
| Gilead Sciences | Yes | Stage and priority; its own meeting types |

The left panel also lists what to check when the endpoints are wired.

The design is one HTML page, [design/index.html](design/index.html), run by `design/support.js`, which loads React from unpkg. To view it locally, serve the folder and open `http://localhost:8000/design/`.

## The earlier prototype

[Open the earlier prototype](https://doggowoofwoof.github.io/AppNexus/demo/), which is plain HTML on sample data. The React Native (Expo) app is in [mobile/](mobile/README.md); its web build is at [/app/](https://doggowoofwoof.github.io/AppNexus/app/).

The prototype covers the day itself:

- **Plan** who to see, from a ranked list of people and accounts worth visiting.
- **Prepare** for each visit in under a minute, using the profile and the "why now" signal.
- **Ask** questions about the territory by typing or speaking, and get a ranked answer with one next step.
- **Log** what happened and set the follow-up before walking into the next building.

### What to try

1. **Today.** See the day's plan with fixed-time and flexible visits, the next stop, the route map, follow-ups due and suggested people to see.
2. **Targets.** Search people and accounts, filter by signal (leakage risk, rising volume, follow-up due, not seen in 30 days), and switch between list and map. Select several targets, then **Review plan** to set times, reorder and save them as one plan. Back keeps your search, filters and tab.
3. **Profiles.**
   - **HCP:** identity, specialty, contact, practice locations, volumes with trends, referrals, notes and visits.
   - **HCO:** organization type, parent system and child facilities, key people and executives, volumes, leakage with top destinations, notes and visits.
   - Both have **Add note** and **New follow-up**.
4. **Ask** (centre tab).
   - Try "What has declined?" or "Which accounts are leaking the most?".
   - Then try "Brief me on Dr. Maya Patel", followed by "Where does she refer?".
   - Tap the mic to speak, or turn on **Hands-free** for a spoken back-and-forth.
5. **Activity.**
   - **To do:** follow-ups by due date, plus unfinished notes to resume.
   - **Journal:** every logged visit and note, searchable.
6. **Insights.** A territory view of where patients leave the system, and which HCPs are rising or declining.

#### Preview settings

The bar above the device frame switches:

- **View:** Phone or Wide screen (tablet and desktop layout).
- **Text:** 100% or 200%, for checking large-text layouts.
- **Theme:** System, Light or Dark.
- **Network:** Normal, Slow network, Offline or Server errors, to see the loading, offline and error states.
- **Reset sample data.**

Everything you change is saved in this browser only.

### Run it locally

No install or build step is needed. Serve the folder and open `http://localhost:8000/demo/`:

```bash
python -m http.server 8000
```

### Test

The tests need Node 22 or later and have no dependencies.

They cover:

- planning rules;
- search and filters;
- storage and navigation;
- the mock API;
- every Ask starter question;
- rendering every screen, profile tab and sheet.

The render tests also check that every button is wired to a real action, or is disabled with a reason.

```bash
npm test
```

GitHub Actions runs the same checks on every push, plus the mobile app's typecheck, lint and tests.

### How it is built

The prototype is plain HTML, CSS and JavaScript modules with no framework and no build step, so anyone can open it and read it.

```
design/             the field app design: one page and its runtime
demo/
  index.html        preview settings and the device frame
  css/              tokens (colour, type, spacing) → app shell → screens → preview frame
  js/main.js        entry point and preview settings
  js/app.js         shell: navigation stacks, loading states, sheets, toasts, focus
  js/actions.js     every user action by name (buttons use data-action)
  js/screens/       Today, Targets, Ask, Activity, Insights, HCP, HCO, plan review
  js/sheets.js      log visit, follow-up, filters, visit options, contact, account
  js/ask.js         the Ask answer engine (sample data)
  js/voice.js       speech to text, read aloud, hands-free loop
  js/data/          sample people and accounts, seeded relative to today
  data/             Manhattan map outline for the route and target maps
tests/              node --test suites
mobile/             the React Native (Expo) app; see mobile/README.md
docs/               product scope, Ask and voice, integration plan
```

The production app is **React Native (Expo)**, in [mobile/](mobile/README.md). The screens, actions and data shapes here are meant to carry straight across; see [docs/integration.md](docs/integration.md).

## Status and data

- **These are prototypes.** They have no login and no live DocNexus data. CRM sync and PDF reports are not connected; the app labels them "Coming later".
- **The answers are scripted.** Ask works things out from the sample figures on the device; in production it will call the DocNexus Ask service.
- **The people are fictional.** Customer account names, facility names and map locations are real; all doctors, volumes, referrals and activity are made up.
- **Keep internal material out of this repository; it is public.** That includes customer exports, design files that contain real physician names, and backend notes. They live in the git-ignored `reference/` folder.

## More

- [Product scope: users, flows, and the website vs the app](docs/product.md)
- [Ask and voice: what is built and the path to a live voice mode](docs/ask-and-voice.md)
- [Integration plan: React Native, data services and design system](docs/integration.md)
