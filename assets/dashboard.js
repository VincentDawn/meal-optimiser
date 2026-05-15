// ═══════════════════════════════════
// STATE — loaded from meal-data.js
// ═══════════════════════════════════
const META = MEAL_DATASET.meta;
const OPTS = MEAL_DATASET.options;
const HEAT = META.heat_active_secs / 3600; // hours

// ── Personal settings (persisted in localStorage) ───────────────────────────
const LS = {
  rate: 'meal_optimiser_net_rate',
  meals: 'meal_optimiser_meals_per_week',
  instore: 'meal_optimiser_instore_mins',
  online: 'meal_optimiser_online_mins',
};
const DEFAULTS = { rate: 17.23, meals: META.meals_per_week, instore: 25, online: 5 };
const loadNum = (k, fallback) => {
  const v = parseFloat(localStorage.getItem(k));
  return isFinite(v) && v >= 0 ? v : fallback;
};
let NET_EMPLOYMENT = loadNum(LS.rate, DEFAULTS.rate);
let MEALS = loadNum(LS.meals, DEFAULTS.meals);
let INSTORE_MINS = loadNum(LS.instore, DEFAULTS.instore);
let ONLINE_MINS = loadNum(LS.online, DEFAULTS.online);

let TIME_VALUE = NET_EMPLOYMENT;

// ── Per-option overrides (drive time, delivery, availability) ───────────────
const OPTION_OVERRIDES_KEY = 'meal_optimiser_option_overrides';
let optionOverrides = {};
try {
  optionOverrides = JSON.parse(localStorage.getItem(OPTION_OVERRIDES_KEY) || '{}');
} catch (e) {}

function saveOverrides() {
  localStorage.setItem(OPTION_OVERRIDES_KEY, JSON.stringify(optionOverrides));
}

function setOverride(id, field, value) {
  if (!optionOverrides[id]) optionOverrides[id] = {};
  optionOverrides[id][field] = value;
  saveOverrides();
}

// Returns the user's override if set, else the default from OPTION_DEFAULTS,
// else undefined. `available` defaults to true.
function getField(opt, field) {
  const ov = optionOverrides[opt.id];
  if (ov && ov[field] !== undefined && ov[field] !== null) return ov[field];
  const def = typeof OPTION_DEFAULTS !== 'undefined' ? OPTION_DEFAULTS[opt.id] : null;
  if (def && def[field] !== undefined) return def[field];
  if (field === 'available') return true;
  return 0;
}

function isAvailable(opt) {
  const ov = optionOverrides[opt.id];
  if (ov && typeof ov.available === 'boolean') return ov.available;
  return true;
}

// Classify options into 4 shopping-type buckets based on selfShoppingMins:
//   0  + category=SVC                 = delivered
//   0  + category=MD (or other)       = work pickup / no trip
//   1..10                             = online recurring slot
//   >10                               = real in-store trip
function optType(opt) {
  const v = opt.selfShoppingMins || 0;
  if (v > 10) return 'in-store';
  if (v >= 1) return 'online slot';
  if (opt.category === 'SVC') return 'delivered';
  return 'no trip';
}

// Effective active shopping minutes per WEEK for an option.
function effectiveShoppingMins(opt) {
  const t = optType(opt);
  if (t === 'no trip') return 0;
  if (t === 'online slot') return ONLINE_MINS;
  if (t === 'delivered') return 0;
  // in-store: per-option override wins, else fall back to the global INSTORE_MINS
  const ov = optionOverrides[opt.id];
  if (ov && typeof ov.driveTimeMins === 'number') return ov.driveTimeMins;
  // Use the OPTION_DEFAULTS value if the user hasn't touched it AND it differs
  // from the global. Otherwise the global wins (so changing one global value
  // updates every option that hasn't been customised).
  return INSTORE_MINS;
}

/**
 * Weekly delivery cost for a delivered option, accounting for the supplier's
 * free-delivery-above-£N threshold.  Assumes one delivery order per week.
 *
 * @param {Object} opt   Option from MEAL_DATASET.options
 * @returns {number}     £ per week (0 if not delivered, free, or threshold met)
 */
function deliveryCostPerWeek(opt) {
  if (optType(opt) !== 'delivered') return 0;
  const fee = getField(opt, 'deliveryFeePerOrder') || 0;
  if (fee === 0) return 0;
  const freeAbove = getField(opt, 'deliveryFreeAbove') || 0;
  const weeklyMealCost = (opt.costPerMeal || 0) * MEALS;
  if (freeAbove > 0 && weeklyMealCost >= freeAbove) return 0;
  return fee;
}

/**
 * True total weekly cost: cost-per-meal × meals/week + amortised delivery.
 * Overrides any pre-baked `weeklyCost` field in meal-data.js (that field
 * was inconsistently maintained across older scrape commits).
 *
 * @param {Object} opt
 * @returns {number} £ per week
 */
function weeklyCost(opt) {
  return (opt.costPerMeal || 0) * MEALS + deliveryCostPerWeek(opt);
}

let COOK_MINS = (() => {
  const v = parseInt(localStorage.getItem('meal_optimiser_cook_mins'));
  return isFinite(v) && v >= 0 ? v : 8;
})();

const CAT_COLOR = {
  DIY: '#d29922',
  MD: '#f0883e',
  SRM: '#3fb950',
  SVC: '#58a6ff',
};
const CAT_LABEL = {
  DIY: 'Supermarket DIY',
  MD: 'Meal Deal Hybrid',
  SRM: 'Supermarket Ready Meals',
  SVC: 'Meal Delivery Services',
};

