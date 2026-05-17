import "server-only";
import { CronExpressionParser } from "cron-parser";

import { TIMEZONE } from "./cron";

export { TIMEZONE };

// Matches the Vercel Cron interval declared in web/vercel.json (`*/5 * * * *`).
// The window MUST equal the interval and be applied with a STRICT bound (`<`)
// so a tick that fires at minute :05.000 picks up the brief whose previous
// fire was :05.000 — but the next tick at :10.000 won't re-pick it. Vercel
// Cron is documented as sub-minute punctual, so an inclusive `<=` here would
// risk double-dispatch on the rare on-time-twice sequence. See PRD §4 S2.
export const WINDOW_MS = 5 * 60 * 1000;

export function isDue(
  schedule: string,
  now: Date,
  windowMs: number = WINDOW_MS,
): boolean {
  try {
    const expr = CronExpressionParser.parse(schedule, {
      currentDate: now,
      tz: TIMEZONE,
    });
    const prev = expr.prev().toDate();
    const delta = now.getTime() - prev.getTime();
    return delta >= 0 && delta < windowMs;
  } catch (err) {
    console.warn(
      JSON.stringify({
        event: "scheduler.isDue.parse_error",
        schedule,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}
