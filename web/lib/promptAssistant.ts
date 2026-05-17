import "server-only";

import { getBriefList } from "@/lib/briefs";
import { listBriefs, readBrief } from "@/lib/github";
import { parseBrief } from "@/lib/yaml";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SourceContext = {
  reportName: string;
  queries: string[];
};

export type FewShotBrief = {
  name: string;
  sources: SourceContext[];
  prompt: string;
};

const FEW_SHOT_CACHE_TTL_MS = 5 * 60 * 1000;
const FEW_SHOT_TARGET = 3;
// Briefs whose prompt is shorter than this are skipped from the
// few-shot pool — they're typically placeholders, not crafted
// examples worth showing the assistant.
const MIN_PROMPT_LENGTH = 200;

type CacheEntry = {
  fetchedAt: number;
  data: FewShotBrief[];
};

let fewShotCache: CacheEntry | null = null;

/**
 * Pick the 3 briefs in the repo whose `prompt` field is longest, as a
 * proxy for «well-crafted prompts the assistant can learn from». The
 * heuristic is simple but effective at Cooltra's scale (≤ 30 briefs);
 * a future task can refine the selection (e.g. by token / success
 * count) if needed.
 *
 * Cached per-process with a 5-min TTL since the few-shot doesn't vary
 * per chat session.
 */
export async function buildFewShot(): Promise<FewShotBrief[]> {
  const now = Date.now();
  if (fewShotCache && now - fewShotCache.fetchedAt < FEW_SHOT_CACHE_TTL_MS) {
    return fewShotCache.data;
  }

  // listBriefs returns only filenames + sha; we need each brief's
  // content to score by prompt length and to surface the prompt in
  // the few-shot block.
  const files = await listBriefs();
  const briefs = await Promise.all(
    files.map(async (file) => {
      try {
        const blob = await readBrief(file.filename);
        return parseBrief(blob.content);
      } catch {
        return null;
      }
    })
  );

  const candidates = briefs
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .filter((b) => b.prompt.length >= MIN_PROMPT_LENGTH)
    .sort((a, b) => b.prompt.length - a.prompt.length)
    .slice(0, FEW_SHOT_TARGET);

  // Small-repo fallback: if filtering left us with too few, take the
  // longest available regardless of the minimum cap.
  const final =
    candidates.length >= FEW_SHOT_TARGET
      ? candidates
      : briefs
          .filter((b): b is NonNullable<typeof b> => b !== null)
          .sort((a, b) => b.prompt.length - a.prompt.length)
          .slice(0, FEW_SHOT_TARGET);

  const data: FewShotBrief[] = final.map((b) => ({
    name: b.name,
    sources: b.sources.map((s) => ({
      reportName: s.mode_report_token,
      queries: s.queries.map((q) => q.token),
    })),
    prompt: b.prompt,
  }));

  fewShotCache = { fetchedAt: now, data };
  return data;
}

/**
 * Resolve the current brief's sources (report + queries) to display
 * names. For v1 we surface the raw tokens — the chat is structured
 * around brief metadata, not Mode catalog lookups, and a name-vs-
 * token mismatch is unlikely to affect the assistant's suggestions.
 *
 * Exposed as a public helper so the route handler can build the
 * SourceContext from the in-bound payload uniformly. Currently a
 * pass-through; here as a seam for future name-resolution if we
 * decide we want it.
 */
export async function resolveSources(
  sources: Array<{ mode_report_token: string; queries: Array<{ token: string }> }>
): Promise<SourceContext[]> {
  return sources.map((s) => ({
    reportName: s.mode_report_token,
    queries: s.queries.map((q) => q.token),
  }));
}

// Suppress the unused-export warning for getBriefList — it's
// imported here pre-emptively in case future selection heuristics
// need the lightweight list (vs the heavier readBrief loop).
void getBriefList;

/**
 * Build the system prompt the Prompt Assistant LLM receives. Combines
 * four sections: role description (Catalan), output contract
 * (suggested_prompt tag protocol), current brief metadata, few-shot
 * block of well-crafted briefs.
 */
export function buildSystemPrompt(opts: {
  briefName: string;
  currentPrompt: string;
  sources: SourceContext[];
  fewShot: FewShotBrief[];
}): string {
  const { briefName, currentPrompt, sources, fewShot } = opts;

  const role = [
    "Ets un assistent que ajuda usuaris de Cooltra a escriure prompts per",
    "a briefs LLM. Els briefs llegeixen dades de Mode (anàlisi) i les",
    "transformen en missatges resumits a Slack.",
    "",
    "El teu objectiu: ajudar l'usuari a obtenir un prompt clar, concís i",
    "específic sobre el format de sortida esperat. Mantén la conversa",
    "en català. Sigues directe; demana clarificacions només quan calguin.",
  ].join("\n");

  const contract = [
    "## Format de resposta",
    "",
    "Quan l'usuari et demani generar o refinar un prompt complet i",
    "estiguis a punt per donar-li una versió aplicable, EMBOLCALLA la",
    "versió final dins d'unes etiquetes <suggested_prompt>...</suggested_prompt>.",
    "Exemple:",
    "",
    "Aquí tens una proposta:",
    "<suggested_prompt>",
    "Resumeix les dades en 3 bullets: tendència principal, anomalia",
    "més rellevant, recomanació concreta. No incloguis introducció.",
    "</suggested_prompt>",
    "Vols que ajusti alguna cosa?",
    "",
    "Si la teva resposta és una pregunta o un comentari sense un prompt",
    "complet, NO usis les etiquetes — només respon en text pla.",
  ].join("\n");

  const briefBlock = [
    "## Brief actual",
    "",
    `Nom: ${briefName || "(sense nom encara)"}`,
    `Prompt actual: ${currentPrompt.trim() ? currentPrompt.trim() : "(buit, encara no escrit)"}`,
    `Sources:`,
    sources.length === 0
      ? "  - (cap source seleccionat encara)"
      : sources
          .map(
            (s, i) =>
              `  ${i + 1}. Report ${s.reportName} → queries: ${s.queries.join(", ") || "(cap)"}`
          )
          .join("\n"),
  ].join("\n");

  const fewShotBlock = [
    "## Exemples de briefs ben elaborats al sistema",
    "",
    fewShot
      .map((b, i) => {
        const sourceLines = b.sources
          .map(
            (s) =>
              `  - Report ${s.reportName} → queries: ${s.queries.join(", ")}`
          )
          .join("\n");
        return [
          `### Exemple ${i + 1}: ${b.name}`,
          "Sources:",
          sourceLines,
          "Prompt:",
          "```",
          b.prompt,
          "```",
        ].join("\n");
      })
      .join("\n\n"),
  ].join("\n");

  return [role, "", contract, "", briefBlock, "", fewShotBlock].join("\n");
}
