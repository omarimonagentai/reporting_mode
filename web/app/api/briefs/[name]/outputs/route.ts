import { NextResponse } from "next/server";
import { fetchLatestBriefOutputs, type BriefOutput } from "@/lib/outputs";
import { BriefNotFoundError, readBrief } from "@/lib/github";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 3;

type CacheEntry = {
  fetchedAt: number;
  data: BriefOutput[];
};

// Module-level cache: lives per Vercel function instance, resets on
// cold start. Acceptable for an internal tool — same pattern as
// /api/runs/[brief].
const cache = new Map<string, CacheEntry>();

type Params = { params: Promise<{ name: string }> };

export async function GET(
  request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { name: slug } = await params;
  const force = new URL(request.url).searchParams.get("force") === "true";
  const now = Date.now();

  // 1. Validate the brief exists — same 404 convention as the rest of
  //    the per-brief endpoints (/api/briefs/[name]/run, /api/runs/[brief]).
  try {
    await readBrief(slug);
  } catch (err) {
    if (err instanceof BriefNotFoundError) {
      return NextResponse.json(
        { error: "Brief no trobat" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // 2. Cache lookup.
  const cached = cache.get(slug);
  if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      outputs: cached.data,
      cached: true,
      fetched_at: cached.fetchedAt,
    });
  }

  // 3. Fetch + cap at MAX_ENTRIES.
  try {
    const data = await fetchLatestBriefOutputs(slug, MAX_ENTRIES);
    cache.set(slug, { fetchedAt: now, data });
    return NextResponse.json({
      outputs: data,
      cached: false,
      fetched_at: now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
