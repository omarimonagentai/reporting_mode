"""Generate the static dashboard from briefs/*.yml.

Reads all brief YAMLs under briefs/, extracts metadata, and renders
docs/index.html using the Jinja2 template at templates/dashboard.html.j2.
The generated HTML is then deployed to GitHub Pages by the
build-dashboard.yml workflow.

Usage:
    python scripts/build_dashboard.py
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

REPO_ROOT = Path(__file__).resolve().parent.parent
BRIEFS_DIR = REPO_ROOT / "briefs"
TEMPLATES_DIR = REPO_ROOT / "templates"
OUT_DIR = REPO_ROOT / "docs"

# GitHub repo slug (org/repo). Hardcoded because it appears in "edit" URLs
# pointing to the GitHub web editor. Not a secret.
REPO_SLUG = "omarimonagentai/reporting_mode"

# Maximum characters of the prompt to show inline on the card. Long prompts
# are truncated with an ellipsis; the full prompt is always available in the
# YAML (one click via the Edit button).
PROMPT_PREVIEW_CHARS = 320


def load_briefs():
    """Read all briefs/*.yml files and decorate them with derived fields
    used by the template (filename, edit URL, counts, prompt preview)."""
    if not BRIEFS_DIR.is_dir():
        return []

    briefs = []
    for path in sorted(BRIEFS_DIR.glob("*.yml")):
        try:
            with open(path, encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
        except Exception as exc:
            print(f"WARN: failed to read {path}: {exc}", file=sys.stderr)
            continue

        cfg["_filename"] = path.name
        cfg["_edit_url"] = (
            f"https://github.com/{REPO_SLUG}/edit/main/briefs/{path.name}"
        )
        cfg["_view_url"] = (
            f"https://github.com/{REPO_SLUG}/blob/main/briefs/{path.name}"
        )
        cfg["_source_count"] = len(cfg.get("sources", []) or [])
        cfg["_query_count"] = sum(
            len((s.get("queries") or [])) for s in (cfg.get("sources") or [])
        )

        prompt = (cfg.get("prompt") or "").strip()
        if len(prompt) > PROMPT_PREVIEW_CHARS:
            cfg["_prompt_preview"] = prompt[:PROMPT_PREVIEW_CHARS].rstrip() + "…"
            cfg["_prompt_truncated"] = True
        else:
            cfg["_prompt_preview"] = prompt
            cfg["_prompt_truncated"] = False
        cfg["_prompt_full_chars"] = len(prompt)

        briefs.append(cfg)
    return briefs


def render():
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("dashboard.html.j2")
    briefs = load_briefs()
    html = template.render(
        briefs=briefs,
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        repo_url=f"https://github.com/{REPO_SLUG}",
        new_brief_url=(
            f"https://github.com/{REPO_SLUG}/new/main/briefs"
        ),
    )

    OUT_DIR.mkdir(exist_ok=True)
    output_path = OUT_DIR / "index.html"
    output_path.write_text(html, encoding="utf-8")
    print(f"Generated {output_path.relative_to(REPO_ROOT)} ({len(briefs)} briefs)")


if __name__ == "__main__":
    render()
