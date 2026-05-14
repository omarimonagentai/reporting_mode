"""Fraude Bikes — anàlisi automàtica del report de Mode.

Step 8: pipeline complet — Mode + LLM (Groq) + enviament a Slack.
Guarda els resultats crus a out/last_run.json i l'informe a out/last_report.md.
"""
import json
import os
import re
import sys
import time
from datetime import date
from pathlib import Path

import requests
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

MODE_ACCOUNT = "ecooltra706"
REPORT_TOKEN = "3c6ce1fafa97"
MODE_BASE_URL = f"https://app.mode.com/api/{MODE_ACCOUNT}"
HTTP_TIMEOUT = 30

POLL_INTERVAL_SECONDS = 5
POLL_TIMEOUT_SECONDS = 300
IN_PROGRESS_STATES = {"enqueued", "pending", "running"}
SUCCESS_STATES = {"completed", "succeeded"}

# Només descarreguem aquestes queries. La resta s'executen a Mode però no es fetxen.
# La compressió/agregació viu a les queries de Mode, no aquí.
INCLUDED_QUERY_NAMES = {
    "Unit Economics over PAID INVOICES",
    "Unit Economics over RENTALS",
}

LLM_MODEL = "llama-3.3-70b-versatile"
# LLM_MODEL = "mixtral-8x7b-32768"  # alternativa amb context més gran
LLM_TEMPERATURE = 0.3
LLM_MAX_TOKENS = 800
LLM_TIMEOUT = 60

SLACK_TIMEOUT = 10

SYSTEM_PROMPT = """You are a senior data analyst at Cooltra, a shared mobility company operating eBike fleets in European cities.

Write an executive brief in English for the operations leadership team, based on the Unit Economics data provided. The data contains two queries:
- "Unit Economics over PAID INVOICES" — NET revenue (after credit notes) per city per month.
- "Unit Economics over RENTALS" — GROSS revenue (rentals generated, before invoicing) per city per month.

Output exactly three markdown sections, in this order:

## Summary
~80 words. The single most important shift or trend visible in the data.

## Insights
~120 words. Concrete observations with specific numbers: month-over-month growth rates, inter-city comparisons, gross vs net deltas, revenue-per-vehicle differentials. Always cite numbers directly from the data.

## Recommendations
~100 words. Three to four actions. Each recommendation MUST: name a specific city, cite a specific number or trend from the data above, and propose a measurable target or next step.

Strict rules:
- Total length: minimum 250 words, maximum 350. Be substantive, not padded.
- Use the `##` markdown header syntax exactly as shown.
- Never use vague verbs like "consider", "explore", "look into", "evaluate". Use specific verbs: "increase X to Y by Q", "audit Z before date W", "test pricing tier V in city U".
- The audience already knows the business — deliver analytical insight, not background.
"""

OUT_DIR = Path(__file__).resolve().parent.parent / "out"


def load_credentials():
    token = os.environ.get("MODE_TOKEN")
    secret = os.environ.get("MODE_SECRET")
    if not token or not secret:
        sys.exit("ERROR: MODE_TOKEN i/o MODE_SECRET no estan definits. "
                 "Comprova el .env (local) o els secrets (GitHub Actions).")
    return token, secret


