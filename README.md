# Meal Optimiser

[![CI](https://github.com/VincentDawn/meal-optimiser/actions/workflows/ci.yml/badge.svg)](https://github.com/VincentDawn/meal-optimiser/actions/workflows/ci.yml)
[![CodeQL](https://github.com/VincentDawn/meal-optimiser/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/VincentDawn/meal-optimiser/security/code-scanning)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=VincentDawn_meal-optimiser&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=VincentDawn_meal-optimiser)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)
[![Tests: 49 Playwright](https://img.shields.io/badge/tests-49_Playwright-brightgreen.svg)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Decision-support tool for choosing the most cost-effective UK ready-meal strategy.
**Live: https://vincentdawn.github.io/meal-optimiser/**

The headline question: **at what hourly rate does each option become worthwhile?** It compares ~25 strategies — DIY supermarket cooking, frozen ready meals (Tesco, M&S, Iceland, Aldi, Lidl, Farmfoods), and Scotland-focused meal-prep delivery services (Diced, Riba, OuiPrep, Parsley Box, Wiltshire Farm Foods, etc.) — across cost, calories, protein and active prep time.

![Meal Optimiser dashboard](assets/dashboard-screenshot.png)

## Live site

It's a static site — open `index.html` in any browser, or serve the directory:

```bash
python -m http.server 8000
# open http://localhost:8000
```

No build step. Vanilla HTML/JS plus Chart.js from a CDN.

## What's where

```
index.html            Landing page → links to the dashboard and per-supplier filters
meal-analysis.html    Main interactive dashboard
meal-data.js          Hand-curated option list — defaults, baseline flags, notes
*-filter.html         Per-supplier exclusion tools (Tesco, M&S, Iceland, Parsley Box)
data/                 Scraped product catalogues, refreshed weekly
tests/                Playwright tests
.github/workflows/    CI — runs the test suite on push and PR
```

## How it works

1. **Scrape** (offline, weekly) — a separate private repo runs the actual scrapers on a residential connection. It commits the resulting `*_all_products.json` files into this repo's `data/` folder.
2. **Aggregate** — at boot, `meal-analysis.html` fetches each scraped JSON, applies the user's exclusions (saved in `localStorage` from the filter pages), and computes the average price/calories/protein on the fly.
3. **Personalise** — the user sets their hourly net rate, meals per week, in-store trip time and online order time. They can also override any of those per-store, mark services as unavailable, or set per-service delivery fees and minimum-order amounts.
4. **Rank** — the dashboard shows a top-3, a surplus chart vs the DIY Farmfoods baseline, a cost/time scatter, and a full comparison table. All recompute live as inputs change.

Everything lives in the user's browser. Settings persist per device in `localStorage`. Nothing is sent anywhere.

## Tests

Playwright drives a real Chromium through the analysis page and the four filter pages. Calculation tests run inside the browser via `page.evaluate()` so they exercise the same code the live UI uses.

```bash
npm install                         # one-time
npx playwright install chromium     # one-time, downloads ~110 MB
npm test                            # 49 tests, ~5 sec headless
npm run test:headed                 # watch the browser do its thing
npm run test:ui                     # Playwright's UI mode for debugging
```

The Playwright config auto-boots `python -m http.server 8765` before the tests and reuses any server already running on that port. CI mode (`process.env.CI`) switches the reporter to GitHub annotations and bumps retries to 1.

## Quality checks

Run the full pipeline locally:

```bash
npm run check    # prettier + eslint + stylelint + html-validate + tsc --checkJs
```

| Tool                 | Catches                                              | Config                     |
| -------------------- | ---------------------------------------------------- | -------------------------- |
| `prettier --check`   | Style drift                                          | `.prettierrc.json`         |
| `eslint`             | Unused vars, undeclared globals, common bugs         | `eslint.config.mjs`        |
| `stylelint`          | Bad CSS, duplicate selectors, ordering               | `.stylelintrc.json`        |
| `html-validate`      | Malformed markup, missing alt etc.                   | `.htmlvalidate.json`       |
| `tsc --checkJs`      | Type errors via JSDoc + ambient `types/globals.d.ts` | `jsconfig.json`            |
| `gitleaks` (CI only) | Secrets in source + git history                      | `.github/workflows/ci.yml` |
| GitHub CodeQL        | Semantic security analysis (XSS etc.)                | repo's default-setup       |
| SonarCloud           | Code smells, complexity, duplication                 | `sonar-project.properties` |
| Dependabot (auto)    | Vulnerable dependencies                              | repo Settings              |

CI runs every job on every push and PR. The deploy job to GitHub Pages depends on **all** of them passing — a red commit cannot ship.

### One-time SonarCloud setup (optional)

If you want SonarCloud's quality-gate badge to be green:

1. Sign in to https://sonarcloud.io with your GitHub account
2. Add the `meal-optimiser` repo as a project
3. Generate a token, add it as the `SONAR_TOKEN` repo secret on GitHub
4. The next push will populate the badge

Until set up, the `sonar` CI job runs in `continue-on-error` mode so it doesn't break the build.

## License

Personal project, no warranty. Use at your own risk; double-check anything before relying on it for actual meal planning. Product data is observational and may lag the supplier's site.
