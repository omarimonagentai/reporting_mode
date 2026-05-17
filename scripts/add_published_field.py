#!/usr/bin/env python3
"""One-shot migration: add `published: true` to every brief in briefs/*.yml.

Part of task 16.0 (Publish/Unpublish brief). Runs once before the
scheduler filter (sub-task 16.3) lands so existing briefs preserve
their live behaviour after the filter goes into effect.

Idempotent: skips any YAML that already declares `published`. After
running, every brief in the repo carries an explicit boolean.

Insertion position: line immediately after `name:` so the field shows
up at the top of the file (mirrors `web/lib/yaml.ts:serializeBrief`'s
canonical key order). The script edits the raw text instead of round-
tripping through pyyaml because pyyaml does not preserve comments,
field-quoting style or multi-line literal blocks reliably, and the
existing YAMLs contain prompt fields with `|`-style blocks we must
not reflow.

After running, this file is DELETED from the repo in a follow-up
commit (it's single-use migration code; the git history of the
migration commit is the lasting record).
"""
from __future__ import annotations

import sys
from pathlib import Path

BRIEFS_DIR = Path(__file__).resolve().parent.parent / "briefs"


def migrate(path: Path) -> bool:
    """Insert `published: true` after the `name:` line. Returns True if
    the file was modified, False if `published:` was already present."""
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    for line in lines:
        if line.startswith("published:"):
            return False
    for idx, line in enumerate(lines):
        if line.startswith("name:"):
            lines.insert(idx + 1, "published: true\n")
            path.write_text("".join(lines), encoding="utf-8")
            return True
    raise RuntimeError(f"{path.name}: no `name:` line found, refusing to migrate")


def main() -> int:
    yamls = sorted(BRIEFS_DIR.glob("*.yml"))
    if not yamls:
        print(f"No YAMLs found under {BRIEFS_DIR}", file=sys.stderr)
        return 1
    updated, skipped = 0, 0
    for yaml_path in yamls:
        if migrate(yaml_path):
            print(f"  + {yaml_path.name}")
            updated += 1
        else:
            print(f"  · {yaml_path.name} (already has published)")
            skipped += 1
    print(f"\nDone: {updated} updated, {skipped} skipped (total {len(yamls)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
