import "server-only";

import { NextResponse } from "next/server";

import { streamChatCompletion } from "@/lib/groq";
import {
  buildFewShot,
  buildSystemPrompt,
  resolveSources,
  type ChatMessage,
  type FewShotBrief,
} from "@/lib/promptAssistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceShape = {
  mode_report_token: string;
  queries: Array<{ token: string }>;
};

type Body = {
  messages: ChatMessage[];
  context: {
    briefName: string;
    currentPrompt: string;
    sources: SourceShape[];
  };
};

function sseLine(event:
  | { kind: "delta"; delta: string }
  | { kind: "complete" }
  | { kind: "error"; message: string }
): string {
  return `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}

function isValidBody(payload: unknown): payload is Body {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Partial<Body>;
  if (!Array.isArray(p.messages)) return false;
  for (const m of p.messages) {
    if (!m || typeof m !== "object") return false;
    if (m.role !== "user" && m.role !== "assistant") return false;
    if (typeof m.content !== "string") return false;
  }
  if (!p.context || typeof p.context !== "object") return false;
  const c = p.context;
  if (typeof c.briefName !== "string") return false;
  if (typeof c.currentPrompt !== "string") return false;
  if (!Array.isArray(c.sources)) return false;
  return true;
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (!isValidBody(payload)) {
    return NextResponse.json(
      { error: "Invalid payload shape" },
      { status: 400 }
    );
  }

  const { messages, context } = payload;
  const sources = await resolveSources(context.sources);
  let fewShot: FewShotBrief[];
  try {
    fewShot = await buildFewShot();
  } catch {
    // If the few-shot can't be loaded (GitHub API down, parser
    // error on a brief, etc.) fall back to no examples — the
    // assistant still works, just without the in-context style
    // reference.
    fewShot = [];
  }
  const systemPrompt = buildSystemPrompt({
    briefName: context.briefName,
    currentPrompt: context.currentPrompt,
    sources,
    fewShot,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamChatCompletion({
          systemPrompt,
          messages,
          signal: request.signal,
        })) {
          if (chunk.kind === "delta") {
            controller.enqueue(
              encoder.encode(sseLine({ kind: "delta", delta: chunk.delta }))
            );
          } else {
            // chunk.kind === "done" — usage is not relevant for the
            // chat assistant (we don't surface token counts in the
            // Sheet). Emit the terminator and close.
            controller.enqueue(encoder.encode(sseLine({ kind: "complete" })));
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Caller-initiated cancel — no error event, just close.
          return;
        }
        const message =
          err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(
          encoder.encode(sseLine({ kind: "error", message }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Disable nginx-style proxy buffering — chunks must flush
      // immediately to the client so streaming feels live.
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