// ═══════════════════════════════════
// TIME CALCULATIONS
// ═══════════════════════════════════
function diyHrs() {
  return (MEALS * COOK_MINS) / 60;
}
function mdHrs() {
  return ((MEALS - 5) * COOK_MINS) / 60 + 5 / 60;
}
function readyHrs() {
  return MEALS * HEAT;
}

function activeHrs(opt, includeShopping) {
  let base = opt.timeType === 'DIY' ? diyHrs() : opt.timeType === 'MD' ? mdHrs() : readyHrs();
  if (includeShopping) base += effectiveShoppingMins(opt) / 60;
  return base;
}

function baselineHrs(includeShopping) {
  const b = OPTS.find(o => o.baseline);
  return activeHrs(b, includeShopping);
}

/**
 * Net weekly surplus of `opt` over the DIY-Farmfoods baseline, evaluated at
 * the user's hourly rate.  surplus = (hours saved × rate) - (extra £ spent).
 * Positive = the option pays for itself in time saved.
 *
 * @param {Object} opt
 * @param {boolean} includeShopping   true to add the in-person shopping trip
 * @returns {number} £ per week (0 for the baseline itself)
 */
function surplus(opt, includeShopping) {
  if (opt.baseline) return 0;
  const baseline = OPTS.find(o => o.baseline);
  const saved = baselineHrs(includeShopping) - activeHrs(opt, includeShopping);
  return saved * TIME_VALUE - (weeklyCost(opt) - weeklyCost(baseline));
}

/**
 * Break-even hourly rate (£/hr) at which `opt` becomes worth its extra cost.
 * Returns Infinity if the option saves no time (or costs MORE time) than the
 * baseline — those will never be justified by valuing time.
 *
 * @param {Object} opt
 * @returns {number|null}  null for the baseline itself
 */
function beNet(opt) {
  if (opt.baseline) return null;
  const baseline = OPTS.find(o => o.baseline);
  const saved = baselineHrs(false) - activeHrs(opt, false);
  const extra = weeklyCost(opt) - weeklyCost(baseline);
  if (saved <= 0) return Infinity;
  return extra / saved;
}

function catColor(opt) {
  if (opt.dominated) return '#484f58';
  if (opt.baseline) return '#d29922';
  return CAT_COLOR[opt.category] || '#8b949e';
}

// nonDominated() = options worth showing in charts/rankings.
// Excludes user-marked-unavailable options, and excludes data-flagged
// "dominated" ones unless the user has opted to show them. Baseline is
// always retained so comparisons remain anchored.
function nonDominated() {
  return OPTS.filter(o => (showDominated || !o.dominated) && (o.baseline || isAvailable(o)));
}

// ═══════════════════════════════════
// CHARTS
// ═══════════════════════════════════
let surplusChart, scatterChart, breakChart;

function buildCharts() {
  const sorted = nonDominated()
    .filter(o => !o.baseline)
    .sort((a, b) => surplus(b, false) - surplus(a, false));

  // surplus — grouped bars
  surplusChart = new Chart(document.getElementById('surplusChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: sorted.map(o => o.label),
      datasets: [
        {
          label: 'Delivered / no shopping trip',
          data: sorted.map(o => parseFloat(surplus(o, false).toFixed(1))),
          backgroundColor: sorted.map(o => surplusColor(surplus(o, false))),
          borderRadius: 3,
        },
        {
          label: 'You do the shopping',
          data: sorted.map(o => parseFloat(surplus(o, true).toFixed(1))),
          backgroundColor: sorted.map(o => surplusColor(surplus(o, true)) + '66'),
          borderColor: sorted.map(o => surplusColor(surplus(o, true))),
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8b949e', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const opt = sorted[ctx.dataIndex];
              const v = ctx.raw;
              return `£${v >= 0 ? '+' : ''}${v.toFixed(0)}/wk · BE: £${beNet(opt)?.toFixed(2) || 'N/A'}/hr net`;
            },
          },
        },
      },
      scales: {
        x: { grid: { color: '#21262d' }, ticks: { color: '#6e7681', callback: v => '£' + v } },
        y: { grid: { color: '#21262d' }, ticks: { color: '#aaa', font: { size: 10 } } },
      },
    },
    plugins: [zeroLinePlugin],
  });

  // scatter
  const scatterDatasets = OPTS.map(opt => ({
    label: opt.label,
    data: [{ x: activeHrs(opt, false), y: weeklyCost(opt) }],
    backgroundColor: catColor(opt),
    pointRadius: opt.baseline ? 11 : 7,
    pointStyle: opt.baseline ? 'triangle' : 'circle',
  }));
  scatterDatasets.push(breakEvenLineDataset());

  scatterChart = new Chart(document.getElementById('scatter').getContext('2d'), {
    type: 'scatter',
    data: { datasets: scatterDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ctx => ctx[0].dataset.label,
            label: ctx => `£${ctx.raw.y.toFixed(0)}/wk · ${ctx.raw.x.toFixed(2)} hrs active`,
          },
        },
        zoom: {
          // Plain click+drag pans (no modifier key needed). Hover/click on
          // a point still works — the plugin only initiates pan on
          // mousedowns that aren't on a dataset point.
          pan: { enabled: true, mode: 'xy' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
          limits: { x: { min: 0, max: 5 }, y: { min: 0, max: 300 } },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Weekly Active Time (hrs)', color: '#6e7681' },
          grid: { color: '#21262d' },
          ticks: { color: '#6e7681' },
          min: 0,
          max: 3.5,
        },
        y: {
          title: { display: true, text: 'Weekly Cost (£)', color: '#6e7681' },
          grid: { color: '#21262d' },
          ticks: { color: '#6e7681', callback: v => '£' + v },
          min: 0,
          max: 240,
        },
      },
    },
    // Tooltips on hover show the option name (Chart.js default); zoom + pan
    // let the user dig into clusters that would otherwise overlap.
    plugins: [],
  });

  // break-even bar
  const beData = OPTS.filter(o => !o.baseline && !o.dominated).sort(
    (a, b) => (beNet(a) ?? Infinity) - (beNet(b) ?? Infinity)
  );
  breakChart = new Chart(document.getElementById('barBreak').getContext('2d'), {
    type: 'bar',
    data: {
      labels: beData.map(o => o.label),
      datasets: [
        {
          data: beData.map(o => {
            const b = beNet(o);
            return b === Infinity ? null : parseFloat(b.toFixed(2));
          }),
          backgroundColor: beData.map(o => beColor(o)),
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `£${ctx.raw?.toFixed(2) || '?'}/hr net` } },
      },
      scales: {
        x: {
          grid: { color: '#21262d' },
          ticks: { color: '#6e7681', callback: v => '£' + v },
          max: 75,
        },
        y: { grid: { color: '#21262d' }, ticks: { color: '#aaa', font: { size: 10 } } },
      },
    },
    plugins: [rateLinePlugin],
  });
}

