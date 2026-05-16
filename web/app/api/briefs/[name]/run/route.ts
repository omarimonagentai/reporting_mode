import { NextResponse } from "next/server";
import { dispatchBriefRun } from "@/lib/dispatch";
import { BriefNotFoundError, readBrief } from "@/lib/github";

const COOLDOWN_MS = 2 * 60 * 1000;

// Module-level cooldown tracker. Lives for the lifetime of the Vercel
// function instance; on cold start the cooldown resets, which is fine
// for an internal tool — the client also persists its own deadline to
// localStorage so user-side UX is consistent even when the server's
// memory rotates.
const lastDispatch = new Map<string, number>();

type Params = { params: Promise<{ name: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { name } = await params;

  // 1. Verify the brief exists. Reuses the same lib the GET handlers
  // already use; a 404 here matches the behaviour of the rest of the
  // /api/briefs/[name] endpoints.
  try {
    await readBrief(name);
  } catch (err) {
    if (err instanceof BriefNotFoundError) {
      return NextResponse.json(
        { error: "Brief no trobat" },
        { status: 404 }
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 2. Server-side cooldown guard. The client also enforces this
  // (button disabled with countdown) so this is a backstop for race
  // conditions or out-of-band callers.
  const now = Date.now();
  const last = lastDispatch.get(name);
  if (last && now - last < COOLDOWN_MS) {
    const retry_after_seconds = Math.ceil(
      (COOLDOWN_MS - (now - last)) / 1000
    );
    return NextResponse.json(
      { error: "Cooldown actiu", retry_after_seconds },
      { status: 429 }
    );
  }

  // 3. Dispatch the workflow.
  let result;
  try {
    result = await dispatchBriefRun(name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }

  // 4. Record cooldown only after a successful dispatch — a failed
  // POST shouldn't block a retry.
  lastDispatch.set(name, now);
  return NextResponse.json({
    status: "ok",
    workflow_url: result.workflow_url,
  });
}
