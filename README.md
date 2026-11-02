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

## Layout

```
index.html          opens the design
design/             the field app design: one page and its runtime
docs/               integration plan, Ask and voice
```

The phone app will be built from this design in React Native (Expo); see [docs/integration.md](docs/integration.md).

## Status and data

- **This is a design.** It has no login and no live DocNexus data. CRM sync is not connected.
- **The answers are scripted.** Ask answers from the sample data on the page; in production it will call the DocNexus Ask service.
- **The people are fictional.** Customer account names, facility names and map locations are real; all doctors, volumes, referrals and activity are made up.
- **Keep internal material out of this repository; it is public.** That includes customer exports, design files that contain real physician names, and backend notes. They live in the git-ignored `reference/` folder.

## More

- [Integration plan: React Native, data services and design system](docs/integration.md)
- [Ask and voice: the path to a live voice mode](docs/ask-and-voice.md)
