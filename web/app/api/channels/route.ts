import { NextResponse } from "next/server";
import { listChannels, type SlackChannel } from "@/lib/slack";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  fetchedAt: number;
  channels: SlackChannel[];
};

let cache: CacheEntry | null = null;

export async function GET(request: Request): Promise<NextResponse> {
  const force = new URL(request.url).searchParams.get("force") === "true";
  const now = Date.now();

  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      channels: cache.channels,
      cached: true,
      fetched_at: cache.fetchedAt,
    });
  }

  try {
    const channels = await listChannels();
    cache = { fetchedAt: now, channels };
    return NextResponse.json({
      channels,
      cached: false,
      fetched_at: now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
