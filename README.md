# Meal Optimiser

Decision-support tool for choosing the most cost-effective ready-meal/meal-prep strategy in the UK (Scotland-focused).

The headline question: **at what hourly rate does each option become worthwhile?** It compares ~25 strategies — from DIY Farmfoods at the cheap end, through supermarket ready meals (Tesco, M&S, Iceland, Lidl, Aldi), to local meal-prep delivery services (Diced, Riba, OuiPrep, Parsley Box, Wiltshire Farm Foods, etc.) — across cost, calories, protein, and active prep time.

## Layout

```
index.html              Landing page — links to per-supplier filter tools
meal-analysis.html      Main interactive dashboard (sliders, charts, ranked table)
meal-data.js            The dataset — single source of truth for the UI
*-filter.html           Per-supplier exclusion tools (Tesco, M&S, Iceland, Parsley Box)
scrapers/               Per-supplier scrapers (Python + Playwright JS)
  *_all_products.json   Scraped product catalogues with prices/macros
  README.md             Per-scraper notes and run instructions
dev/                    Local-only tooling (not part of the deployed site)
  server.py             Patches meal-data.js after a scrape — see below
```

Plus various `*.png` screenshots from scraping sessions and `meal-prep-services-scotland.md` / `ready-meal-services.md` with research notes.

## How it works

1. **Scrape** — `scrapers/run_all_scrapers.py` (or individual scripts) hit each supplier's site and dump products to `scrapers/*_all_products.json`.
2. **Analyse** — `meal-analysis.html` reads `meal-data.js`, lets you slide your hourly time value and active cooking time, and ranks every option by net weekly surplus vs the DIY Farmfoods baseline.
3. **Filter** (per user) — open `*-filter.html` to tick off products you'd never eat (sandwiches, kids' meals, etc.). Averages recompute live in the browser. Your exclusions persist in localStorage on your device only.
4. **Curate** (data maintainer) — to update the canonical averages in `meal-data.js`, run `python dev/server.py`, hit each filter page, exclude the same items, and the dev server patches `meal-data.js` in place. Commit + push and the deployed site picks it up.

## Run the deployed site locally

It's just static files — anything will do:

```bash
python -m http.server 8000
# open http://localhost:8000
```

No build step. Vanilla HTML/JS plus Chart.js from CDN.

## Run the dev curation workflow

```bash
python dev/server.py
# open http://localhost:5000
```

The dev server adds three things on top of static serving: it can read/write `scrapers/exclusions.json`, recompute averages with those exclusions applied, and patch `meal-data.js` in place. Stdlib only — no pip install needed.

The scrapers themselves use `requests`, `beautifulsoup4`, and Playwright — see [scrapers/README.md](scrapers/README.md).

## Tests

Playwright drives a real browser through the analysis page and the four filter pages. Calculation tests run inside the browser via `page.evaluate()` so they exercise the same code the live UI uses.

```bash
npm install            # one-time, installs @playwright/test
npx playwright install chromium  # one-time, downloads ~110 MB browser
npm test               # runs all 44 tests headless (~5 sec)
npm run test:headed    # watch the browser do its thing
npm run test:ui        # Playwright's UI mode for debugging
```

The Playwright config boots `python -m http.server 8765` automatically before the tests and reuses any server already running on that port.

Test layout:
- `tests/calculations.spec.js` — pure-logic asserts (weeklyCost, deliveryCostPerWeek, surplus, availability filtering)
- `tests/analysis.spec.js` — UI behaviour for the main analysis page (input wiring, persistence, re-renders)
- `tests/filter-pages.spec.js` — exclusion + persistence across all four supplier filter pages
