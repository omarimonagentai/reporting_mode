import { NextResponse } from "next/server";
import {
  fetchAllRecentBriefOutputs,
  type BriefOutput,
} from "@/lib/outputs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 3;

type CacheEntry = {
  fetchedAt: number;
  data: Record<string, BriefOutput[]>;
};

// Module-level cache. Key is a comma-joined SORTED slug list so
// different brief sets (e.g. when a brief gets created or deleted)
// don't collide on the same slot. Per Vercel function instance;
// resets on cold start. Same pattern as /api/runs/[brief] and
// /api/briefs/[name]/outputs.
const cache = new Map<string, CacheEntry>();

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  const rawSlugs = url.searchParams.get("slugs") ?? "";
  const slugs = Array.from(
    new Set(
      rawSlugs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ).sort();

  if (slugs.length === 0) {
    return NextResponse.json({ outputs: {}, cached: false, fetched_at: Date.now() });
  }

  const cacheKey = slugs.join(",");
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      outputs: cached.data,
      cached: true,
      fetched_at: cached.fetchedAt,
    });
  }

  try {
    const map = await fetchAllRecentBriefOutputs(slugs, MAX_ENTRIES);
    const data: Record<string, BriefOutput[]> = {};
    for (const slug of slugs) {
      const list = map.get(slug);
      if (list && list.length > 0) data[slug] = list;
    }
    cache.set(cacheKey, { fetchedAt: now, data });
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
