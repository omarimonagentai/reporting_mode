/**
 * Pure helper that builds the Slack-message mock the DryRunSheet
 * surfaces when the brief is in raw mode (empty prompt).
 *
 * Mirrors the production executor's raw-mode Slack post shape at
 * scripts/executor.py:post_brief_to_slack:
 *  - Header line: `📎 <brief name> — DD/MM/YYYY — volcat de dades`
 *  - One CSV attachment per query, filename derived from query name
 *
 * The user sees the same wording inside the Sheet as receivers see
 * in Slack — the preview is faithful to what the executor would post.
 */

type Attachment = { filename: string };

export type SlackRawModePreview = {
  headerText: string;
  attachments: Attachment[];
};

const DATE_FMT = new Intl.DateTimeFormat("ca-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function buildSlackRawModePreview(
  briefName: string,
  queries: ReadonlyArray<{ queryName: string }>,
  now: Date = new Date()
): SlackRawModePreview {
  const today = DATE_FMT.format(now);
  return {
    headerText: `📎 ${briefName} — ${today} — volcat de dades`,
    attachments: queries.map((q) => ({
      filename: slugifyForFilename(q.queryName) + ".csv",
    })),
  };
}

/**
 * TS port of scripts/executor.py:355-356's `slugify_for_filename`.
 * Identical regex semantics so the filename rendered in the preview
 * matches exactly what Slack receives in production.
 */
function slugifyForFilename(text: string): string {
  const slug = text.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || "data";
}