def trigger_report(auth):
    url = f"{MODE_BASE_URL}/reports/{REPORT_TOKEN}/runs"
    response = requests.post(
        url,
        json={"parameters": {}},
        auth=auth,
        headers={"Accept": "application/hal+json"},
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return data["token"], data["state"]


def get_run_state(auth, run_token):
    url = f"{MODE_BASE_URL}/reports/{REPORT_TOKEN}/runs/{run_token}"
    response = requests.get(
        url,
        auth=auth,
        headers={"Accept": "application/hal+json"},
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["state"]


def wait_for_completion(auth, run_token):
    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    while True:
        state = get_run_state(auth, run_token)
        print(f"   state: {state}")
        if state in SUCCESS_STATES:
            return state
        if state not in IN_PROGRESS_STATES:
            sys.exit(f"ERROR: el run ha acabat en estat '{state}' (no és èxit).")
        if time.monotonic() >= deadline:
            sys.exit(f"ERROR: timeout esperant el run (>{POLL_TIMEOUT_SECONDS}s).")
        time.sleep(POLL_INTERVAL_SECONDS)


def list_query_runs(auth, run_token):
    url = f"{MODE_BASE_URL}/reports/{REPORT_TOKEN}/runs/{run_token}/query_runs"
    response = requests.get(
        url,
        auth=auth,
        headers={"Accept": "application/hal+json"},
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["_embedded"]["query_runs"]


def get_query_results(auth, run_token, query_run_token):
    url = (f"{MODE_BASE_URL}/reports/{REPORT_TOKEN}/runs/{run_token}"
           f"/query_runs/{query_run_token}/results/content.json")
    response = requests.get(
        url,
        auth=auth,
        headers={"Accept": "application/json"},
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def fetch_all_query_results(auth, run_token, query_runs):
    """Itera per totes les query_runs i retorna {query_name: rows}."""
    results = {}
    for qr in query_runs:
        name = qr.get("query_name") or qr["token"]
        if qr["state"] not in SUCCESS_STATES:
            sys.exit(f"ERROR: query_run '{name}' té state '{qr['state']}' (no és èxit).")
        print(f"   fetching '{name}'...")
        rows = get_query_results(auth, run_token, qr["token"])
        results[name] = rows
        print(f"     {len(rows)} files")
    return results


def save_raw_results(results, run_token):
    OUT_DIR.mkdir(exist_ok=True)
    path = OUT_DIR / "last_run.json"
    payload = {"run_token": run_token, "queries": results}
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, default=str))
    return path


def generate_report(results):
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        sys.exit("ERROR: GROQ_API_KEY no està definit. Comprova .env (local) o secrets (CI).")

    client = Groq(api_key=api_key, timeout=LLM_TIMEOUT)
    user_message = (
        f"Today's date: {date.today().isoformat()}\n\n"
        "Unit Economics data extracted from Mode (Fraude Bikes report):\n\n"
        + json.dumps(results, indent=2, ensure_ascii=False, default=str)
    )
    response = client.chat.completions.create(
        model=LLM_MODEL,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content


def save_report(report_text):
    OUT_DIR.mkdir(exist_ok=True)
    path = OUT_DIR / "last_report.md"
    path.write_text(report_text, encoding="utf-8")
    return path


def markdown_to_slack(text):
    """Converteix markdown estàndard al format mrkdwn de Slack.

    - ## Header  → *Header*    (Slack no té headers; converteix a bold)
    - **bold**   → *bold*      (Slack fa servir un sol asterisc)
    """
    text = re.sub(r"^#{1,6}\s+(.+)$", r"*\1*", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    return text


CHART_BAR_WIDTH = 28


def render_revenue_chart(results):
    """Genera un bar chart ASCII de REVENUE_PER_VEHICLE per ciutat, mes més recent.

    Retorna una string multilínia (sense fence) o '' si falten dades.
    Comparable amb monoespai dins d'un code block de Slack.
    """
    rentals = results.get("Unit Economics over RENTALS", []) or []
    paid = results.get("Unit Economics over PAID INVOICES", []) or []
    if not rentals or not paid:
        return ""

    # Mes més recent comú a totes dues queries
    common_months = {r["MONTH"] for r in rentals} & {p["MONTH"] for p in paid}
    if not common_months:
        return ""
    latest_month = max(common_months)

    paid_latest = sorted(
        (r["CITY"], float(r["REVENUE_PER_VEHICLE"]))
        for r in paid if r["MONTH"] == latest_month
    )
    rentals_latest = sorted(
        (r["CITY"], float(r["REVENUE_PER_VEHICLE"]))
        for r in rentals if r["MONTH"] == latest_month
    )

    all_values = [v for _, v in paid_latest + rentals_latest]
    if not all_values:
        return ""
    max_val = max(all_values)
    label_width = max(len(c) for c, _ in paid_latest + rentals_latest)

    def format_group(title, rows):
        lines = [title]
        for city, value in rows:
            bar_len = int(round((value / max_val) * CHART_BAR_WIDTH))
            bar = "█" * bar_len
            lines.append(f"  {city:<{label_width}}  {bar:<{CHART_BAR_WIDTH}}  {value:>7.2f}")
        return lines

    out = [f"Revenue per vehicle — {latest_month} (€)", ""]
    out.extend(format_group("Net (PAID INVOICES):", paid_latest))
    out.append("")
    out.extend(format_group("Gross (RENTALS):", rentals_latest))
    return "\n".join(out)


def send_to_slack(report_text, chart_text=""):
    webhook = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook:
        sys.exit("ERROR: SLACK_WEBHOOK_URL no està definit.")

    formatted = markdown_to_slack(report_text)
    today_str = date.today().strftime("%d/%m/%Y")
    body = f"📊 *Fraude Bikes — Informe {today_str}*\n\n{formatted}"
    if chart_text:
        body += f"\n\n```\n{chart_text}\n```"

    response = requests.post(
        webhook,
        json={"text": body},
        timeout=SLACK_TIMEOUT,
    )
    response.raise_for_status()
    return response.status_code


def print_summary(results):
    print("")
    print(f"   {'Query':<40} {'Files':>7}  {'Columnes'}")
    print(f"   {'-' * 40} {'-' * 7}  {'-' * 8}")
    total = 0
    for name, rows in results.items():
        ncols = len(rows[0]) if rows else 0
        total += len(rows)
        print(f"   {name:<40} {len(rows):>7}  {ncols}")
    print(f"   {'-' * 40} {'-' * 7}")
    print(f"   {'TOTAL':<40} {total:>7}")


def main():
    auth = load_credentials()
    print(f"-> Disparant run del report '{REPORT_TOKEN}'...")
    run_token, state = trigger_report(auth)
    print(f"   run_token: {run_token}")
    print(f"   state:     {state}")
    print(f"-> Esperant completion (poll cada {POLL_INTERVAL_SECONDS}s, timeout {POLL_TIMEOUT_SECONDS}s)...")
    final_state = wait_for_completion(auth, run_token)
    print(f"-> Run completat: {final_state}")

    print(f"-> Llistant query_runs...")
    query_runs = list_query_runs(auth, run_token)
    print(f"   {len(query_runs)} query_runs trobats al report")

    included = [qr for qr in query_runs if qr.get("query_name") in INCLUDED_QUERY_NAMES]
    skipped_names = [qr.get("query_name", "?") for qr in query_runs if qr.get("query_name") not in INCLUDED_QUERY_NAMES]
    print(f"   {len(included)} inclosos, {len(skipped_names)} omesos")
    if skipped_names:
        print(f"   omesos: {skipped_names}")

    missing = INCLUDED_QUERY_NAMES - {qr.get("query_name") for qr in query_runs}
    if missing:
        sys.exit(f"ERROR: queries esperades no trobades al report: {missing}")

    print(f"-> Obtenint resultats de les queries incloses...")
    results = fetch_all_query_results(auth, run_token, included)

    print(f"-> Guardant resultats crus...")
    path = save_raw_results(results, run_token)
    print(f"   {path}")

    print(f"-> Resum:")
    print_summary(results)

    print(f"-> Generant informe amb {LLM_MODEL}...")
    report = generate_report(results)
    report_path = save_report(report)
    print(f"   guardat a {report_path}")

    print("")
    print("=" * 70)
    print("INFORME")
    print("=" * 70)
    print(report)
    print("=" * 70)
    print("")

    chart = render_revenue_chart(results)
    if chart:
        print("")
        print("CHART:")
        print(chart)
        print("")

    print(f"-> Enviant a Slack...")
    status = send_to_slack(report, chart)
    print(f"   ✓ enviat (status {status})")


if __name__ == "__main__":
    main()
