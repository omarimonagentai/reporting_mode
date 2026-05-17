import "server-only";

import { NextResponse } from "next/server";

import {
  findLatestSucceededRun,
  getQueryRunResults,
  listQueryRunsForRun,
} from "@/lib/mode";
import type { PreviewResult } from "@/lib/preview-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
// Mode tokens are stable alphanumeric strings. Reject anything else
// before composing them into the upstream Mode URL.
const TOKEN_RE = /^[A-Za-z0-9_-]+$/;

type CacheEntry = { fetchedAt: number; data: PreviewResult };
const cache = new Map<string, CacheEntry>();

type Params = { params: Promise<{ report: string; query: string }> };

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

export async function GET(
  request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { report, query } = await params;

  if (!report || !TOKEN_RE.test(report)) {
    return NextResponse.json(
      { error: "Invalid report token" },
      { status: 400 }
    );
  }
  if (!query || !TOKEN_RE.test(query)) {
    return NextResponse.json(
      { error: "Invalid query token" },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const force = url.searchParams.get("force") === "true";

  const cacheKey = `${report}:${query}:${limit}`;
  const now = Date.now();

  if (force) {
    cache.delete(cacheKey);
  } else {
    const cached = cache.get(cacheKey);
    if (cached && now - cached.fetchedAt < TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const { latest, anyRun } = await findLatestSucceededRun(report);

    if (latest === null) {
      const data: PreviewResult =
        anyRun === null
          ? { kind: "no-previous-run" }
          : {
              kind: "run-failed",
              run: {
                state: anyRun.state,
                completed_at: anyRun.completed_at,
              },
            };
      cache.set(cacheKey, { fetchedAt: now, data });
      return NextResponse.json(data);
    }

    const queryRuns = await listQueryRunsForRun(report, latest.token);
    // Prefer matching by the stable query_token; fall back to
    // query_name when the Mode response omits query_token (older
    // tenants). The BriefForm passes the token the user typed —
    // never the name — so a name-fallback covers the legacy-Mode
    // case at the cost of being rename-fragile in that case.
    const qr =
      queryRuns.find((q) => q.query_token === query) ??
      queryRuns.find((q) => q.query_name === query);

    if (!qr) {
      const data: PreviewResult = { kind: "query-not-found" };
      cache.set(cacheKey, { fetchedAt: now, data });
      return NextResponse.json(data);
    }

    const rows = await getQueryRunResults(report, latest.token, qr.token);
    const total_rows = rows.length;
    const sliced = rows.slice(0, limit);
    const columns = sliced.length > 0 ? Object.keys(sliced[0]) : [];

    const data: PreviewResult = {
      kind: "ready",
      run: { completed_at: latest.completed_at, state: latest.state },
      query: { token: qr.query_token ?? query, name: qr.query_name },
      columns,
      rows: sliced,
      total_rows,
    };
    cache.set(cacheKey, { fetchedAt: now, data });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Errors are NOT cached — a transient Mode outage shouldn't
    // poison the cache for 5 minutes.
    return NextResponse.json(
      { error: "Mode upstream failure", message },
      { status: 502 }
    );
  }
}
