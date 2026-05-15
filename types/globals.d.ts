// Ambient declarations for things tsc --checkJs can't statically resolve.
//
// 1. Globals injected by CDN <script> tags into the browser (Chart.js etc.)
// 2. Cross-file globals — vanilla JS uses script-tag exposure, not modules.
// 3. Page-context names that test code references inside page.evaluate(...).
//
// Without these, tsc fires "Cannot find name" on every reference.

// ── Node bits we use ourselves (avoids pulling in @types/node which
//    transitively type-checks node_modules/punycode and explodes) ──────────
declare const process: { env: Record<string, string | undefined> };
declare function require(name: string): any;

// ── CDN globals (loaded via <script src="..."> tags) ────────────────────────
declare const Chart: any;
declare const Hammer: any;

// ── Cross-file site globals exposed via window or script-tag scope ──────────
// (NB: meal-data.js itself declares these; types live there.  These ambient
// declarations are for the OTHER files that consume them.)
declare const Freshness: {
  loadMeta(): Promise<any>;
  fillRefreshedSpans(): Promise<void>;
  freshnessSummary(): Promise<string>;
  relative(iso: string): string;
  format(iso: string): string;
};

interface Window {
  resetPerStoreOverrides(): void;
  Freshness: typeof Freshness;
  __appReady?: boolean;
}

// ── Page-context names referenced inside `await page.evaluate(...)` strings ─
//    These run in the BROWSER, not Node — but tsc analyses the test source
//    file as Node code and can't tell the difference.  Declaring them as
//    ambient `any` shuts up TS2304/TS18004 without inventing fake types.
declare const OPTS: any[];
declare let MEALS: number;
declare let INSTORE_MINS: number;
declare let ONLINE_MINS: number;
declare let NET_EMPLOYMENT: number;
declare let TIME_VALUE: number;
declare const products: any[];
declare const applyToMealData: any;
declare function nonDominated(): any[];
declare function setOverride(id: string, field: string, value: any): void;
declare function weeklyCost(opt: any): number;
declare function deliveryCostPerWeek(opt: any): number;
declare function surplus(opt: any, includeShopping?: boolean): number;
declare function beNet(opt: any): number | null;
declare function activeHrs(opt: any, includeShopping?: boolean): number;
declare function isAvailable(opt: any): boolean;
declare function diyHrs(): number;
