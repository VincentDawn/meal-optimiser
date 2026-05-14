# Meal Optimiser

Decision-support tool for choosing the most cost-effective ready-meal/meal-prep strategy in the UK (Scotland-focused).

The headline question: **at what hourly rate does each option become worthwhile?** It compares ~25 strategies — from DIY Farmfoods at the cheap end, through supermarket ready meals (Tesco, M&S, Iceland, Lidl, Aldi), to local meal-prep delivery services (Diced, Riba, OuiPrep, Parsley Box, Wiltshire Farm Foods, etc.) — across cost, calories, protein, and active prep time.

## Layout

```
index.html              Landing page — links to per-supplier filter tools
meal-analysis.html      Main interactive dashboard (sliders, charts, ranked table)
meal-data.js            Hand-curated option list — defaults, notes, baseline flags
*-filter.html           Per-supplier exclusion tools (Tesco, M&S, Iceland, Parsley Box)
scrapers/               Per-supplier scrapers (Python + Playwright JS)
  *_all_products.json   Scraped product catalogues — fetched live by the analysis
                        page, which computes averages on the fly using your
                        localStorage exclusions from the filter pages
  README.md             Per-scraper notes and run instructions
scripts/weekly-refresh.sh  Bumblebee cron orchestrator — scrapes + commits JSON
.github/workflows/test.yml CI: runs the Playwright suite on push and PR
tests/                  Playwright specs (calculations, analysis UI, filter pages)
```

Plus various `*.png` screenshots from scraping sessions and `meal-prep-services-scotland.md` / `ready-meal-services.md` with research notes.

## How it works

1. **Scrape** — `scrapers/run_all_scrapers.py` (or individual scripts) hit each supplier's site and dump products to `scrapers/*_all_products.json`. This runs weekly on bumblebee from cron and commits any changes to the repo.
2. **Aggregate** — `meal-analysis.html` fetches the three scraped JSONs at boot, applies your exclusions (from localStorage), and computes the average price/calories/protein on the fly. Those overrides land on top of `meal-data.js` *before* charts render.
3. **Filter** (per user) — open `*-filter.html` to tick off products you'd never eat. Exclusions save to localStorage. Open the analysis tab and the averages reflect your exclusions immediately (and reactively, via the `storage` event, if you have both tabs open).
4. **Analyse** — slide your hourly time value and active cooking time, configure per-store overrides in the "Per-store settings" table, and watch the rankings shift.

## Run the deployed site locally

It's just static files — anything will do:

```bash
python -m http.server 8000
# open http://localhost:8000
```

No build step. Vanilla HTML/JS plus Chart.js from CDN.

The scrapers use `beautifulsoup4` and Playwright — see [scrapers/README.md](scrapers/README.md).

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