// ═══════════════════════════════════
// PLUGINS
// ═══════════════════════════════════
const zeroLinePlugin = {
  id: 'zeroLine',
  afterDraw(chart) {
    const {
      ctx,
      scales: { x },
      chartArea,
    } = chart;
    const x0 = x.getPixelForValue(0);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, chartArea.top);
    ctx.lineTo(x0, chartArea.bottom);
    ctx.strokeStyle = '#484f58';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  },
};

const rateLinePlugin = {
  id: 'rateLine',
  afterDraw(chart) {
    const {
      ctx,
      scales: { x },
      chartArea,
    } = chart;
    const xp = x.getPixelForValue(TIME_VALUE);
    if (xp < chartArea.left || xp > chartArea.right) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xp, chartArea.top);
    ctx.lineTo(xp, chartArea.bottom);
    ctx.strokeStyle = '#d29922';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.fillStyle = '#d29922';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Your value', xp, chartArea.top - 5);
    ctx.restore();
  },
};

// ═══════════════════════════════════
// HELPERS
// ═══════════════════════════════════
function surplusColor(v) {
  if (v > 40) return '#3fb950';
  if (v > 15) return '#56d364';
  if (v > 0) return '#7ee787';
  return '#f85149';
}
function beColor(opt) {
  const b = beNet(opt);
  if (b === Infinity || b === null) return '#484f58';
  return b <= TIME_VALUE ? catColor(opt) : '#f85149';
}
function breakEvenLineDataset() {
  const base = baselineHrs(false);
  const baseCost = weeklyCost(OPTS.find(o => o.baseline));
  const pts = [];
  for (let h = 0; h <= 3.3; h += 0.1) {
    const y = baseCost + (base - h) * TIME_VALUE;
    if (y >= 0 && y <= 240) pts.push({ x: parseFloat(h.toFixed(1)), y: parseFloat(y.toFixed(1)) });
  }
  return {
    label: 'Break-even line',
    data: pts,
    type: 'line',
    borderColor: '#238636',
    borderWidth: 2,
    borderDash: [7, 5],
    pointRadius: 0,
    fill: false,
    tension: 0,
    backgroundColor: 'transparent',
  };
}
function dqBadge(q) {
  if (q === 'verified') return '<span class="dq-v">● verified</span>';
  if (q === 'estimated') return '<span class="dq-e">● estimated</span>';
  return '<span class="dq-u">● unknown</span>';
}

