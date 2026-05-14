// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8765',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Boots the static server before tests; Playwright reuses an existing one if found.
  webServer: {
    command: 'python -m http.server 8765',
    url: 'http://localhost:8765/meal-analysis.html',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
