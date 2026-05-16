import { NextResponse } from "next/server";
import { getLatestCommit } from "@/lib/version";

export async function GET() {
  try {
    const commit = await getLatestCommit();
    return NextResponse.json(commit);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
