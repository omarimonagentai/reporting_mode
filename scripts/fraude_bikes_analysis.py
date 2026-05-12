"""Fraude Bikes — anàlisi automàtica del report de Mode.

Step 5: pipeline Mode complet — trigger + polling + fetch de les 7 queries.
Guarda els resultats crus a out/last_run.json per facilitar el debug.
"""
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

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


if __name__ == "__main__":
    main()
