# AppNexus · Field Pro

[Open the clickable prototype](https://doggowoofwoof.github.io/AppNexus/)

Field Pro is the DocNexus app for medical device sales reps in the field. The website is where a rep or manager does deep analysis at a desk. The app is for the day itself:

- **Plan** who to see, from a ranked list of people and accounts worth visiting.
- **Prepare** for each visit in under a minute, using the profile and the "why now" signal.
- **Ask** questions about the territory by typing or speaking, and get a ranked answer with one next step.
- **Log** what happened and set the follow-up before walking into the next building.

This repository holds a clickable prototype of that app. It runs in the browser on sample data, so the flows can be reviewed before the React Native build starts.

## What to try

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

### Preview settings

The bar above the device frame switches:

- **View:** Phone or Wide screen (tablet and desktop layout).
- **Text:** 100% or 200%, for checking large-text layouts.
- **Theme:** System, Light or Dark.
- **Network:** Normal, Slow network, Offline or Server errors, to see the loading, offline and error states.
- **Reset sample data.**

Everything you change is saved in this browser only.

## Run it locally

No install or build step is needed. Serve the folder and open `http://localhost:8000/demo/`:

```bash
python -m http.server 8000
```

## Test

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

GitHub Actions runs the same checks on every push.

## How it is built

The prototype is plain HTML, CSS and JavaScript modules with no framework and no build step, so anyone can open it and read it.

```
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
docs/               product scope, Ask and voice, integration plan
```

The production app will be **React Native (Expo)**. The screens, actions and data shapes here are meant to carry straight across; see [docs/integration.md](docs/integration.md).

## Status and data

- **This is a prototype.** It has no login and no live DocNexus data. CRM sync and PDF reports are not connected; the app labels them "Coming later".
- **The answers are scripted.** Ask works things out from the sample figures on the device; in production it will call the DocNexus Ask service.
- **The people are fictional.** Facility names and map locations are public references; all volumes, referrals and activity are made up.
- **Keep internal material out of this repository; it is public.** That includes customer exports, design files that contain real physician names, and backend notes. They live in the git-ignored `reference/` folder.

## More

- [Product scope: users, flows, and the website vs the app](docs/product.md)
- [Ask and voice: what is built and the path to a live voice mode](docs/ask-and-voice.md)
- [Integration plan: React Native, data services and design system](docs/integration.md)