// ═══════════════════════════════════
// UPDATE
// ═══════════════════════════════════
function updateAll() {
  const diy = diyHrs();
  const ready = readyHrs();

  // Stats
  document.getElementById('sNetRate').textContent = `£${NET_EMPLOYMENT.toFixed(2)}/hr`;
  document.getElementById('sDIY').textContent = `${diy.toFixed(2)} hrs`;
  document.getElementById('sSave').textContent = `${(diy - ready).toFixed(2)} hrs/wk`;
  document.getElementById('sMaxVal').textContent = `£${((diy - ready) * TIME_VALUE).toFixed(0)}/wk`;

  // Top 3 — ranked by the user's chosen preset
  const preset = PRESETS[currentPreset];
  const eligible = OPTS.filter(
    o => !o.baseline && (showDominated || !o.dominated) && isAvailable(o)
  );
  const ranked = rankByPreset(eligible).filter(r => r.s != null);
  const medals = ['🥇', '🥈', '🥉'],
    cls = ['gold', 'silver', 'bronze'];
  document.getElementById('top3').innerHTML =
    ranked
      .slice(0, 3)
      .map(
        ({ opt: o }, i) =>
          `<div class="top3-card ${cls[i]}">
      <div class="medal">${medals[i]}</div>
      <div class="medal-name">${o.label}</div>
      <div class="medal-surplus">${preset.fmt(preset.score(o))}</div>
      <div class="medal-stat">£${o.costPerMeal?.toFixed(2) || '?'}/meal · ${o.protein != null ? o.protein.toFixed(1) + 'g protein' : ''} · ${o.calories != null ? o.calories + ' kcal' : ''}</div>
    </div>`
      )
      .join('') ||
    '<div style="color:#f85149;font-size:0.85rem;padding:12px">No options match this objective with the current data.</div>';

  // Surplus chart update
  const sorted = nonDominated()
    .filter(o => !o.baseline)
    .sort((a, b) => surplus(b, false) - surplus(a, false));
  surplusChart.data.labels = sorted.map(o => o.label);
  surplusChart.data.datasets[0].data = sorted.map(o => parseFloat(surplus(o, false).toFixed(1)));
  surplusChart.data.datasets[0].backgroundColor = sorted.map(o => surplusColor(surplus(o, false)));
  surplusChart.data.datasets[1].data = sorted.map(o => parseFloat(surplus(o, true).toFixed(1)));
  surplusChart.data.datasets[1].backgroundColor = sorted.map(
    o => surplusColor(surplus(o, true)) + '66'
  );
  surplusChart.data.datasets[1].borderColor = sorted.map(o => surplusColor(surplus(o, true)));
  surplusChart.update('none');

  // Scatter update
  OPTS.forEach((opt, i) => {
    if (scatterChart.data.datasets[i]) {
      scatterChart.data.datasets[i].data = [{ x: activeHrs(opt, false), y: weeklyCost(opt) }];
    }
  });
  const lastIdx = scatterChart.data.datasets.length - 1;
  scatterChart.data.datasets[lastIdx] = breakEvenLineDataset();
  scatterChart.update('none');

  // Break-even chart update
  const beData = OPTS.filter(o => !o.baseline && !o.dominated).sort(
    (a, b) => (beNet(a) ?? Infinity) - (beNet(b) ?? Infinity)
  );
  breakChart.data.datasets[0].data = beData.map(o => {
    const b = beNet(o);
    return b === Infinity ? null : parseFloat(b.toFixed(2));
  });
  breakChart.data.datasets[0].backgroundColor = beData.map(o => beColor(o));
  breakChart.update('none');

  // Table — within each category section, sort options by the chosen preset
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  ['DIY', 'MD', 'SRM', 'SVC'].forEach(sec => {
    const secOpts = OPTS.filter(o => o.category === sec);
    // Baseline options stay first; everything else sorted by preset score
    const baselines = secOpts.filter(o => o.baseline);
    const others = rankByPreset(secOpts.filter(o => !o.baseline)).map(r => r.opt);
    const sorted = [...baselines, ...others];
    const hdr = document.createElement('tr');
    hdr.className = 'sec';
    hdr.innerHTML = `<td colspan="14">${CAT_LABEL[sec]}</td>`;
    tbody.appendChild(hdr);
    sorted.forEach(opt => {
      const be = beNet(opt);
      const sp = surplus(opt, false);
      const spSelf = surplus(opt, true);
      const justified = be !== null && be !== Infinity && be <= TIME_VALUE;
      const dominated = be === Infinity;
      const tr = document.createElement('tr');
      if (opt.baseline) tr.className = 'baseline';
      else if (opt.dominated) tr.className = 'dominated';

      const badge = opt.baseline
        ? '<span class="pill pa">Baseline</span>'
        : dominated
          ? '<span class="pill pgr">Dominated</span>'
          : justified
            ? '<span class="pill pg">✓ Yes</span>'
            : `<span class="pill pr">✗ No</span><div class="unlock-note">needs £${be?.toFixed(2) || '?'}/hr</div>`;

      const kcalPer100 = opt.calories ? ((opt.costPerMeal / opt.calories) * 100).toFixed(2) : '—';
      const protPer10 = opt.protein ? ((opt.costPerMeal / opt.protein) * 10).toFixed(2) : '—';

      tr.innerHTML = `
        <td><strong style="color:${catColor(opt)}">${opt.label}</strong><span class="sm-note">${opt.notes}</span></td>
        <td>£${opt.costPerMeal?.toFixed(2) || '?'}</td>
        <td>£${weeklyCost(opt).toFixed(0)}/wk${deliveryCostPerWeek(opt) > 0 ? ` <span class="sm-note">(incl. £${deliveryCostPerWeek(opt).toFixed(2)} delivery)</span>` : ''}</td>
        <td>${activeHrs(opt, false).toFixed(2)} hrs</td>
        <td>${activeHrs(opt, true).toFixed(2)} hrs</td>
        <td>${opt.baseline ? '—' : `<span class="${sp >= 0 ? 'pos' : 'neg'}">£${sp >= 0 ? '+' : ''}${sp.toFixed(0)}/wk</span>`}</td>
        <td>${opt.baseline ? '—' : `<span class="${spSelf >= 0 ? 'pos' : 'neg'}">£${spSelf >= 0 ? '+' : ''}${spSelf.toFixed(0)}/wk</span>`}</td>
        <td>${be === null ? '—' : dominated ? 'N/A' : '£' + be.toFixed(2) + '/hr'}</td>
        <td>${opt.calories ?? '—'}</td>
        <td>${opt.protein != null ? opt.protein + 'g' : '—'}</td>
        <td>${kcalPer100 !== '—' ? '£' + kcalPer100 : '—'}</td>
        <td>${protPer10 !== '—' ? '£' + protPer10 : '—'}</td>
        <td>${dqBadge(opt.dataQuality)}</td>
        <td>${badge}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// ── Per-store settings table ────────────────────────────────────────────────
const CAT_ORDER = ['DIY', 'MD', 'SRM', 'SVC'];

function renderPerStoreTable() {
  const tbody = document.querySelector('#psTable tbody');
  tbody.innerHTML = '';
  for (const cat of CAT_ORDER) {
    const opts = OPTS.filter(o => o.category === cat);
    if (!opts.length) continue;
    const headerRow = document.createElement('tr');
    headerRow.className = 'ps-cat';
    headerRow.innerHTML = `<td colspan="7">${CAT_LABEL[cat] || cat}</td>`;
    tbody.appendChild(headerRow);
    for (const opt of opts) {
      tbody.appendChild(renderPerStoreRow(opt));
    }
  }
}

function renderPerStoreRow(opt) {
  const tr = document.createElement('tr');
  const t = optType(opt);
  const avail = isAvailable(opt);
  if (!avail) tr.classList.add('ps-unavail');

  // Drive only relevant for in-store; delivery only for delivered
  const showDrive = t === 'in-store';
  const showDelivery = t === 'delivered';

  // Drive time: show the override if set, else the global INSTORE_MINS as the implicit default.
  const driveOverride = optionOverrides[opt.id]?.driveTimeMins;
  const drive = showDrive ? (typeof driveOverride === 'number' ? driveOverride : INSTORE_MINS) : '';
  const fee = showDelivery ? getField(opt, 'deliveryFeePerOrder') : '';
  const freeAbove = showDelivery ? getField(opt, 'deliveryFreeAbove') : '';
  const minOrd = showDelivery ? getField(opt, 'minOrder') : '';

  tr.innerHTML = `
    <td><strong>${opt.label}</strong></td>
    <td><span class="ps-type">${t}</span></td>
    <td class="ps-avail-cell">
      <input type="checkbox" data-id="${opt.id}" data-field="available" ${avail ? 'checked' : ''}>
    </td>
    <td class="num">${
      showDrive
        ? `<input type="number" min="0" max="180" step="1" value="${drive}" data-id="${opt.id}" data-field="driveTimeMins">`
        : '<span class="ps-na">—</span>'
    }</td>
    <td class="num">${
      showDelivery
        ? `<input type="number" min="0" max="50" step="0.01" value="${fee}" data-id="${opt.id}" data-field="deliveryFeePerOrder">`
        : '<span class="ps-na">—</span>'
    }</td>
    <td class="num">${
      showDelivery
        ? `<input type="number" min="0" max="500" step="1" value="${freeAbove}" data-id="${opt.id}" data-field="deliveryFreeAbove">`
        : '<span class="ps-na">—</span>'
    }</td>
    <td class="num">${
      showDelivery
        ? `<input type="number" min="0" max="200" step="1" value="${minOrd}" data-id="${opt.id}" data-field="minOrder">`
        : '<span class="ps-na">—</span>'
    }</td>
  `;
  return tr;
}

function attachPerStoreHandlers() {
  document.querySelectorAll('#psTable input').forEach(inp => {
    inp.addEventListener('change', e => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      let value;
      if (e.target.type === 'checkbox') {
        value = e.target.checked;
      } else {
        value = parseFloat(e.target.value);
        if (isNaN(value) || value < 0) return;
      }
      setOverride(id, field, value);
      // Re-render the row's strikethrough state if availability flipped
      if (field === 'available') {
        const tr = e.target.closest('tr');
        if (value) tr.classList.remove('ps-unavail');
        else tr.classList.add('ps-unavail');
      }
      updateAll();
    });
  });
}

// Exposed on window because it's called from an inline onclick="" in the
// per-store-settings disclosure markup.  Direct attachment to window keeps
// ESLint happy (no false-positive "unused" warning) and signals intent.
window.resetPerStoreOverrides = function () {
  if (!confirm('Reset all per-store overrides back to defaults? This cannot be undone.')) return;
  optionOverrides = {};
  saveOverrides();
  renderPerStoreTable();
  attachPerStoreHandlers();
  updateAll();
};

// ── Live aggregation from scraped product files ─────────────────────────────
// For supermarket/service options that we have a full scraped product list
// for, we compute the cost/kcal/protein averages in the browser at boot
// (and again whenever the user's exclusions change in another tab).  This
// replaces the older flow where a Python script regex-patched meal-data.js.
//
// Each entry maps an option id to its scraper output, the localStorage key
// the corresponding filter page uses for exclusions, and the per-supplier
// rule for which "price" to take (Tesco prefers Clubcard, M&S prefers the
// 3-for-£10 deal price, Parsley Box has only one price).
const SCRAPED_SUPPLIERS = {
  rm_tesco: {
    productsUrl: 'data/tesco_all_products.json',
    productsKey: 'frozen',
    lsKey: 'excl_tesco',
    priceFn: p => p.ccPrice ?? p.price,
  },
  rm_ms: {
    productsUrl: 'data/ms_all_products.json',
    productsKey: null, // bare list at JSON root
    lsKey: 'excl_ms',
    priceFn: p => p.dealPrice ?? p.ccPrice ?? p.price,
  },
  svc_parsley_box: {
    productsUrl: 'data/parsleybox_all_products.json',
    productsKey: 'products',
    lsKey: 'excl_parsleybox',
    priceFn: p => p.price,
  },
};

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

/**
 * Fetch a supplier's scraped product catalogue and compute the average
 * cost / kcal / protein, with the user's per-supplier exclusions (saved
 * by the corresponding filter page in localStorage) applied.
 *
 * @param {Object} cfg                 SCRAPED_SUPPLIERS entry
 * @param {string} cfg.productsUrl     path to the JSON catalogue
 * @param {string|null} cfg.productsKey  key under which the array lives, or null for bare-list JSONs
 * @param {string} cfg.lsKey           localStorage key for the exclusion list
 * @param {(p: Object) => number} cfg.priceFn  per-product price extractor
 * @returns {Promise<{costPerMeal:number,calories:number,protein:number,keptCount:number} | null>}
 *          null on network failure or missing file (caller should fall back to defaults)
 */
async function aggregate(cfg) {
  let raw;
  try {
    const r = await fetch(cfg.productsUrl, { cache: 'no-store' });
    if (!r.ok) return null;
    raw = await r.json();
  } catch (e) {
    return null; // network error or missing file → keep meal-data.js defaults
  }
  const products = Array.isArray(raw) ? raw : (cfg.productsKey ? raw[cfg.productsKey] : []) || [];

  let excluded = new Set();
  try {
    (JSON.parse(localStorage.getItem(cfg.lsKey) || '[]') || []).forEach(id => excluded.add(id));
  } catch (e) {}

  const kept = products.filter(p => !excluded.has(p.id));
  const prices = kept.map(cfg.priceFn).filter(x => typeof x === 'number' && x > 0);
  const kcals = kept.map(p => p.kcal).filter(x => typeof x === 'number' && x > 100 && x < 1500);
  const proteins = kept.map(p => p.protein).filter(x => typeof x === 'number' && x > 1 && x < 100);

  const ap = avg(prices);
  const ak = avg(kcals);
  const apr = avg(proteins);
  return {
    costPerMeal: ap != null ? +ap.toFixed(2) : null,
    calories: ak != null ? Math.round(ak) : null,
    protein: apr != null ? +apr.toFixed(1) : null,
    keptCount: kept.length,
  };
}

async function applyScrapedAverages() {
  await Promise.all(
    Object.entries(SCRAPED_SUPPLIERS).map(async ([id, cfg]) => {
      const stats = await aggregate(cfg);
      if (!stats) return;
      const opt = OPTS.find(o => o.id === id);
      if (!opt) return;
      if (stats.costPerMeal != null) opt.costPerMeal = stats.costPerMeal;
      if (stats.calories != null) opt.calories = stats.calories;
      if (stats.protein != null) opt.protein = stats.protein;
    })
  );
}

// ── Show "always worse" toggle (load from localStorage) ────────────────────
const SHOW_DOM_LS = 'meal_optimiser_show_dominated';
let showDominated = localStorage.getItem(SHOW_DOM_LS) === '1';

// ── Optimisation presets ────────────────────────────────────────────────────
// Each preset returns a score for an option; higher = better (we always
// sort descending).  null score = "no data" — those rows sink to the bottom.
const PRESETS = {
  surplus: {
    label: 'Best surplus vs DIY',
    hint: 'Cost saved + time saved (priced at your hourly rate) versus the DIY Farmfoods baseline. The default — uses the same maths as the surplus chart.',
    score: opt => (opt.baseline ? null : surplus(opt, false)),
    fmt: s =>
      s == null ? '—' : s >= 0 ? `+£${s.toFixed(0)}/wk` : `-£${Math.abs(s).toFixed(0)}/wk`,
  },
  cheapest: {
    label: 'Cheapest weekly',
    hint: 'Lowest total weekly cost, ignoring time spent.',
    score: opt => -weeklyCost(opt),
    fmt: s => `£${(-s).toFixed(0)}/wk`,
  },
  proteinPerPound: {
    label: 'Most protein per £',
    hint: 'Maximise grams of protein per pound spent. Skips options without protein data.',
    score: opt => (opt.protein && opt.costPerMeal ? opt.protein / opt.costPerMeal : null),
    fmt: s => (s == null ? '—' : `${s.toFixed(1)} g/£`),
  },
  kcalPerPound: {
    label: 'Most calories per £',
    hint: 'Maximise calories per pound spent. Useful if "more food = better".',
    score: opt => (opt.calories && opt.costPerMeal ? opt.calories / opt.costPerMeal : null),
    fmt: s => (s == null ? '—' : `${Math.round(s)} kcal/£`),
  },
  highestProtein: {
    label: 'Highest protein/meal',
    hint: 'Most grams of protein per meal regardless of price.',
    score: opt => opt.protein ?? null,
    fmt: s => (s == null ? '—' : `${s.toFixed(1)} g/meal`),
  },
  leastTime: {
    label: 'Least active time',
    hint: 'Minimise active time spent per week (cooking + shopping).',
    score: opt => -activeHrs(opt, true),
    fmt: s => `${(-s).toFixed(2)} hr/wk`,
  },
  custom: {
    label: 'Custom…',
    hint: 'Set your own weights. Each metric is normalised across the option set, then summed weighted. Set a weight to 0 to ignore that metric.',
    // Custom uses a closure over CUSTOM_WEIGHTS computed against the current
    // option set — see scoreCustom() below for the actual logic.  Score
    // function here is filled in lazily before each render.
    score: opt => scoreCustom(opt),
    fmt: s => (s == null ? '—' : s.toFixed(3)),
  },
};

// ── Custom preset weights (persisted) ───────────────────────────────────────
const CUSTOM_LS = 'meal_optimiser_custom_weights';
const DEFAULT_WEIGHTS = { cost: 50, protein: 50, kcal: 25, time: 25 };
let CUSTOM_WEIGHTS = (() => {
  try {
    return { ...DEFAULT_WEIGHTS, ...JSON.parse(localStorage.getItem(CUSTOM_LS) || '{}') };
  } catch (e) {
    return { ...DEFAULT_WEIGHTS };
  }
})();

// Re-computed each updateAll(): min/max of each metric across eligible
// options, used to normalise to 0..1 for the weighted-sum score.
let CUSTOM_RANGES = null;

function recomputeCustomRanges() {
  const eligible = OPTS.filter(
    o => !o.baseline && (showDominated || !o.dominated) && isAvailable(o)
  );
  const costs = eligible.map(o => weeklyCost(o)).filter(Number.isFinite);
  const proteins = eligible.map(o => o.protein).filter(x => typeof x === 'number');
  const kcals = eligible.map(o => o.calories).filter(x => typeof x === 'number');
  const times = eligible.map(o => activeHrs(o, true)).filter(Number.isFinite);
  const r = arr =>
    arr.length ? { min: Math.min(...arr), max: Math.max(...arr) } : { min: 0, max: 1 };
  CUSTOM_RANGES = { cost: r(costs), protein: r(proteins), kcal: r(kcals), time: r(times) };
}

// Returns 0..1 — null inputs treated as worst-of-set so they don't get a free pass
function norm(value, range, lowerIsBetter) {
  if (range.max === range.min) return 0.5;
  if (value == null || !isFinite(value)) return 0;
  const t = (value - range.min) / (range.max - range.min);
  return lowerIsBetter ? 1 - t : t;
}

/**
 * Score function for the "Custom" optimisation preset.  Each metric is
 * normalised to 0..1 across the eligible option set (see CUSTOM_RANGES),
 * then combined as a weighted sum / sum-of-weights.  Direction of "better"
 * is hard-coded per metric: lower = better for cost+time, higher = better
 * for protein+kcal.  Set a weight to 0 to drop that metric entirely.
 *
 * @param {Object} opt
 * @returns {number} 0..1
 */
function scoreCustom(opt) {
  if (!CUSTOM_RANGES) recomputeCustomRanges();
  const r = CUSTOM_RANGES;
  const W = CUSTOM_WEIGHTS;
  const cost = norm(weeklyCost(opt), r.cost, /*lowerIsBetter*/ true);
  const protein = norm(opt.protein, r.protein, false);
  const kcal = norm(opt.calories, r.kcal, false);
  const time = norm(activeHrs(opt, true), r.time, true);
  const totalW = W.cost + W.protein + W.kcal + W.time || 1;
  return (W.cost * cost + W.protein * protein + W.kcal * kcal + W.time * time) / totalW;
}

function renderCustomSliders() {
  const slot = document.getElementById('customSliders');
  if (!slot) return;
  if (currentPreset !== 'custom') {
    slot.style.display = 'none';
    return;
  }
  slot.style.display = '';
  slot.innerHTML = `
    <div class="custom-grid">
      ${[
        ['cost', 'Cost', 'lower = better'],
        ['protein', 'Protein', 'higher = better'],
        ['kcal', 'Calories', 'higher = better'],
        ['time', 'Active time', 'lower = better'],
      ]
        .map(
          ([k, label, dir]) => `
        <div class="custom-row">
          <label>${label} <span class="custom-dir">(${dir})</span> <span class="custom-val" id="cw-${k}-val">${CUSTOM_WEIGHTS[k]}</span></label>
          <input type="range" id="cw-${k}" min="0" max="100" step="1" value="${CUSTOM_WEIGHTS[k]}">
        </div>
      `
        )
        .join('')}
    </div>
  `;
  ['cost', 'protein', 'kcal', 'time'].forEach(k => {
    const inp = document.getElementById('cw-' + k);
    inp.addEventListener('input', e => {
      CUSTOM_WEIGHTS[k] = parseInt(e.target.value);
      document.getElementById('cw-' + k + '-val').textContent = CUSTOM_WEIGHTS[k];
      localStorage.setItem(CUSTOM_LS, JSON.stringify(CUSTOM_WEIGHTS));
      recomputeCustomRanges();
      updateAll();
    });
  });
}

const PRESET_LS = 'meal_optimiser_preset';
let currentPreset = PRESETS[localStorage.getItem(PRESET_LS)]
  ? localStorage.getItem(PRESET_LS)
  : 'surplus';

function rankByPreset(opts) {
  const p = PRESETS[currentPreset];
  // The custom preset normalises across the option set — recompute ranges
  // before scoring or you'll be ranking against stale min/max.
  if (currentPreset === 'custom') recomputeCustomRanges();
  return opts
    .map(o => ({ opt: o, s: p.score(o) }))
    .sort((a, b) => {
      // null scores sink to bottom
      if (a.s == null && b.s == null) return 0;
      if (a.s == null) return 1;
      if (b.s == null) return -1;
      return b.s - a.s;
    });
}

function renderOptPills() {
  const wrap = document.getElementById('optPills');
  wrap.innerHTML = Object.entries(PRESETS)
    .map(
      ([key, p]) =>
        `<button type="button" class="opt-pill ${key === currentPreset ? 'active' : ''}" data-preset="${key}">${p.label}</button>`
    )
    .join('');
  document.getElementById('optHint').textContent = PRESETS[currentPreset].hint;
  wrap.querySelectorAll('.opt-pill').forEach(b => {
    b.addEventListener('click', () => {
      currentPreset = b.dataset.preset;
      localStorage.setItem(PRESET_LS, currentPreset);
      if (currentPreset === 'custom') recomputeCustomRanges();
      renderOptPills();
      renderCustomSliders();
      updateAll();
    });
  });
  renderCustomSliders();
}

// ── Boot ────────────────────────────────────────────────────────────────────
async function init() {
  document.getElementById('netRateInput').value = NET_EMPLOYMENT.toFixed(2);
  document.getElementById('mealsInput').value = MEALS;
  document.getElementById('cookInput').value = COOK_MINS;
  document.getElementById('instoreInput').value = INSTORE_MINS;
  document.getElementById('onlineInput').value = ONLINE_MINS;
  document.getElementById('showDominatedInput').checked = showDominated;

  renderOptPills();
  renderPerStoreTable();
  attachPerStoreHandlers();

  // Override scraped-supplier values with live computed averages BEFORE charts
  // build, so their initial render uses fresh numbers.  If fetches fail (file
  // missing, offline) we fall back silently to the meal-data.js defaults.
  await applyScrapedAverages();

  buildCharts();
  updateAll();

  // Double-click anywhere on the scatter to reset zoom/pan
  const scatterEl = document.getElementById('scatter');
  scatterEl.addEventListener('dblclick', () => {
    if (scatterChart) scatterChart.resetZoom();
  });

  // Browser zoom (Ctrl +/-) doesn't reliably fire ResizeObserver on Chart.js's
  // canvas containers, so the charts get visibly skewed after a zoom change
  // and only recover on a full reload.  Debounced resize on window AND
  // visualViewport catches both viewport changes and zoom changes.
  let resizeTimer;
  function refreshAllCharts() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      [surplusChart, scatterChart, breakChart].forEach(c => {
        if (c) c.resize();
      });
    }, 120);
  }
  window.addEventListener('resize', refreshAllCharts);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', refreshAllCharts);
  }

  // Per-supplier freshness summary in the per-store settings disclosure
  if (window.Freshness) {
    Freshness.freshnessSummary().then(s => {
      const el = document.getElementById('freshness-summary');
      if (el) el.textContent = s || 'unknown';
    });
  }

  window.__appReady = true; // signal for tests / cross-tab listeners
}
init();

// React to filter-page edits in OTHER tabs — the "storage" event fires
// whenever localStorage is mutated by a different tab.
window.addEventListener('storage', async e => {
  if (!e.key) return;
  const lsKeys = Object.values(SCRAPED_SUPPLIERS).map(c => c.lsKey);
  if (!lsKeys.includes(e.key)) return;
  await applyScrapedAverages();
  updateAll();
});

document.getElementById('netRateInput').addEventListener('change', e => {
  const v = parseFloat(e.target.value);
  if (!v || v <= 0) return;
  NET_EMPLOYMENT = v;
  TIME_VALUE = v; // collapsed: rate IS the time value
  localStorage.setItem(LS.rate, v);
  updateAll();
});
document.getElementById('mealsInput').addEventListener('change', e => {
  const v = parseInt(e.target.value);
  if (!v || v < 1) return;
  MEALS = v;
  localStorage.setItem(LS.meals, v);
  updateAll();
});
document.getElementById('cookInput').addEventListener('change', e => {
  const v = parseInt(e.target.value);
  if (isNaN(v) || v < 0) return;
  COOK_MINS = v;
  // No localStorage key was wired before — add one so this persists like the rest.
  localStorage.setItem('meal_optimiser_cook_mins', v);
  updateAll();
});
document.getElementById('instoreInput').addEventListener('change', e => {
  const v = parseInt(e.target.value);
  if (isNaN(v) || v < 0) return;
  INSTORE_MINS = v;
  localStorage.setItem(LS.instore, v);
  // Re-render per-store table so any unoverridden in-store rows show the new global
  renderPerStoreTable();
  attachPerStoreHandlers();
  updateAll();
});
document.getElementById('onlineInput').addEventListener('change', e => {
  const v = parseInt(e.target.value);
  if (isNaN(v) || v < 0) return;
  ONLINE_MINS = v;
  localStorage.setItem(LS.online, v);
  updateAll();
});
document.getElementById('showDominatedInput').addEventListener('change', e => {
  showDominated = e.target.checked;
  localStorage.setItem(SHOW_DOM_LS, showDominated ? '1' : '0');
  // Rebuild charts so the surplus/scatter/break-even datasets pick up the new set.
  if (typeof surplusChart !== 'undefined' && surplusChart) surplusChart.destroy();
  if (typeof scatterChart !== 'undefined' && scatterChart) scatterChart.destroy();
  if (typeof breakChart !== 'undefined' && breakChart) breakChart.destroy();
  buildCharts();
  updateAll();
});
