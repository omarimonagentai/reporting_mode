import { z } from "zod";

const CRON_5_FIELD = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/;

export const querySchema = z.object({
  token: z.string().min(1, "El Query token és obligatori"),
  csv: z.boolean(),
});

export const sourceSchema = z.object({
  mode_report_token: z.string().min(1, "El Mode report és obligatori"),
  queries: z
    .array(querySchema)
    .min(1, "Cal almenys una Query dins de cada Source"),
});

// Stable code (not user-visible copy) for the cross-field gate added
// by task 20.0 / PD4. The BriefForm's validityHint branches on this
// code to surface the Catalan rationale; the schema stays
// language-agnostic.
export const EMPTY_PROMPT_NEEDS_CSV = "empty-prompt-needs-csv";

export const briefSchema = z
  .object({
    name: z.string().min(1, "El Brief Name és obligatori"),
    published: z.boolean(),
    schedule: z
      .string()
      .min(1, "El Schedule és obligatori")
      .regex(CRON_5_FIELD, "El Schedule ha de ser una expressió cron de 5 camps"),
    slack_channel: z.string().min(1, "El Slack Channel és obligatori"),
    reference_link: z
      .string()
      .refine(
        (v) => v === "" || /^https?:\/\/.+/i.test(v),
        "El Reference link ha de començar amb http:// o https://"
      ),
    sources: z.array(sourceSchema).min(1, "Cal almenys un Source"),
    // Optional. An empty prompt switches the executor into "raw mode":
    // no GROQ call, the Slack message is just a short header line
    // and every query's CSV gets attached automatically. Useful as a
    // zero-LLM-cost pipeline for «just dump this Mode query to Slack»
    // use cases.
    prompt: z.string(),
    owner_email: z.string().email().nullable().optional(),
  })
  .superRefine((brief, ctx) => {
    // Cross-field gate (PD4): a brief with no prompt produces no
    // Slack-visible content unless at least one query is set to
    // attach its CSV. Blocking the Save prevents the user from
    // creating a brief that would deliver an empty header line.
    if (brief.prompt.trim() === "") {
      const hasCsv = brief.sources.some((s) =>
        s.queries.some((q) => q.csv === true)
      );
      if (!hasCsv) {
        ctx.addIssue({
          code: "custom",
          path: [],
          message: EMPTY_PROMPT_NEEDS_CSV,
        });
      }
    }
  });

export type Query = z.infer<typeof querySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Brief = z.infer<typeof briefSchema>;

export type BriefListItem = {
  filename: string;
  name: string;
  published: boolean;
  schedule: string;
  slack_channel: string;
  source_count: number;
  query_count: number;
  sha: string;
};
