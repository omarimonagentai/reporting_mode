import yaml from "js-yaml";
import { briefSchema, type Brief } from "@/lib/schemas";

type RawQuery = string | { token: string; csv?: boolean };
type RawSource = { mode_report_token: string; queries: RawQuery[] };
type RawBrief = {
  name: string;
  schedule: string;
  slack_channel: string;
  reference_link?: string | null;
  csv?: boolean;
  sources: RawSource[];
  prompt: string;
  owner_email?: string | null;
};

export function parseBrief(content: string): Brief {
  const raw = yaml.load(content) as RawBrief | undefined;
  if (!raw || typeof raw !== "object") {
    throw new Error("YAML did not parse to an object");
  }

  const briefCsv = raw.csv === true;

  const sources = (raw.sources ?? []).map((src) => ({
    mode_report_token: src.mode_report_token,
    queries: (src.queries ?? []).map((q) =>
      typeof q === "string"
        ? { token: q, csv: briefCsv }
        : { token: q.token, csv: q.csv ?? briefCsv }
    ),
  }));

  return briefSchema.parse({
    name: raw.name,
    schedule: raw.schedule,
    slack_channel: raw.slack_channel,
    reference_link: raw.reference_link ?? "",
    sources,
    prompt: raw.prompt,
    owner_email: raw.owner_email ?? null,
  });
}

export function serializeBrief(brief: Brief): string {
  const ordered: Record<string, unknown> = {
    name: brief.name,
    schedule: brief.schedule,
    slack_channel: brief.slack_channel,
  };
  if (brief.reference_link && brief.reference_link.trim() !== "") {
    ordered.reference_link = brief.reference_link.trim();
  }
  ordered.sources = brief.sources.map((src) => ({
    mode_report_token: src.mode_report_token,
    queries: src.queries.map((q) => ({ token: q.token, csv: q.csv })),
  }));
  ordered.prompt = brief.prompt;
  ordered.owner_email = brief.owner_email ?? null;

  return yaml.dump(ordered, {
    sortKeys: false,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
}

export function slugifyBriefName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
