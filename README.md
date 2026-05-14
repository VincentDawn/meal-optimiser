# Meal Optimiser

Decision-support tool for choosing the most cost-effective ready-meal/meal-prep strategy in the UK (Scotland-focused).

The headline question: **at what hourly rate does each option become worthwhile?** It compares ~25 strategies — from DIY Farmfoods at the cheap end, through supermarket ready meals (Tesco, M&S, Iceland, Lidl, Aldi), to local meal-prep delivery services (Diced, Riba, OuiPrep, Parsley Box, Wiltshire Farm Foods, etc.) — across cost, calories, protein, and active prep time.

## Layout

```
index.html              Landing page — links to per-supplier filter tools
meal-analysis.html      Main interactive dashboard (sliders, charts, ranked table)
meal-data.js            The dataset — single source of truth for the UI
*-filter.html           Per-supplier exclusion tools (Tesco, M&S, Iceland, Parsley Box)
server.py               Local Python server (static + /api endpoints used by filter pages)
scrapers/               Per-supplier scrapers (Python + Playwright JS)
  *_all_products.json   Scraped product catalogues with prices/macros
  README.md             Per-scraper notes and run instructions
```

Plus various `*.png` screenshots from scraping sessions and `meal-prep-services-scotland.md` / `ready-meal-services.md` with research notes.

## How it works

1. **Scrape** — `scrapers/run_all_scrapers.py` (or individual scripts) hit each supplier's site and dump products to `scrapers/*_all_products.json`.
2. **Filter** — open `*-filter.html` in the local server to tick off products you'd never eat (sandwiches, kids' meals, etc.). Hit "Apply to meal-data.js" and the server recomputes averages and writes them back into `meal-data.js`.
3. **Analyse** — `meal-analysis.html` reads `meal-data.js`, lets you slide your hourly time value and active cooking time, and ranks every option by net weekly surplus vs the DIY Farmfoods baseline.

## Run locally

```bash
python server.py
# open http://localhost:5000
```

No build step — it's vanilla HTML/JS plus Chart.js from CDN. Python is only used by `server.py` and the scrapers (stdlib only for the server; scrapers use `requests`, `beautifulsoup4`, and Playwright).
