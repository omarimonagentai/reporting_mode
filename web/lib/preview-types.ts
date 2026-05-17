// Wire shape of GET /api/mode/preview/[report]/[query].
//
// Imported by both the server (route handler — produces it) and the
// client (PreviewSheet — consumes it via `await res.json()` cast).
// Kept here as plain types so the client doesn't drag server-only
// code via lib/mode.ts.

export type PreviewResult =
  | {
      kind: "ready";
      run: { completed_at: string | null; state: string };
      query: { token: string; name: string };
      columns: string[];
      rows: Record<string, unknown>[];
      total_rows: number;
    }
  | { kind: "no-previous-run" }
  | {
      kind: "run-failed";
      run: { state: string; completed_at: string | null };
    }
  | { kind: "query-not-found" };
