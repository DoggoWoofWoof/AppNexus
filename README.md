# AppNexus · DocNexus

[Open the field app design](https://doggowoofwoof.github.io/AppNexus/design/)

DocNexus is one app for both DocNexus products: Field Pro (the book of accounts and doctors, the opportunity map, claims) and Insights (logging what doctors say). Every customer gets the same flow; each account shows only what its own product has, in that product's words.

## The design

- **Pick a customer account** in the left panel. Ottava is a Field Pro customer; Stemline, Kura Oncology, BeOne Medicines, Targeted Oncology and Gilead Sciences use Insights.
- **Field Pro's tabs:** Targets, Ask, the centre button, Map and Activity. The centre button opens Log a visit: a visit, call, case observation or email, who you saw and what happened. Ask's mic sits beside send.
- **Insights' tabs:** Stemline and Kura have Targets, Sphere, the centre button, Summaries and Activity; Activity holds Overview, My Insights and Transcripts. BeOne, Targeted Oncology and Gilead have Insights in place of Sphere: Insights holds My Insights and Transcripts, and Activity shows Overview only.
- **The centre button records straight away** on the Insights accounts with Record. When you stop, tag who was there: one doctor, a group, or a conference session. Stemline has no Record, so it opens Add insight instead.
- **Every Insight button opens the same sheet,** with Notes, Upload and, where it is on, Record. Upload takes files, or up to 20 links (YouTube, Google Drive or a file) as the website's Import links does.
- **Activity** holds Field Pro's notes. On Insights accounts, the screens follow the Sphere rules above. Each card opens the full visit or insight.
- **Add puts a visit on today's route where it adds the least driving** (Field Pro), says where it went, and offers Undo.

| Account | Record | What its sheet adds or drops |
|---|---|---|
| Ottava | No | Field Pro's Log a visit: Visit, Call, Case observation or Email, who, and a note |
| Stemline | No | Insight or Note; topics with subtopics; Live or Virtual; Third Party vendor and Conference name; no tags; CRM handled by the server |
| Kura Oncology | Yes | Named advocacy scores; five fixed topics; short meeting-type list |
| BeOne Medicines | Yes | Therapeutic area (CLL or MCL) first, which picks the topics |
| Targeted Oncology | Yes | No fixed topics; Live or Virtual; Third Party vendor and Conference name |
| Gilead Sciences | Yes | Stage and priority; its own meeting types |

The left panel also lists what to check when the endpoints are wired.

The design is one HTML page, [design/index.html](design/index.html), run by `design/support.js`, which loads React from unpkg. To view it locally, serve the folder and open `http://localhost:8000/design/`.

## Layout

```
index.html          opens the design
design/             the field app design: one page and its runtime
docs/               integration plan, Ask and voice
```

The phone app is built from this design (React Native with Expo) in a separate, private repository; see [docs/integration.md](docs/integration.md).

## Status and data

- **This is a design.** It has no login and no live DocNexus data. There is no CRM sync in the app: the server handles a customer's CRM.
- **The answers are scripted.** Ask answers from the sample data on the page; the phone app calls the live Ask service.
- **The people are fictional.** Customer account names, facility names and map locations are real; all doctors, volumes, referrals and activity are made up.
- **Keep internal material out of this repository; it is public.** That includes customer exports, design files that contain real physician names, and backend notes. They live in the git-ignored `reference/` folder.

## More

- [Integration plan: React Native, data services and design system](docs/integration.md)
- [Ask and voice: the path to a live voice mode](docs/ask-and-voice.md)


## Runtime sync, 2026-11-26

The public design mirrors the private app's current source. Sphere accounts keep Overview, My Insights and
Transcripts together in Activity; other Insights accounts split My Insights/Transcripts into Insights and keep
Overview in Activity. Explore HCP cards retain one measured snapshot, and microphone/recording controls have
explicit labels. The [live app demo](https://docnexus-field.vercel.app) is deployed manually from the private app;
a public-design push alone does not deploy it. Native store identifiers remain undecided; nothing was registered
or submitted under a proposed identifier.
