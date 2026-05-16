import "server-only";

import {
  downloadZip,
  listArtifacts,
  type RunRecord,
} from "@/lib/runs";

export type BriefOutput = {
  markdown: string;
  created_at: string;
  artifact_name: string;
  run_status: "success" | "failed";
};

function artifactCouldContainSlug(name: string, slug: string): boolean {
  return name.startsWith(`run-${slug}-`) || name.startsWith("runs-due-");
}

/**
 * Return the most recent brief outputs for one slug, newest first.
 *
 * Iterates over GitHub Actions artifacts (same pattern as
 * `lib/runs.ts:fetchLatestRuns`), downloads only the zips that could
 * contain the slug, and pulls out `<slug>.brief.md` plus its
 * colocated `<slug>.run.json` for the status cross-reference.
 *
 * Stops once `limit` entries have been collected. Artifacts that
 * don't contain the slug, or whose `<slug>.brief.md` is missing
 * (failed runs), are silently skipped.
 */
/**
 * Bulk variant of fetchLatestBriefOutputs for the global /history
 * page. Lists artifacts ONCE and resolves multiple slugs from the
 * same downloaded zip(s) — a `runs-due-*` artifact bundle often
 * contains `.brief.md` for several briefs at once, and we don't
 * want to refetch the same zip per slug.
 *
 * Returns a Map<slug, BriefOutput[]>. Slugs absent from the map
 * mean "no captured outputs yet" (recently created brief, every
 * run failed before GROQ, or the brief is too new for any 90-day
 * artifact to exist).
 */
export async function fetchAllRecentBriefOutputs(
  slugs: string[],
  limit = 3
): Promise<Map<string, BriefOutput[]>> {
  const result = new Map<string, BriefOutput[]>();
  if (slugs.length === 0) return result;

  const wanted = new Set(slugs);

  const artifacts = await listArtifacts();
  const candidates = artifacts
    .filter(
      (a) =>
        !a.expired &&
        (a.name.startsWith("run-") || a.name.startsWith("runs-due-"))
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  for (const artifact of candidates) {
    // Slugs that still need more entries AND could be inside this
    // artifact (run-<slug>-* targets one specific slug; runs-due-*
    // could contain any subset).
    const stillNeeded = [...wanted].filter(
      (s) =>
        artifactCouldContainSlug(artifact.name, s) &&
        (result.get(s)?.length ?? 0) < limit
    );
    if (stillNeeded.length === 0) {
      // Either every requested slug is full, or this artifact is
      // unrelated. Skip without downloading.
      const anyOpen = [...wanted].some(
        (s) => (result.get(s)?.length ?? 0) < limit
      );
      if (!anyOpen) break;
      continue;
    }

    let zip;
    try {
      zip = await downloadZip(artifact);
    } catch (err) {
      console.error(
        `fetchAll: failed to download artifact ${artifact.id} (${artifact.name}):`,
        err
      );
      continue;
    }
    if (!zip) continue;

    for (const slug of stillNeeded) {
      if ((result.get(slug)?.length ?? 0) >= limit) continue;
      const briefEntry = zip.file(`${slug}.brief.md`);
      if (!briefEntry) continue;
      let markdown: string;
      try {
        markdown = await briefEntry.async("string");
      } catch (err) {
        console.error(
          `fetchAll: failed to read ${slug}.brief.md inside ${artifact.name}:`,
          err
        );
        continue;
      }
      let runStatus: "success" | "failed" = "success";
      const runEntry = zip.file(`${slug}.run.json`);
      if (runEntry) {
        try {
          const content = await runEntry.async("string");
          const record = JSON.parse(content) as RunRecord;
          runStatus = record.status;
        } catch {
          // keep the default
        }
      }
      const entry: BriefOutput = {
        markdown,
        created_at: artifact.created_at,
        artifact_name: artifact.name,
        run_status: runStatus,
      };
      const existing = result.get(slug);
      if (existing) existing.push(entry);
      else result.set(slug, [entry]);
    }
  }

  return result;
}

export async function fetchLatestBriefOutputs(
  slug: string,
  limit = 3
): Promise<BriefOutput[]> {
  if (limit <= 0) return [];

  const artifacts = await listArtifacts();
  const candidates = artifacts
    .filter(
      (a) =>
        !a.expired &&
        (a.name.startsWith("run-") || a.name.startsWith("runs-due-"))
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const collected: BriefOutput[] = [];

  for (const artifact of candidates) {
    if (collected.length >= limit) break;
    if (!artifactCouldContainSlug(artifact.name, slug)) continue;

    let zip;
    try {
      zip = await downloadZip(artifact);
    } catch (err) {
      console.error(
        `Failed to download artifact ${artifact.id} (${artifact.name}):`,
        err
      );
      continue;
    }
    if (!zip) continue;

    const briefEntry = zip.file(`${slug}.brief.md`);
    if (!briefEntry) continue;

    let markdown: string;
    try {
      markdown = await briefEntry.async("string");
    } catch (err) {
      console.error(
        `Failed to read ${slug}.brief.md inside ${artifact.name}:`,
        err
      );
      continue;
    }

    // Cross-reference the colocated run.json for status. If it's
    // missing or malformed we still surface the output, falling back
    // to "success" — the brief.md only exists when GROQ produced
    // text, so a failed Slack post still produces a markdown file
    // worth reading.
    let runStatus: "success" | "failed" = "success";
    const runEntry = zip.file(`${slug}.run.json`);
    if (runEntry) {
      try {
        const content = await runEntry.async("string");
        const record = JSON.parse(content) as RunRecord;
        runStatus = record.status;
      } catch {
        // keep the default
      }
    }

    collected.push({
      markdown,
      created_at: artifact.created_at,
      artifact_name: artifact.name,
      run_status: runStatus,
    });
  }

  return collected;
}
