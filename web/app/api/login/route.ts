import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  matchesPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let payload;
  try {
    payload = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  if (typeof payload.password !== "string") {
    return NextResponse.json(
      { error: "Missing password" },
      { status: 400 }
    );
  }

  if (!matchesPassword(payload.password)) {
    // Generic message — no «password incorrect» vs «env var
    // missing» distinction to the client. The operator can debug
    // via Vercel logs.
    return NextResponse.json(
      { error: "Password incorrecte" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: payload.password,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  return response;
}
