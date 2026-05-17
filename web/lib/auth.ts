// Password-gate helpers. Edge-runtime compatible (no node:crypto,
// no `server-only` guard) because the same primitives are consumed
// by both the Node-runtime login route and the Edge-runtime
// middleware.
//
// Design (decided with user 2026-05-17): plain-password cookie. The
// cookie value IS the password the user submitted at login,
// HttpOnly + Secure + SameSite=Lax. Compared against
// process.env.APP_PASSWORD on every request via the middleware.
//
// Why plain-password and not HMAC: this is a single-shared-secret
// gate for a small internal team. The user has the password
// already, so the cookie reveals nothing they don't have. HttpOnly
// prevents JS access; Secure ensures HTTPS-only transit.

export const AUTH_COOKIE_NAME = "app-auth";

// Effectively "never expires" — about 68 years. Decided with the
// user on 2026-05-17 («no cal que caduqui, comencem amb un grup
// molt reduït»). If access ever needs to be revoked, rotating
// APP_PASSWORD in Vercel invalidates every cookie at once on the
// next request — the middleware compares the cookie value against
// the env var verbatim.
export const AUTH_COOKIE_MAX_AGE = 2_147_483_647;

/**
 * Constant-time string compare. Returns true only when both strings
 * have the same length AND identical content. The compare walks
 * the full length even on mismatch to avoid leaking position-of-
 * first-difference via timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Compare a cookie value (or submitted login form value) against
 * APP_PASSWORD. Returns false when the env var is missing — the
 * login page surfaces that to the operator separately.
 */
export function matchesPassword(value: string | undefined): boolean {
  if (!value) return false;
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  return timingSafeEqual(value, expected);
}
