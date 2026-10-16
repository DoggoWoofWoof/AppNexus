# AppNexus — Field Pro mobile concept

Private working repo for the Field Pro field-sales mobile concept.
Continued from Codex exploration work in this same folder.

## What's here

- `mockup/index.html` — standalone clickable concept (My book / Search / Activity / Reports, HCO → HCP → note flow). All data illustrative, notes in-memory only.
- `docs/product-plan.md` — scope, staged plan, prototype boundary.
- `docs/app-flow.md` — Choose account → Prepare → Meet → Log visit flow.
- `docs/design-review.md` — verified Field Pro / HCP / HCO fields, hierarchy rules.
- `docs/repository-feature-map.md` — 58 feature families mapped to source (4 upstream repos, inspected read-only).
- `docs/surface-area-audit.md` + `docs/surface-area.json` — current IA: Today / Targets / Activity / Insights; 39 screen families, 12 sheets.
- `docs/sales-rep-daily-flow.md`, `docs/comparable-apps-review.md`, `docs/map-experience.md`, `docs/responsive-design-contract.md`, `docs/plan-status-and-endpoint-audit.md` — daily flow, comparables, maps, responsive rules, endpoint audit.

## View it

Open `mockup/index.html` in a browser, or use GitHub Pages (see repo Settings → Pages → Deploy from branch → `main` → `/ (root)`; root `index.html` redirects to `mockup/`).

## What is NOT wired

No production API, auth, CRM push, report generation, routing, or persistence is connected. Latest conversation prototypes (`field-pro-today.html`, `field-pro-maps.html`, `field-pro-responsive.html`) referenced in docs are not in this folder — only the earlier standalone mockup plus `flow-behavior.js`, `flow-styles.css`, `responsive-*.js` fragments survived.

## Source exclusion

`reference/repos/` (full upstream clones) is git-ignored and never pushed. Endpoint evidence lives in docs; see `repository-feature-map.md` for revisions inspected.
