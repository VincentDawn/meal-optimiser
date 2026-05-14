"""
headless_recompute.py — non-interactive equivalent of the dev server's "Apply"
button. Recomputes averages for every supplier and patches meal-data.js in
place. Intended to run from the bumblebee weekly cron after the scrapers.

Run from the repo root:
    python dev/headless_recompute.py

Exit code is 0 if every patch succeeded, 1 if any failed.
"""
import sys
from pathlib import Path

# Re-use the pure logic from server.py (importing it does NOT start the HTTP
# server thanks to the `if __name__ == "__main__":` guard).
sys.path.insert(0, str(Path(__file__).parent))
from server import PRODUCT_FILES, recalculate, update_meal_data  # noqa: E402


def main() -> int:
    failures = []
    for key in PRODUCT_FILES:
        stats = recalculate(key)
        if "error" in stats:
            print(f"  [skip]  {key}: {stats['error']}")
            failures.append(key)
            continue

        result = update_meal_data(stats)
        if "error" in result:
            print(f"  [FAIL]  {key}: {result['error']}")
            failures.append(key)
            continue

        print(
            f"  [ok]    {key:<12} "
            f"£{stats['avg_price']:.2f}/meal · "
            f"{stats['avg_kcal'] or '?'} kcal · "
            f"{stats['avg_protein'] or '?'}g protein  "
            f"({stats['kept']} kept, {stats['excluded']} excluded)"
        )

    if failures:
        print(f"\n{len(failures)} supplier(s) failed: {', '.join(failures)}")
        return 1
    print(f"\nAll {len(PRODUCT_FILES)} supplier(s) patched OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
