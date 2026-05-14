// @ts-check
// UI behaviour for meal-analysis.html — input wiring, persistence, re-renders.

const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Fresh context per test = empty localStorage — no init script needed.
  // (addInitScript would re-fire on page.reload(), wiping persisted state.)
  await page.goto('/meal-analysis.html');
});

test('page loads with default values surfaced in stats', async ({ page }) => {
  await expect(page.locator('#sNetRate')).toHaveText('£17.23/hr');
  await expect(page.locator('#sTV')).toHaveText('£17.23/hr');
});

test('changing the net-rate input snaps the slider and ref-line', async ({ page }) => {
  await page.fill('#netRateInput', '25');
  await page.locator('#netRateInput').dispatchEvent('change');
  await expect(page.locator('#sNetRate')).toHaveText('£25.00/hr');
  await expect(page.locator('#sTV')).toHaveText('£25.00/hr');
  // Slider value should snap to the new rate
  expect(await page.locator('#tvSlider').inputValue()).toBe('25');
  // Persisted to localStorage
  const stored = await page.evaluate(() => localStorage.getItem('meal_optimiser_net_rate'));
  expect(parseFloat(stored)).toBe(25);
});

test('rate input rejects 0 and negative values', async ({ page }) => {
  // Try 0
  await page.fill('#netRateInput', '0');
  await page.locator('#netRateInput').dispatchEvent('change');
  let v = await page.evaluate(() => NET_EMPLOYMENT);
  expect(v).toBeGreaterThan(0);
  // Try -5
  await page.fill('#netRateInput', '-5');
  await page.locator('#netRateInput').dispatchEvent('change');
  v = await page.evaluate(() => NET_EMPLOYMENT);
  expect(v).toBeGreaterThan(0);
});

test('changing meals/week persists and updates baseline cost', async ({ page }) => {
  const baselineBefore = await page.evaluate(() => weeklyCost(OPTS.find(o => o.baseline)));
  await page.fill('#mealsInput', '14');
  await page.locator('#mealsInput').dispatchEvent('change');
  const baselineAfter = await page.evaluate(() => weeklyCost(OPTS.find(o => o.baseline)));
  expect(baselineAfter).toBeCloseTo(baselineBefore * 14 / 21, 2);
  const stored = await page.evaluate(() => localStorage.getItem('meal_optimiser_meals_per_week'));
  expect(parseInt(stored)).toBe(14);
});

test('changing in-store mins re-renders the per-store table', async ({ page }) => {
  await page.fill('#instoreInput', '60');
  await page.locator('#instoreInput').dispatchEvent('change');
  // The Aldi row's drive-time input should now display 60 (the new global)
  const aldiDrive = await page.locator('#psTable input[data-id="rm_aldi"][data-field="driveTimeMins"]').inputValue();
  expect(aldiDrive).toBe('60');
});

test('reload preserves all four personal settings', async ({ page }) => {
  await page.fill('#netRateInput', '22.50');
  await page.locator('#netRateInput').dispatchEvent('change');
  await page.fill('#mealsInput', '14');
  await page.locator('#mealsInput').dispatchEvent('change');
  await page.fill('#instoreInput', '40');
  await page.locator('#instoreInput').dispatchEvent('change');
  await page.fill('#onlineInput', '10');
  await page.locator('#onlineInput').dispatchEvent('change');

  await page.reload();

  expect(await page.locator('#netRateInput').inputValue()).toBe('22.50');
  expect(await page.locator('#mealsInput').inputValue()).toBe('14');
  expect(await page.locator('#instoreInput').inputValue()).toBe('40');
  expect(await page.locator('#onlineInput').inputValue()).toBe('10');
});

test('per-store table renders 24 option rows + 4 category headers', async ({ page }) => {
  // Expand the disclosure so the table is in view (it's pre-rendered regardless)
  await page.locator('details.ps-details summary').click();
  expect(await page.locator('#psTable tbody tr').count()).toBe(28);
  expect(await page.locator('#psTable tbody tr.ps-cat').count()).toBe(4);
});

test('untick availability persists, drops option from rankings, greys row', async ({ page }) => {
  await page.locator('details.ps-details summary').click();
  const cb = page.locator('#psTable input[data-id="svc_blueberry_hill"][data-field="available"]');
  await expect(cb).toBeChecked();
  await cb.uncheck();
  // Persisted
  const ov = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('meal_optimiser_option_overrides')).svc_blueberry_hill);
  expect(ov.available).toBe(false);
  // Dropped from rankings
  const stillIn = await page.evaluate(() => nonDominated().some(o => o.id === 'svc_blueberry_hill'));
  expect(stillIn).toBe(false);
  // Row greyed
  const row = page.locator('#psTable input[data-id="svc_blueberry_hill"][data-field="available"]').locator('xpath=ancestor::tr');
  await expect(row).toHaveClass(/ps-unavail/);
});

test('overriding Diced delivery fee adds it to the weekly cost', async ({ page }) => {
  await page.locator('details.ps-details summary').click();
  const before = await page.evaluate(() => weeklyCost(OPTS.find(o => o.id === 'svc_diced')));
  await page.fill('#psTable input[data-id="svc_diced"][data-field="deliveryFeePerOrder"]', '5.99');
  await page.locator('#psTable input[data-id="svc_diced"][data-field="deliveryFeePerOrder"]').dispatchEvent('change');
  const after = await page.evaluate(() => weeklyCost(OPTS.find(o => o.id === 'svc_diced')));
  expect(after - before).toBeCloseTo(5.99, 2);
});

test('comparison-table cost cell flags baked-in delivery for Simmer', async ({ page }) => {
  const html = await page.locator('#tbody tr').filter({ hasText: 'Simmer Eats' }).locator('td').nth(2).innerHTML();
  expect(html).toContain('£164/wk');
  expect(html).toContain('incl. £6.99 delivery');
});

test('top-3 panel populates with three cards', async ({ page }) => {
  expect(await page.locator('.top3 .top3-card').count()).toBe(3);
});

test('no console errors on initial load', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('favicon')) errors.push(msg.text()); });
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
