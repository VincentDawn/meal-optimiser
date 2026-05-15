// ESLint flat config.  Vanilla JS in browser context for the dashboard +
// filter pages; Node context for tests + Playwright config.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,

  // ── Browser-side code (dashboard, freshness helper) ──────────────────────
  {
    files: ['assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script', // <script> tags, not ESM modules
      globals: {
        ...globals.browser,
        // Globals provided by other browser scripts loaded before this file
        MEAL_DATASET: 'readonly',
        OPTION_DEFAULTS: 'readonly',
        // CDN-loaded globals
        Chart: 'readonly',
        Hammer: 'readonly',
        // Cross-script globals exposed by sibling files in this directory
        Freshness: 'readonly',
      },
    },
    rules: {
      // Code intentionally has unused `e` parameters in catch blocks
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$', caughtErrors: 'none' }],
      // Allow `if (foo) bar();` one-liners
      curly: 'off',
      // We use `==` deliberately for null+undefined coalescing in a few spots
      eqeqeq: ['warn', 'smart'],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ── Top-level data file (browser-side, exports via globals) ──────────────
  {
    files: ['meal-data.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      // MEAL_DATASET and OPTION_DEFAULTS are intentional script-tag globals
      // consumed by other files; the linter can't see those cross-file uses.
      'no-unused-vars': 'off',
    },
  },

  // ── Tests + config (Node host, but page.evaluate strings run in browser) ─
  {
    files: ['tests/**/*.js', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // page.evaluate(`() => { OPTS... }`) strings reference page-context
      // globals that ESLint can't statically resolve.  no-undef would fire on
      // every such reference.
      'no-undef': 'off',
      // Same reason — assignments to MEALS, INSTORE_MINS etc. inside
      // page.evaluate strings happen in the BROWSER, not Node.
      'no-global-assign': 'off',
    },
  },

  // ── Things ESLint shouldn't even look at ─────────────────────────────────
  {
    ignores: [
      'node_modules/',
      'data/',
      'playwright-report/',
      'test-results/',
      '.playwright-mcp/',
      '.dev-tools/',
      'package-lock.json',
    ],
  },
];
