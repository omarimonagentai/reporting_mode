"""Scan all briefs and dispatch the ones whose schedule is due now.

Designed to be called by a master GitHub Actions workflow on a fixed cron
(every WINDOW_SECONDS). For each brief found under briefs/*.yml, evaluates
whether its `schedule` cron expression should have fired in the last
WINDOW_SECONDS, and if so, invokes the executor for that brief.

Each brief runs as a subprocess so failures are isolated: one brief crashing
does not stop the others. If any brief fails, this script exits non-zero so
the GitHub Actions workflow shows a red status (visibility).

TIME ZONE NOTE: cron expressions are evaluated in UTC, matching GitHub
Actions' own cron scheduling. A brief's `schedule: "0 8 * * *"` means
08:00 UTC, which is 09:00 CET (winter) or 10:00 CEST (summer). Convert
local time → UTC when writing schedules.

Usage:
    python scripts/due_runner.py
"""
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml
from croniter import croniter

# Window must match the master workflow's cron interval to avoid:
# - duplicate executions (window > interval would catch a brief on two ticks)
# - missed executions (window < interval would skip briefs that fire between ticks)
WINDOW_SECONDS = 15 * 60

BRIEFS_DIR = Path(__file__).resolve().parent.parent / "briefs"
EXECUTOR = Path(__file__).resolve().parent / "executor.py"


def find_briefs():
    if not BRIEFS_DIR.is_dir():
        return []
    return sorted(BRIEFS_DIR.glob("*.yml"))


def is_due(schedule_cron, now, window_seconds):
    """Return True if `schedule_cron` would have fired within the last
    `window_seconds` before `now`.
    """
    try:
        cron = croniter(schedule_cron, now)
    except (ValueError, KeyError) as exc:
        print(f"   ERROR: cron invàlid '{schedule_cron}': {exc}")
        return False
    prev_fire = cron.get_prev(datetime)
    # croniter may return naive datetimes; align with `now` for arithmetic.
    if prev_fire.tzinfo is None:
        prev_fire = prev_fire.replace(tzinfo=now.tzinfo or timezone.utc)
    delta = (now - prev_fire).total_seconds()
    return delta < window_seconds


def load_brief_meta(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def run_brief(path):
    """Invoke the executor for one brief as a subprocess. Returns exit code."""
    print(f"-> Running: {path.name}")
    result = subprocess.run(
        [sys.executable, str(EXECUTOR), str(path)],
        check=False,
    )
    return result.returncode


def main():
    now = datetime.now(timezone.utc)
    print("=" * 70)
    print(f"DUE RUNNER  ·  {now.isoformat()}")
    print(f"Window: {WINDOW_SECONDS}s ({WINDOW_SECONDS // 60} min)")
    print("=" * 70)

    briefs = find_briefs()
    if not briefs:
        print("No briefs trobats sota briefs/. Sortint.")
        return

    print(f"\n{len(briefs)} brief(s) descobert(s):\n")

    due = []
    for path in briefs:
        try:
            cfg = load_brief_meta(path)
        except Exception as exc:
            print(f"   - {path.name}: ERROR llegint YAML: {exc}")
            continue
        schedule = cfg.get("schedule")
        if not schedule:
            print(f"   - {path.name}: sense camp 'schedule' → omès")
            continue
        if is_due(schedule, now, WINDOW_SECONDS):
            print(f"   - {path.name}: DUE  ({schedule})")
            due.append(path)
        else:
            print(f"   - {path.name}: not due  ({schedule})")

    print(f"\n{len(due)} brief(s) per executar.")

    failures = []
    for path in due:
        print(f"\n{'-' * 70}")
        rc = run_brief(path)
        if rc != 0:
            print(f"   ✗ {path.name} ha sortit amb codi {rc}")
            failures.append(path.name)
        else:
            print(f"   ✓ {path.name} OK")

    print(f"\n{'=' * 70}")
    print(f"DUE RUNNER COMPLETE  ·  {len(due) - len(failures)} OK, {len(failures)} failed")
    print(f"{'=' * 70}")

    if failures:
        sys.exit(f"FAILURES: {', '.join(failures)}")


if __name__ == "__main__":
    main()
