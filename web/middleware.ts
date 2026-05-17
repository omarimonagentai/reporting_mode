import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, matchesPassword } from "@/lib/auth";

// Password gate for the whole app. Decided with user 2026-05-17:
// a single shared secret distributed by the operator to whoever
// needs access. Not real auth — just verifies the user typed the
// right string at /login.
//
// Exempt routes:
// - /login + /api/login: the login flow itself.
// - /api/scheduler/tick: Vercel Cron pings this with its own
//   CRON_SECRET in the Authorization header; never has the cookie.
// - /icon.svg, /_next/*, /favicon.ico: framework assets.
//
// The matcher config below excludes most of these at the routing
// layer; the early-return inside the function is a defense in depth
// for paths the matcher might miss.

const EXEMPT_PATHS = new Set(["/login", "/api/login"]);
const EXEMPT_PREFIXES = ["/api/scheduler/tick"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Forward the current pathname as a request header so server
  // components (RootLayout in particular) can branch on the route
  // — e.g. skip the sidebar on /login. Next.js doesn't expose the
  // current URL to server components otherwise.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (EXEMPT_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  for (const prefix of EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (matchesPassword(cookie)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // For API requests, return 401 JSON instead of a redirect so
  // fetch() callers from the browser get a clean failure they can
  // handle (the UI already shows the login page anyway).
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Page requests: redirect to /login. Preserve where the user was
  // headed via ?next= so the login route can return them there
  // after a successful submit.
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything EXCEPT static assets + framework internals.
  // _next/static + _next/image + favicon.ico + icon.svg never hit
  // the middleware so the page-load cost stays low.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
