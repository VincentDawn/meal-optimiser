# Meal Optimiser

Decision-support tool for choosing the most cost-effective UK ready-meal / meal-prep
strategy. Static site — plain HTML/CSS/JS, no framework, no build step.

## Commands

```bash
npm run serve        # python -m http.server 8765
npm test             # playwright
npm run test:ui      # playwright --ui
npm run test:headed
npm run lint         # eslint
npm run lint:css     # stylelint
npm run lint:html    # html-validate
```

There is **CI on GitHub Actions** (`.github/workflows/ci.yml`) plus CodeQL scanning,
so lint and tests are not optional — a failing lint breaks the badge in the README.

## Layout

- `*.html` at the root — one page per view (e.g. `iceland-filter.html`).
- `assets/` — CSS and JS.
- `data/` — **the product catalogues, written by the `meal-optimiser-scrapers` repo.**
  Don't hand-edit these; they get overwritten by the scraper push.

## The data pipeline

Prices and nutrition come from `meal-optimiser-scrapers`, which runs weekly on
bumblebee from cron and pushes JSON into this repo's `data/` folder. If the numbers
look stale or wrong, the bug is almost always in the scrapers repo, not here.

## Conventions

- No framework and no bundler — keep it that way. The whole point is that it serves
  from a static file server.
- Config lives in `.prettierrc.json`, `.stylelintrc.json`, `.htmlvalidate.json`,
  `eslint.config.mjs`. Match the existing style rather than reformatting.
- **`origin` is Forgejo** (`git.cybertron.local:3000/marky/meal-optimiser`), but the
  README's CI/CodeQL badges still point at `VincentDawn/meal-optimiser` on GitHub.
  Check which remote you're actually pushing to before relying on a badge — they may
  be reporting a different copy of the repo.
- MIT licensed and mirrored publicly, so don't commit anything personal, and keep the
  scraper internals in the private scrapers repo.
