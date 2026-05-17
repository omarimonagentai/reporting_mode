import "server-only";

import type {
  LatestRunLookup,
  ModeQuery,
  ModeQueryRun,
  ModeReport,
  ModeRun,
} from "@/lib/mode-types";

export type {
  LatestRunLookup,
  ModeQuery,
  ModeQueryRun,
  ModeReport,
  ModeRun,
};

const MODE_BASE_URL = "https://app.mode.com/api";

function getConfig() {
  const token = process.env.MODE_TOKEN;
  const secret = process.env.MODE_SECRET;
  const account = process.env.DEFAULT_MODE_ACCOUNT;
  const space = process.env.MODE_SPACE;
  if (!token || !secret || !account || !space) {
    throw new Error(
      "MODE_TOKEN, MODE_SECRET, DEFAULT_MODE_ACCOUNT and MODE_SPACE must be set"
    );
  }
  return { token, secret, account, space };
}

function authHeader(token: string, secret: string): string {
  // Mode API uses HTTP Basic auth with the token as user and the secret as
  // password. Same shape the Python executor (scripts/executor.py) uses via
  // requests' `auth=(token, secret)` tuple.
  const credentials = Buffer.from(`${token}:${secret}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * List the reports inside a Mode space. The Mode API returns the payload
 * under `_embedded.reports` with token/name plus a lot of metadata we
 * discard here.
 */
export async function listSpaceReports(): Promise<ModeReport[]> {
  const { token, secret, account, space } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/spaces/${space}/reports`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listSpaceReports failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: { reports?: { token: string; name: string }[] };
  };
  const reports = data._embedded?.reports ?? [];
  return reports.map((r) => ({ token: r.token, name: r.name }));
}

/**
 * List the queries that belong to a Mode report. Mirrors the Python
 * executor's `get_queries(...)` flow.
 */
export async function listReportQueries(
  reportToken: string
): Promise<ModeQuery[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/queries`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listReportQueries(${reportToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: { queries?: { token: string; name: string }[] };
  };
  const queries = data._embedded?.queries ?? [];
  return queries.map((q) => ({ token: q.token, name: q.name }));
}

/**
 * List the historical runs of a Mode report, sorted descending by
 * completion time. Returns the raw `_embedded.runs[]` projected to the
 * fields the preview endpoint (task 17.0) consumes: token, state,
 * created_at, completed_at.
 *
 * Mode's docs call the API ordering "approximately descending"; we
 * sort defensively after the fetch so callers don't have to.
 */
export async function listReportRuns(
  reportToken: string
): Promise<ModeRun[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listReportRuns(${reportToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: {
      report_runs?: {
        token: string;
        state: string;
        created_at: string;
        completed_at: string | null;
      }[];
    };
  };
  const raw = data._embedded?.report_runs ?? [];
  const runs: ModeRun[] = raw.map((r) => ({
    token: r.token,
    state: r.state,
    created_at: r.created_at,
    completed_at: r.completed_at,
  }));
  runs.sort((a, b) => {
    const ax = a.completed_at ?? a.created_at;
    const bx = b.completed_at ?? b.created_at;
    return bx.localeCompare(ax); // ISO timestamps sort lexicographically
  });
  return runs;
}

/**
 * Find the latest run of a Mode report whose `state === "succeeded"`,
 * plus a bonus `anyRun` field surfacing the chronologically-latest run
 * regardless of state. The preview endpoint uses both signals to
 * distinguish «no previous run» from «latest run failed»:
 *   - latest === null && anyRun === null → kind: "no-previous-run"
 *   - latest === null && anyRun !== null → kind: "run-failed"
 *   - latest !== null                    → kind: "ready" (continue)
 */
export async function findLatestSucceededRun(
  reportToken: string
): Promise<LatestRunLookup> {
  const runs = await listReportRuns(reportToken);
  if (runs.length === 0) {
    return { latest: null, anyRun: null };
  }
  const latest = runs.find((r) => r.state === "succeeded") ?? null;
  return { latest, anyRun: runs[0] };
}

/**
 * List the query runs that ran as part of a specific report run.
 * Mirrors the Python executor's `list_query_runs(...)` flow.
 */
export async function listQueryRunsForRun(
  reportToken: string,
  runToken: string
): Promise<ModeQueryRun[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs/${runToken}/query_runs`,
    {
      headers: {
        Accept: "application/hal+json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode listQueryRunsForRun(${reportToken}, ${runToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as {
    _embedded?: {
      query_runs?: {
        token: string;
        query_token?: string;
        query_name: string;
        state: string;
      }[];
    };
  };
  const raw = data._embedded?.query_runs ?? [];
  return raw.map((q) => ({
    token: q.token,
    query_token: q.query_token,
    query_name: q.query_name,
    state: q.state,
  }));
}

/**
 * Fetch the row payload of a specific query run. Mirrors the Python
 * executor's `get_query_results(...)` flow — same JSON `content.json`
 * resource. Returns an array of row objects; Mode caps the response
 * at ~1000 rows. The caller (preview endpoint) slices to the
 * user-requested `limit` after the fetch — Mode does not expose a
 * server-side limit param.
 */
export async function getQueryRunResults(
  reportToken: string,
  runToken: string,
  queryRunToken: string
): Promise<Record<string, unknown>[]> {
  const { token, secret, account } = getConfig();
  const res = await fetch(
    `${MODE_BASE_URL}/${account}/reports/${reportToken}/runs/${runToken}/query_runs/${queryRunToken}/results/content.json`,
    {
      headers: {
        Accept: "application/json",
        Authorization: authHeader(token, secret),
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(
      `Mode getQueryRunResults(${reportToken}, ${runToken}, ${queryRunToken}) failed: ${res.status} ${await res.text()}`
    );
  }
  return (await res.json()) as Record<string, unknown>[];
}
