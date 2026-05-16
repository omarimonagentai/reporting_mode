import { NextResponse } from "next/server";
import {
  BriefAlreadyExistsError,
  listBriefs,
  readBrief,
  writeBrief,
} from "@/lib/github";
import { briefSchema, type BriefListItem } from "@/lib/schemas";
import { parseBrief, serializeBrief, slugifyBriefName } from "@/lib/yaml";

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

export async function POST(request: Request): Promise<NextResponse> {
  let payload;
  try {
    payload = (await request.json()) as { brief?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = briefSchema.safeParse(payload.brief);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid brief payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const filename = slugifyBriefName(parsed.data.name);
  if (!filename) {
    return NextResponse.json(
      { error: "Name must include at least one alphanumeric character" },
      { status: 400 }
    );
  }

  try {
    const content = serializeBrief(parsed.data);
    await writeBrief(filename, content);
    return NextResponse.json({ filename }, { status: 201 });
  } catch (err) {
    if (err instanceof BriefAlreadyExistsError) {
      return NextResponse.json(
        { error: `A brief named "${filename}.yml" already exists` },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
