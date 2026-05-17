// Plain types shared by the server-only `lib/mode.ts`, the API route
// handler under `app/api/mode/space-catalog`, and the client-side
// catalog hook. No "server-only" guard here so the client can import
// the type definitions without dragging server code along.

import type { BriefListItem } from "@/lib/schemas";

export type ModeReport = { token: string; name: string };

// `used_by` is augmented server-side by the space-catalog endpoint
// from the brief YAML index. Optional because some consumers
// (existing BriefForm comboboxes) don't need it; the endpoint always
// populates it (possibly to `[]`) for the new landing.
export type ModeQuery = {
  token: string;
  name: string;
  used_by?: BriefListItem[];
};

export type ReportWithQueries = ModeReport & { queries: ModeQuery[] };
export type SpaceCatalog = { reports: ReportWithQueries[] };

// One row from `_embedded.runs[]` on a Mode report's `/runs` endpoint.
// `completed_at` is null while the run is in-flight (which the preview
// endpoint never surfaces — it filters to `state === "succeeded"` —
// but the type accurately reflects the wire shape so failures landing
// outside the success path also round-trip cleanly).
export type ModeRun = {
  token: string;
  state: string;
  created_at: string;
  completed_at: string | null;
};

// Returned by `findLatestSucceededRun` so the caller can distinguish
// «no runs at all» from «runs exist, latest failed». The preview
// endpoint maps these into `kind: "no-previous-run"` vs
// `kind: "run-failed"` respectively.
export type LatestRunLookup = {
  latest: ModeRun | null;
  anyRun: ModeRun | null;
};

// One row from `_embedded.query_runs[]` on a Mode run's
// `/query_runs` endpoint. Same shape the Python executor reads in
// `scripts/executor.py:list_query_runs`.
//
// Two tokens here, distinct:
//   - `token` is the **query_run** identifier — unique per (run,
//     query) pair, the value to plug into the `/results/content.json`
//     URL when fetching this query's rows for THIS run.
//   - `query_token` is the **stable query identifier** — what the
//     user typed in the BriefForm / what `parseBrief` reads from the
//     YAML. The preview endpoint matches incoming tokens against this
//     field. Mode exposes it on each query_run since v3 of the API;
//     when absent (older instances), the route handler falls back to
//     matching by `query_name`.
export type ModeQueryRun = {
  token: string;
  query_token?: string;
  query_name: string;
  state: string;
};
