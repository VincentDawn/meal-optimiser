// @ts-check
// UI behaviour for the four per-supplier filter pages.

const { test, expect } = require('@playwright/test');

const PAGES = [
  { name: 'tesco',      file: 'tesco-filter.html',      lsKey: 'excl_tesco',      minProducts: 100 },
  { name: 'ms',         file: 'ms-filter.html',         lsKey: 'excl_ms',         minProducts: 50  },
  { name: 'iceland',    file: 'iceland-filter.html',    lsKey: 'excl_iceland',    minProducts: 50  },
  { name: 'parsleybox', file: 'parsleybox-filter.html', lsKey: 'excl_parsleybox', minProducts: 5   },
];

for (const p of PAGES) {
  test.describe(`${p.name} filter page`, () => {
    test.beforeEach(async ({ page }) => {
      // Fresh context per test = empty localStorage. No init script (would re-fire on reload).
      await page.goto(`/${p.file}`);
    });

    test('loads at least the expected number of products', async ({ page }) => {
      const count = await page.evaluate(() => products.length);
      expect(count).toBeGreaterThanOrEqual(p.minProducts);
    });

    test('renders one table row per product', async ({ page }) => {
      const tableRows = await page.locator('#tbody tr').count();
      const productCount = await page.evaluate(() => products.length);
      expect(tableRows).toBe(productCount);
    });

    test('the dead apply-button and handler are gone', async ({ page }) => {
      const btn = await page.locator('button.apply').count();
      expect(btn).toBe(0);
      const fnExists = await page.evaluate(() => typeof applyToMealData);
      expect(fnExists).toBe('undefined');
    });

    test('ticking a checkbox decrements the kept-count and persists to localStorage', async ({ page }) => {
      const before = parseInt(await page.locator('#s-count').textContent());
      await page.locator('#tbody input[type=checkbox]').first().check();
      // Wait for the 400ms debounced save plus a small buffer
      await page.waitForTimeout(550);
      const after = parseInt(await page.locator('#s-count').textContent());
      expect(after).toBe(before - 1);
      const stored = await page.evaluate((k) => localStorage.getItem(k), p.lsKey);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored).length).toBe(1);
    });

    test('reload restores ticked exclusions from localStorage', async ({ page }) => {
      await page.locator('#tbody input[type=checkbox]').first().check();
      await page.waitForTimeout(550);
      await page.reload();
      const checked = await page.locator('#tbody input[type=checkbox]:checked').count();
      expect(checked).toBe(1);
    });
  });
}
