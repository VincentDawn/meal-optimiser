"""
server.py — local-only dev server for curating the meal-data.js dataset.

The deployed site is fully static: filter pages persist exclusions in
localStorage and recompute averages in the browser. This server exists
so YOU (data curator) can replay an exclusion list across the canonical
scraper output and patch the averages back into meal-data.js.

Run from the repo root:
    python dev/server.py
Then open: http://localhost:5000
"""
import json
import re
import time
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# Repo root — server.py lives in dev/, data files live at the root.
BASE = Path(__file__).resolve().parent.parent
EXCL_FILE      = BASE / "scrapers" / "exclusions.json"
MEAL_DATA_FILE = BASE / "meal-data.js"

PRODUCT_FILES = {
    "tesco":      BASE / "scrapers" / "tesco_all_products.json",
    "ms":         BASE / "scrapers" / "ms_all_products.json",
    "parsleybox": BASE / "scrapers" / "parsleybox_all_products.json",
}

MEAL_DATA_IDS = {
    "tesco":      "rm_tesco",
    "ms":         "rm_ms",
    "parsleybox": "svc_parsley_box",
}


# ── Exclusions storage ─────────────────────────────────────────────────────────

def load_excl():
    if EXCL_FILE.exists():
        return json.loads(EXCL_FILE.read_text(encoding="utf-8"))
    return {}

def save_excl(data):
    EXCL_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ── Recalculate averages ───────────────────────────────────────────────────────

def load_products(key):
    f = PRODUCT_FILES.get(key)
    if not f or not f.exists():
        return None
    raw = json.loads(f.read_text(encoding="utf-8"))
    # tesco has {"frozen": [...]}; others have {"products": [...]}
    return raw.get("frozen") or raw.get("products") or []

def recalculate(key):
    """Recalculate averages for a provider key, return stats dict."""
    if key not in PRODUCT_FILES:
        return {"error": f"Unknown key: {key}"}

    excl = load_excl()
    excluded_ids = set(excl.get(key, []))
    products = load_products(key)
    if products is None:
        return {"error": f"Product file not found for {key}"}

    kept = [p for p in products if p["id"] not in excluded_ids]

    # M&S: use dealPrice if available, else price
    def effective_price(p):
        return p.get("dealPrice") or p.get("ccPrice") or p.get("price")

    prices   = [effective_price(p) for p in kept if effective_price(p)]
    kcals    = [p["kcal"]    for p in kept if p.get("kcal")    and 100 < p["kcal"]    < 1500]
    proteins = [p["protein"] for p in kept if p.get("protein") and   1 < p["protein"] <  100]

    def avg(lst): return round(sum(lst) / len(lst), 2) if lst else None

    ap  = avg(prices)
    ak  = round(sum(kcals)    / len(kcals))    if kcals    else None
    apr = round(sum(proteins) / len(proteins), 1) if proteins else None

    return {
        "key":            key,
        "meal_data_id":   MEAL_DATA_IDS.get(key),
        "kept":           len(kept),
        "excluded":       len(excluded_ids),
        "avg_price":      ap,
        "weekly_cost":    round(ap * 21) if ap else None,
        "avg_kcal":       ak,
        "avg_protein":    apr,
        "kcal_coverage":  len(kcals),
        "prot_coverage":  len(proteins),
    }


# ── Update meal-data.js ────────────────────────────────────────────────────────

def update_meal_data(stats):
    """Patch an entry in meal-data.js with new stats."""
    key      = stats.get("key")
    entry_id = stats.get("meal_data_id")
    if not entry_id:
        return {"error": f"No meal_data_id for key {key}"}

    content = MEAL_DATA_FILE.read_text(encoding="utf-8")
    month   = time.strftime("%b %Y")
    ap  = stats["avg_price"]
    ak  = stats["avg_kcal"]
    apr = stats["avg_protein"]
    wk  = stats["weekly_cost"]
    n   = stats["kept"]
    exc = stats["excluded"]
    kc  = stats["kcal_coverage"]
    pc  = stats["prot_coverage"]

    eid = re.escape(entry_id)

    def patch(text, field, value, comment):
        pattern = rf"(id: '{eid}'[\s\S]{{0,800}}?{field}:\s*)[^,/\n]+(.*)"
        repl    = rf"\g<1>{value},        // VERIFIED — {comment}. Live-scraped {month}\2"
        return re.sub(pattern, repl, text)

    content = patch(content, "costPerMeal", ap,  f"avg across {n} products ({exc} excluded)")
    content = patch(content, "weeklyCost",  wk,  f"{n} meals x £{ap} x 21")
    content = patch(content, "calories",    ak,  f"avg across {kc}/{n} products with kcal data")
    content = patch(content, "protein",     apr, f"avg across {pc}/{n} products with valid protein data")

    MEAL_DATA_FILE.write_text(content, encoding="utf-8")
    return {"ok": True, "patched": entry_id}


# ── HTTP handler ───────────────────────────────────────────────────────────────

MIME = {
    ".html": "text/html",
    ".js":   "application/javascript",
    ".json": "application/json",
    ".css":  "text/css",
    ".ico":  "image/x-icon",
}

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} {fmt % args}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        # API routes
        if path == "/api/exclusions":
            return self.send_json(load_excl())

        if path.startswith("/api/stats/"):
            key = path.split("/")[-1]
            return self.send_json(recalculate(key))

        # Static files
        if path == "/" or path == "/index.html":
            target = BASE / "index.html"
        else:
            target = BASE / path.lstrip("/")

        if not target.exists() or not target.is_file():
            self.send_response(404)
            self.end_headers()
            return

        ext  = target.suffix.lower()
        mime = MIME.get(ext, "application/octet-stream")
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path    = urlparse(self.path).path
        length  = int(self.headers.get("Content-Length", 0))
        body    = json.loads(self.rfile.read(length)) if length else {}

        if path == "/api/exclusions":
            save_excl(body)
            return self.send_json({"ok": True})

        if path.startswith("/api/apply/"):
            key   = path.split("/")[-1]
            stats = recalculate(key)
            if "error" in stats:
                return self.send_json(stats, 400)
            result = update_meal_data(stats)
            result["stats"] = stats
            return self.send_json(result)

        self.send_json({"error": "not found"}, 404)


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = 5000
    print(f"Meal prep server running at http://localhost:{port}")
    print("Press Ctrl+C to stop.\n")
    HTTPServer(("localhost", port), Handler).serve_forever()
