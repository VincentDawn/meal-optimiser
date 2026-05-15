// freshness.js — fetches data/_meta.json and shows when each supplier's
// catalogue was last scraped.  Used by the four filter pages and by the
// analysis dashboard.

(function () {
  function relative(iso) {
    if (!iso) return '?';
    const then = new Date(iso);
    if (isNaN(then.getTime())) return '?';
    const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }

  function absolute(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function format(iso) {
    return `${absolute(iso)} (${relative(iso)})`;
  }

  // Promise resolving to the parsed _meta object; cached so each page only
  // hits the network once even if multiple consumers ask.
  let metaPromise = null;
  function loadMeta() {
    if (!metaPromise) {
      metaPromise = fetch('data/_meta.json', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    return metaPromise;
  }

  // Public: fill <span class="last-refreshed" data-supplier="tesco"></span>
  // anywhere on the page with that supplier's scrape timestamp.
  async function fillRefreshedSpans() {
    const meta = await loadMeta();
    if (!meta || !meta.suppliers) return;
    document.querySelectorAll('.last-refreshed').forEach(el => {
      const key =
        el.dataset.supplier || location.pathname.split('/').pop().replace('-filter.html', '');
      const s = meta.suppliers[key];
      el.textContent = s ? format(s.scraped_at) : '?';
    });
  }

  // Public: build a "Tesco 7w ago · M&S 7w ago · …" summary string.
  async function freshnessSummary() {
    const meta = await loadMeta();
    if (!meta || !meta.suppliers) return '';
    return Object.entries(meta.suppliers)
      .map(([k, s]) => `${s.label || k} ${relative(s.scraped_at)}`)
      .join(' · ');
  }

  window.Freshness = { loadMeta, fillRefreshedSpans, freshnessSummary, relative, format };

  // Auto-fill any spans on first load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillRefreshedSpans);
  } else {
    fillRefreshedSpans();
  }
})();
