import { NextResponse } from "next/server";
import { BriefNotFoundError, readBrief } from "@/lib/github";
import { parseBrief } from "@/lib/yaml";

type Params = { params: Promise<{ name: string }> };

export async function GET(
  _request: Request,
  { params }: Params
): Promise<NextResponse> {
  const { name } = await params;
  try {
    const blob = await readBrief(name);
    const brief = parseBrief(blob.content);
    return NextResponse.json({ brief, sha: blob.sha });
  } catch (err) {
    if (err instanceof BriefNotFoundError) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
