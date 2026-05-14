/**
 * MEAL STRATEGY DATASET
 * Edit this file independently — the UI loads from it automatically.
 *
 * dataQuality: 'verified' | 'estimated' | 'unknown'
 * timeType:    'DIY' | 'MD' | 'READY'
 *   DIY   = active cooking per meal (set by slider)
 *   MD    = meal deal hybrid (16 DIY + 5 grab-and-go lunches)
 *   READY = 30 sec active heating (microwave time ≠ your time)
 *
 * selfShoppingMins: minutes/week when YOU do the shopping yourself
 *   0 = always delivered or no travel (delivery services, meal deals at work)
 *   >0 = in-store or online self-managed
 *
 * calories / protein: per meal averages. null = unknown.
 * costPerMeal: used to calculate weeklyCost if not overridden (weeklyCost = costPerMeal * 21)
 */

const MEAL_DATASET = {

  meta: {
    meals_per_week: 21,
    heat_active_secs: 30,   // active seconds to heat a ready meal
    currency: 'GBP',
    last_updated: '2026-03',
  },

  options: [

    // ─── SUPERMARKET DIY ─────────────────────────────────────────────────────

    {
      id: 'diy_farmfoods',
      label: 'DIY Farmfoods',
      category: 'DIY',
      timeType: 'DIY',
      costPerMeal: 1.48,        // ESTIMATED — frozen chicken ~£1, veg ~£0.30, carbs ~£0.18
      weeklyCost: 31,           // includes slight buffer/wastage
      selfShoppingMins: 25,     // in-store trip
      calories: 540,            // ESTIMATED — chicken breast + veg + rice
      protein: 42,              // ESTIMATED — ~200g chicken breast
      dataQuality: 'estimated',
      baseline: true,
      dominated: false,
      notes: 'Cheapest DIY. Frozen chicken, veg, rice/pasta. Chicken tenders: 6 packs of 12 for £20 = £3.33/pack. Macros estimated for a typical assembled meal.',
    },

    {
      id: 'diy_lidl_aldi',
      label: 'DIY Lidl/Aldi',
      category: 'DIY',
      timeType: 'DIY',
      costPerMeal: 1.75,        // ESTIMATED — slightly pricier than Farmfoods
      weeklyCost: 37,
      selfShoppingMins: 30,
      calories: 540,            // same cooking, same macros
      protein: 42,
      dataQuality: 'estimated',
      baseline: false,
      dominated: true,          // costs more, same active time
      notes: 'Similar to Farmfoods DIY but higher ingredient cost. Dominated option.',
    },

    {
      id: 'diy_tesco_asda',
      label: 'DIY Tesco/Asda',
      category: 'DIY',
      timeType: 'DIY',
      costPerMeal: 2.50,        // ESTIMATED
      weeklyCost: 52,
      selfShoppingMins: 30,
      calories: 540,
      protein: 42,
      dataQuality: 'estimated',
      baseline: false,
      dominated: true,
      notes: 'More expensive ingredients, same cooking time. Dominated.',
    },

    // ─── MEAL DEAL HYBRID ────────────────────────────────────────────────────

    {
      id: 'md_sainsburys',
      label: "Sainsbury's MD + DIY dinners",
      category: 'MD',
      timeType: 'MD',
      costPerMeal: 1.81,        // blended: 5×£3.50 + 16×£1.00 / 21
      weeklyCost: 38,
      selfShoppingMins: 0,      // MDs grabbed at work, no extra travel
      calories: null,           // mixed — DIY dinners + MD lunches vary too much
      protein: null,
      dataQuality: 'estimated',
      baseline: false,
      dominated: false,
      notes: '5 work lunch meal deals (£3.50 each) + 16 DIY dinners. No extra shopping trip.',
    },

    {
      id: 'md_tesco',
      label: 'Tesco MD + DIY dinners',
      category: 'MD',
      timeType: 'MD',
      costPerMeal: 1.90,
      weeklyCost: 40,
      selfShoppingMins: 0,
      calories: null,
      protein: null,
      dataQuality: 'estimated',
      baseline: false,
      dominated: false,
      notes: '5 work lunch meal deals (£3.90 each) + 16 DIY dinners.',
    },

    // ─── SUPERMARKET READY MEALS ─────────────────────────────────────────────

    {
      id: 'rm_farmfoods',
      label: 'Farmfoods Ready Meals (bigger)',
      category: 'SRM',
      timeType: 'READY',
      costPerMeal: 2.00,        // VERIFIED by user — 3 for £6 (bigger meals)
      weeklyCost: 42,
      selfShoppingMins: 25,
      calories: null,
      protein: null,
      dataQuality: 'estimated', // price verified, macros unknown
      baseline: false,
      dominated: false,
      notes: 'Bigger ready meals: 3 for £6 = £2.00/meal. Small meals (mac & cheese etc.) 99p each. Macros unknown — check in-store.',
    },

    {
      id: 'rm_farmfoods_small',
      label: 'Farmfoods Ready Meals (99p)',
      category: 'SRM',
      timeType: 'READY',
      costPerMeal: 0.99,        // VERIFIED by user — 99p small meals
      weeklyCost: 21,
      selfShoppingMins: 25,
      calories: null,
      protein: null,
      dataQuality: 'estimated', // price verified, macros/portion size unknown
      baseline: false,
      dominated: false,
      notes: '99p small ready meals (mac & cheese etc.). Likely small portions (~250-300g) — may need 2 per sitting. Macros unknown.',
    },

    {
      id: 'rm_lidl',
      label: 'Lidl Ready Meals',
      category: 'SRM',
      timeType: 'READY',
      costPerMeal: 2.99,        // ~£2.49-3.69 for current chilled items, live-scraped Mar 2026
      weeklyCost: 63,
      selfShoppingMins: 30,
      calories: null,
      protein: null,
      dataQuality: 'estimated',
      baseline: false,
      dominated: false,
      notes: 'Lidl has NO consistent ready meals range — stock is seasonal/rotating. Live search (Mar 2026) shows only 5 products: Deluxe Gnocchi £2.49, Slow Cooked Pulled Chicken/Pork £3.69. Not reliable for weekly strategy.',
    },

    {
      id: 'rm_aldi',
      label: 'Aldi Ready Meals',
      category: 'SRM',
      timeType: 'READY',
      costPerMeal: 2.79,        // VERIFIED — Inspired Cuisine complete meals £2.79/400g, live-scraped Mar 2026
      weeklyCost: 59,
      selfShoppingMins: 30,
      calories: null,           // NOT on website — pack only. Need in-store check
      protein: null,            // NOT on website — pack only
      dataQuality: 'verified',  // price verified, macros need in-store check
      baseline: false,
      dominated: false,
      notes: 'Two tiers: £1.59 basic curries (Tikka/Korma/S&S, 400g complete w/ rice), £2.79 heartier meals (Chow Mein/Cottage Pie/Stew, 400g). Premium Specially Selected Gastro £3.59-3.99. Macros not published online — check pack.',
    },

    {
      id: 'rm_tesco',
      label: 'Tesco Ready Meals (frozen)',
      category: 'SRM',
      timeType: 'READY',
      costPerMeal: 2.59,        // VERIFIED — avg across all 147 frozen ready meals, price-ascending sort. Live-scraped Mar 2026
      weeklyCost: 54,
      selfShoppingMins: 5,      // recurring online order — just confirm weekly
      calories: 404,            // VERIFIED — avg across 127/147 products with kcal data. Live-scraped Mar 2026
      protein: 20,              // VERIFIED — avg across 129/147 products with valid protein data. Live-scraped Mar 2026
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'Frozen range. Avg across all 147 products: £2.59/meal, 404 kcal, 20g protein. Price range: £0.99–£5.00. No Clubcard deals found on frozen range. Full product list in scrapers/tesco_all_products.json — remove unwanted items and recalculate averages. Also available chilled: "Any 2 for £6" Clubcard = £3.00/meal. Recurring online order ~5 min/week. Live-scraped Mar 2026.',
    },

    {
      id: 'rm_tesco_finest',
      label: 'Tesco Finest (frozen)',
      category: 'SRM',
      timeType: 'READY',
      costPerMeal: 3.50,        // VERIFIED — all 9 frozen Finest products at £3.50 each. No Clubcard deal shown. Live-scraped Mar 2026
      weeklyCost: 74,
      selfShoppingMins: 5,
      calories: 510,            // VERIFIED — avg of 9 frozen Finest products. Range: 374–604 kcal. Live-scraped Mar 2026
      protein: 25,              // VERIFIED — avg of 9 frozen Finest products: 25.4g. Live-scraped Mar 2026
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'Tesco Finest frozen range. 9 products all £3.50 (no Clubcard deal on frozen Finest). Avg: 510 kcal, 25g protein. Products: Chicken Massaman, Sri Lankan Chicken, Chicken Tikka Masala, Coq Au Vin, Cottage Pie, Lamb Moussaka, Beef Lasagne, Beef Bourguignon, Mushroom & Chicken Risotto. Chilled Finest may have "Any 2 for £8" Clubcard = £4.00/meal — not re-verified Mar 2026. Live-scraped Mar 2026.',
    },

    {
      id: 'rm_ms',
      label: 'M&S Ready Meals',
      category: 'SRM',
      timeType: 'READY',
      costPerMeal: 3.33,        // VERIFIED — "Buy any 3 for £10" deal on Ocado. Live-scraped Mar 2026
      weeklyCost: 70,           // 21 × £3.33 (always buying in 3s so deal always applies)
      selfShoppingMins: 5,      // Ocado recurring order
      calories: 572,            // VERIFIED — average of 14 M&S ready meals on Ocado (two scrape runs). Range: 456–644 kcal. Live-scraped Mar 2026
      protein: 29,              // VERIFIED — average of 14 products: 29.1g protein. Range: 20–39g. Live-scraped Mar 2026
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: '"Buy any 3 for £10" Ocado deal = £3.33/meal (individual £4.00). NOTE: deal shown expiring 24/03/2026 — likely rolling, re-check if buying. Averages across 14 products: 572 kcal, 29g protein. Products: Spaghetti Carbonara, Chicken & Bacon Pasta Bake, Spaghetti Bolognese, Spaghetti & Meatballs, Macaroni Cheese, Beef Lasagne, Ham & Mushroom Tagliatelle, Steak Casserole, Fruity Chicken Curry, Chicken Alfredo, Sausage Ragu Rigatoni, Chilli Con Carne, Chicken Arrabbiata, Bangers & Mash. Macros on every Ocado product page.',
    },

    // ─── MEAL DELIVERY SERVICES ──────────────────────────────────────────────

    {
      id: 'svc_musclefood_bulk',
      label: 'Muscle Food (bulk)',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 3.99,        // buy 10 get 5 free = 15 meals for £59.90. Live-scraped Mar 2026
      weeklyCost: 84,
      selfShoppingMins: 0,      // delivered
      calories: 370,            // from website: rice pots 280-460 kcal
      protein: 31,              // 21-37g protein per pot
      dataQuality: 'verified',  // live-scraped Mar 2026
      baseline: false,
      dominated: false,
      notes: 'Buy 10 get 5 free = 15 for £59.90 = £3.99/meal. Individual £5.99, XL £6.99. 400g portions. UK-wide delivery.',
    },

    {
      id: 'svc_parsley_box',
      label: 'Parsley Box',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 4.67,        // VERIFIED — avg of 12 sampled products (range £4.10-£5.10). Live-scraped Mar 2026
      weeklyCost: 98,
      selfShoppingMins: 0,
      calories: 470,            // VERIFIED — average of 8 complete chicken meals (with rice/mash). Range: 357–697 kcal. Live-scraped Mar 2026
      protein: 23,              // VERIFIED — average of 8 products: 23.3g protein. Range: 17.5–29.3g. Live-scraped Mar 2026
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'AMBIENT meals (no freezer needed!), 6-month shelf life. Edinburgh HQ, UK-wide. Price range: £2.95-£6.95/meal (basic without sides ~£4-5, with rice/mash £5-6). Avg of 8 complete chicken meals (with rice/mash): 470 kcal, 23.3g protein, £4.67/meal. Products: Chicken a la King, Sweet & Sour Chicken, Chicken Chasseur, Thai Ginger & Lemon Chicken, Chicken Korma, Chicken Tikka Masala, Coq au Vin with Mash, Spanish Style Chicken. Note: Korma (697 kcal) and Tikka Masala (627 kcal) are outliers; other 6 avg ~406 kcal. Full macros on every product page. Free delivery on orders £50+.',
    },

    {
      id: 'svc_diced',
      label: 'Diced Meal Prep',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 5.99,        // VERIFIED — 20-meal/week recurring sub = 20% off £7.49. Live-scraped Mar 2026
      weeklyCost: 126,          // 21 × £5.99 (overage above 20 at £7.49 = minor rounding)
      selfShoppingMins: 0,
      calories: 556,            // VERIFIED — e.g. Chicken & Bacon Penne Alfredo: 556 kcal
      protein: 54,              // VERIFIED — same product: 54g protein. Full macros published on site
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'Edinburgh-based, Scotland & UK delivery (Wed/Sun). Standard £7.49/meal. Recurring sub: 5-meal=5% off, 10=10%, 15=15%, 20=20% off (= ~£5.99/meal). FIRSTORDER code = 20% off first order only — not recurring. Full macros (cal/protein/carbs/fat) on every product page. 6 yrs trading.',
    },

    {
      id: 'svc_simmer',
      label: 'Simmer Eats',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 7.49,        // VERIFIED — recurring rate for 10+ meals/week. Live-scraped Mar 2026
      weeklyCost: 157,          // 21 × £7.49 + £6.99 delivery
      selfShoppingMins: 0,
      calories: 545,            // VERIFIED — shown on menu (e.g. "545 kcal | 41.6g protein")
      protein: 42,              // VERIFIED — approx from menu display
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'UK-wide delivery. Recurring: £7.49/meal (10+ meals) + £6.99 delivery/order. Intro promos (50% off box 1, 30% off first 4) are NOT recurring. Partial macros shown on menu (cal + protein). 20,000+ customers, 1M+ meals sold.',
    },

    {
      id: 'svc_wiltshire',
      label: 'Wiltshire Farm Foods',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 5.40,        // VERIFIED — mid-range mains £4.99-£6.79, avg ~£5.40. Essentials from £2.99. Live-scraped Mar 2026
      weeklyCost: 113,
      selfShoppingMins: 0,
      calories: 487,            // VERIFIED — example: Chicken Katsu Curry 400g = 487 kcal. Full macros on every product page
      protein: 25,              // VERIFIED — same product: 25g protein
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'UK-wide (local depot model). Free delivery, no minimum. No subscription — order as needed. 330+ dishes incl. Essentials (£2.99-£3.95), standard (£4.99-£6.79), luxury (up to £7.55). Softer foods/mini meals range. Full macros published on every product page.',
    },

    {
      id: 'svc_blueberry_hill',
      label: 'Blueberry Hill',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 6.25,        // VERIFIED — mains £4.50-£7.50, typical £5.70-£6.80. Live-scraped Mar 2026
      weeklyCost: 131,
      selfShoppingMins: 0,
      calories: null,           // NOT published — no nutrition info on website. Contact hello@blueberryhillmeals.co.uk
      protein: null,            // NOT published — no nutrition info on website
      dataQuality: 'estimated', // price verified, macros unknown
      baseline: false,
      dominated: false,
      notes: 'Stirlingshire / Perthshire / Tayside only (NOT UK-wide). blueberryhillmeals.co.uk. ~82 main meal SKUs. Mains £4.50-£7.50 (typical £5.70-£6.80). Free delivery over £30, else £2.50. No subscription. Click & collect Stirling. Macros not published — contact for info.',
    },

    {
      id: 'svc_ouiprep',
      label: 'OuiPrep',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 6.00,        // VERIFIED — all main meals £6.00. Live-scraped Mar 2026
      weeklyCost: 126,
      selfShoppingMins: 0,
      calories: 373,            // VERIFIED — Roast Chicken product page: 373 kcal
      protein: 39,              // VERIFIED — same product: 39g protein
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'Glasgow / Edinburgh / Ayr. Tue & Fri delivery. All mains £6.00. Example: Roast Chicken — 373 kcal, 39g protein, 8g fat, 30g carbs. Lean + Bulk ranges available. Breakfast options £5.00.',
    },

    {
      id: 'svc_cook',
      label: 'COOK',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 4.33,        // VERIFIED — "3 for £13" deal = £4.33/meal (individual £5.00). Valid Jan–Mar 2026. Live-scraped Mar 2026
      weeklyCost: 91,
      selfShoppingMins: 0,
      calories: 319,            // VERIFIED — average of all 15 Pots for One products. Range: 229–397 kcal. Live-scraped Mar 2026
      protein: 18,              // VERIFIED — average of all 15 Pots for One products. Range: 9.3–26g. Live-scraped Mar 2026
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: '"Pots for One" range: "3 for £13" deal = £4.33/meal (individual £5.00, valid Jan–Mar 2026). Averages across all 15 products: 319 kcal, 18.2g protein. All under 400 kcal. Macros on product pages (HTML). UK-wide frozen delivery. Glasgow shop for collection.',
    },

    {
      id: 'svc_grate',
      label: 'Grate Meal Prep',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 6.50,        // VERIFIED — all mains £6.50. Live-scraped Mar 2026
      weeklyCost: 137,
      selfShoppingMins: 0,
      calories: 484,            // VERIFIED — Teriyaki Beef: 484 kcal. Full macros on each product page
      protein: 39,              // VERIFIED — Teriyaki Beef: 38.6g protein
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'Glasgow / Stirling. Cooked fresh same day. Mon/Tue/Wed delivery. Mains £6.50, lunches £4.00-£4.50. Example: Teriyaki Beef — 484 kcal, 38.6g protein, 59.6g carbs, 8.6g fat. Full macros published per product.',
    },

    {
      id: 'svc_riba',
      label: 'Riba Meal Prep',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 6.95,        // VERIFIED — all mains £6.95. Live-scraped Mar 2026
      weeklyCost: 146,
      selfShoppingMins: 0,
      calories: 570,            // VERIFIED — avg across 7 live menu items (503-596 kcal)
      protein: 59,              // VERIFIED — avg across 7 live menu items (47-65g). NutraCheck certified
      dataQuality: 'verified',
      baseline: false,
      dominated: false,
      notes: 'Glasgow/Ayr delivery Mon, nationwide Tue. All mains £6.95. Macros NutraCheck-certified. Tester bundle 5+5 pots £45. Menu rotates weekly.',
    },

    {
      id: 'svc_shaheds',
      label: "Shahed's Prep",
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 5.50,        // ESTIMATED — Lean/Low Carb from £5, Maintenance from £6. Exact dish prices JS-rendered. Research Mar 2026
      weeklyCost: 116,
      selfShoppingMins: 0,
      calories: null,           // Published on product pages but JS-rendered — not confirmed
      protein: null,            // Published on product pages but JS-rendered — not confirmed
      dataQuality: 'estimated',
      baseline: false,
      dominated: false,
      notes: 'Glasgow Southside only (within ~6 miles of Pollokshaws Rd G41 2AD). Delivery/collection Tue only. Order cutoff Sat 11pm. 100% Halal. £30 min order. Lean/Low Carb from £5, Maintenance from £6. Family business est. 1974. Macros on product pages but site JS-rendered.',
    },

    // svc_soupbox REMOVED: closed Nov/Dec 2025 — Food Standards Scotland enforcement action,
    // health warning issued Dec 2025, website (soupboxmealprep.co.uk) offline. Do not use.

    {
      id: 'svc_frive',
      label: 'Frive',
      category: 'SVC',
      timeType: 'READY',
      costPerMeal: 7.99,        // ESTIMATED — ~£7.99/meal on 6-meal plan. Was £10 (outdated). JS-rendered, exact tiers unconfirmed. Research Mar 2026
      weeklyCost: 168,
      selfShoppingMins: 0,
      calories: 500,            // ESTIMATED — meals under 600 kcal, many under 500. Range 400-600 kcal
      protein: 40,              // ESTIMATED — standard plans 35-40g+, high-protein 45g+
      dataQuality: 'estimated',
      baseline: false,
      dominated: false,
      notes: 'UK-wide delivery (was Edinburgh only — now nationwide). Formerly "Lions Prep", rebranded 2024. Based London (E14). Chilled meals, ready in 3 mins. 40-50 rotating weekly. UPF-free. Free delivery over £40. Intro promos (50%/30%/20% off weeks 1-4) NOT recurring.',
    },

  ],
};
