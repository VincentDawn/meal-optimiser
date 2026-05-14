#!/usr/bin/env bash
# weekly-refresh.sh — orchestrates the weekly meal-optimiser data refresh on
# bumblebee.  Pulls latest, runs every scraper, recomputes the meal-data.js
# averages, then commits + pushes any changes so the deployed site picks
# them up.
#
# Cron entry (Europe/London, Monday 06:00):
#   CRON_TZ=Europe/London
#   0 6 * * 1 /home/marky/meal-optimiser/scripts/weekly-refresh.sh \
#       >> /home/marky/meal-optimiser/scrape.log 2>&1
#
# Environment expectations on the host:
#   - Repo cloned at $HOME/meal-optimiser
#   - Python venv at $HOME/meal-optimiser/.venv  (with beautifulsoup4 + playwright)
#   - Playwright Chromium already installed (`playwright install chromium`)
#   - gh CLI authenticated against the repo's GitHub account

set -euo pipefail

REPO="${REPO:-$HOME/meal-optimiser}"
cd "$REPO"

ts() { date '+%Y-%m-%d %H:%M:%S %z'; }
log() { echo "[$(ts)] $*"; }

log "==== meal-optimiser weekly refresh start ===="

# ── 1. Pull latest -----------------------------------------------------------
log "git pull"
git pull --ff-only

# ── 2. Activate venv ---------------------------------------------------------
# shellcheck source=/dev/null
. .venv/bin/activate

# ── 3. Run every scraper -----------------------------------------------------
log "running scrapers"
cd scrapers
python run_all_scrapers.py || log "WARNING: run_all_scrapers.py exited non-zero (continuing — partial data still useful)"
cd "$REPO"

# ── 4. Recompute meal-data.js averages ---------------------------------------
log "recomputing meal-data.js averages"
python dev/headless_recompute.py

# ── 5. Commit + push if anything actually changed ----------------------------
if git diff --quiet && git diff --cached --quiet; then
    log "no changes to meal-data.js or scrapers/*.json — nothing to commit"
else
    log "committing data refresh"
    git add meal-data.js 'scrapers/*_all_products.json' 'scrapers/*_prices.json' 2>/dev/null || true
    git -c user.email='bumblebee@meal-optimiser.local' \
        -c user.name='bumblebee scraper' \
        commit -m "Weekly data refresh ($(date '+%Y-%m-%d'))"
    git push
    log "pushed"
fi

log "==== meal-optimiser weekly refresh done ===="
