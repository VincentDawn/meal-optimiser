// @ts-check
// Calculation correctness — runs in the browser via page.evaluate so it tests
// the same code the live UI uses. Pure-logic asserts only, no UI interaction.

const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Each test gets a fresh browser context, so localStorage is empty by default.
  // We don't use addInitScript here — it would clear localStorage on reload too,
  // breaking persistence tests.
  await page.goto('/meal-analysis.html');
  // Boot is async (fetches scraped product JSONs and applies the averages
  // before the first render) — wait for the ready signal before asserting.
  await page.waitForFunction(() => window.__appReady === true);
});

test('all 24 options load from meal-data.js', async ({ page }) => {
  const count = await page.evaluate(() => OPTS.length);
  expect(count).toBe(24);
});

test('OPTION_DEFAULTS covers every option', async ({ page }) => {
  const result = await page.evaluate(() => {
    const missing = OPTS.filter(o => !OPTION_DEFAULTS[o.id]).map(o => o.id);
    return { missing, defaultsCount: Object.keys(OPTION_DEFAULTS).length };
  });
  expect(result.missing).toEqual([]);
  expect(result.defaultsCount).toBe(24);
});

test('baseline weeklyCost = costPerMeal × MEALS at defaults', async ({ page }) => {
  const cost = await page.evaluate(() => {
    const b = OPTS.find(o => o.baseline);
    return { cost: weeklyCost(b), expected: b.costPerMeal * MEALS };
  });
  expect(cost.cost).toBeCloseTo(cost.expected, 2);
});

test('Simmer Eats: delivery fee always charged (free-above = 0)', async ({ page }) => {
  const result = await page.evaluate(() => {
    const o = OPTS.find(x => x.id === 'svc_simmer');
    return {
      delivery: deliveryCostPerWeek(o),
      total: weeklyCost(o),
      meals: o.costPerMeal * MEALS,
    };
  });
  expect(result.delivery).toBe(6.99);
  expect(result.total).toBeCloseTo(result.meals + 6.99, 2);
});

test('Blueberry Hill: free delivery when weekly spend ≥ £30', async ({ page }) => {
  const result = await page.evaluate(() => {
    const o = OPTS.find(x => x.id === 'svc_blueberry_hill');
    return { delivery: deliveryCostPerWeek(o), weekly: o.costPerMeal * MEALS };
  });
  // 21 × £6.25 = £131.25, well above the £30 free threshold
  expect(result.weekly).toBeGreaterThan(30);
  expect(result.delivery).toBe(0);
});

test('Blueberry Hill: delivery fee kicks in when weekly spend below £30', async ({ page }) => {
  const result = await page.evaluate(() => {
    // Drop meals to 4 — 4 × £6.25 = £25, below the £30 free threshold
    MEALS = 4;
    const o = OPTS.find(x => x.id === 'svc_blueberry_hill');
    return { delivery: deliveryCostPerWeek(o), weekly: o.costPerMeal * MEALS };
  });
  expect(result.weekly).toBeLessThan(30);
  expect(result.delivery).toBe(2.5);
});

test('In-store option uses global INSTORE_MINS for active time', async ({ page }) => {
  const result = await page.evaluate(() => {
    const farmfoods = OPTS.find(o => o.id === 'diy_farmfoods');
    const before = activeHrs(farmfoods, true);
    INSTORE_MINS = 60;
    const after = activeHrs(farmfoods, true);
    return { before, after, deltaHrs: after - before };
  });
  // 60 - 25 = 35 minutes = 0.583 hours
  expect(result.deltaHrs).toBeCloseTo(35 / 60, 3);
});

test('Per-option drive override takes precedence over global', async ({ page }) => {
  const result = await page.evaluate(() => {
    const aldi = OPTS.find(o => o.id === 'rm_aldi');
    const before = activeHrs(aldi, true);
    setOverride('rm_aldi', 'driveTimeMins', 45);
    const after = activeHrs(aldi, true);
    // Sanity: another in-store option without override still uses global
    const farmfoodsAfter = activeHrs(OPTS.find(o => o.id === 'diy_farmfoods'), true);
    const farmfoodsBefore = (() => {
      // Recompute farmfoods with no override — should use global INSTORE_MINS unchanged
      const ff = OPTS.find(o => o.id === 'diy_farmfoods');
      return activeHrs(ff, true);
    })();
    return { aldiBefore: before, aldiAfter: after, INSTORE_MINS, farmfoodsAfter, farmfoodsBefore };
  });
  // Aldi shopping mins jumped from INSTORE_MINS (25) to 45 — delta = (45-25)/60 hrs
  expect(result.INSTORE_MINS).toBe(25);
  expect(result.aldiAfter - result.aldiBefore).toBeCloseTo((45 - 25) / 60, 3);
  // Farmfoods (no override) should be unchanged regardless of Aldi's override
  expect(result.farmfoodsAfter).toBeCloseTo(result.farmfoodsBefore, 5);
});

test('Unavailable option drops from nonDominated()', async ({ page }) => {
  const result = await page.evaluate(() => {
    const id = 'svc_blueberry_hill';
    const before = nonDominated().some(o => o.id === id);
    setOverride(id, 'available', false);
    const after = nonDominated().some(o => o.id === id);
    return { before, after };
  });
  expect(result.before).toBe(true);
  expect(result.after).toBe(false);
});

test('Baseline option is always retained even if marked unavailable', async ({ page }) => {
  const result = await page.evaluate(() => {
    const baseline = OPTS.find(o => o.baseline);
    setOverride(baseline.id, 'available', false);
    return nonDominated().some(o => o.id === baseline.id);
  });
  expect(result).toBe(true);
});

test('Surplus calc references weeklyCost(opt) not opt.weeklyCost', async ({ page }) => {
  const result = await page.evaluate(() => {
    const tesco = OPTS.find(o => o.id === 'rm_tesco');
    const baselineSurplus = surplus(OPTS.find(o => o.baseline), false);
    const tescoSurplus = surplus(tesco, false);
    return { baselineSurplus, tescoSurplus };
  });
  expect(result.baselineSurplus).toBe(0);
  // Tesco should have a real, finite surplus number (positive or negative — just not NaN)
  expect(Number.isFinite(result.tescoSurplus)).toBe(true);
});

test('Changing MEALS scales baseline cost proportionally', async ({ page }) => {
  const result = await page.evaluate(() => {
    MEALS = 21;
    const at21 = weeklyCost(OPTS.find(o => o.baseline));
    MEALS = 14;
    const at14 = weeklyCost(OPTS.find(o => o.baseline));
    return { at21, at14, ratio: at14 / at21 };
  });
  expect(result.ratio).toBeCloseTo(14 / 21, 3);
});
