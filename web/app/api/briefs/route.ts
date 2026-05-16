import { NextResponse } from "next/server";
import { listBriefs, readBrief } from "@/lib/github";
import { parseBrief } from "@/lib/yaml";
import type { BriefListItem } from "@/lib/schemas";

export async function GET(): Promise<NextResponse> {
  try {
    const files = await listBriefs();
    const items = await Promise.all(
      files.map(async (file): Promise<BriefListItem | null> => {
        try {
          const blob = await readBrief(file.filename);
          const brief = parseBrief(blob.content);
          return {
            filename: file.filename,
            name: brief.name,
            schedule: brief.schedule,
            slack_channel: brief.slack_channel,
            source_count: brief.sources.length,
            query_count: brief.sources.reduce(
              (acc, src) => acc + src.queries.length,
              0
            ),
            sha: blob.sha,
          };
        } catch (err) {
          console.error(`Failed to parse brief ${file.filename}:`, err);
          return null;
        }
      })
    );
    const briefs = items.filter((item): item is BriefListItem => item !== null);
    briefs.sort((a, b) => a.name.localeCompare(b.name, "ca"));
    return NextResponse.json({ briefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
