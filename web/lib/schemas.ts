import { z } from "zod";

const CRON_5_FIELD = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/;

export const querySchema = z.object({
  token: z.string().min(1, "Query token is required"),
  csv: z.boolean(),
});

export const sourceSchema = z.object({
  mode_report_token: z.string().min(1, "Mode report token is required"),
  queries: z.array(querySchema).min(1, "A source needs at least one query"),
});

export const briefSchema = z.object({
  name: z.string().min(1, "Brief name is required"),
  schedule: z
    .string()
    .min(1, "Schedule is required")
    .regex(CRON_5_FIELD, "Cron expression must have 5 fields"),
  timezone: z.string().min(1, "Timezone is required"),
  slack_channel: z.string().min(1, "Slack channel is required"),
  sources: z.array(sourceSchema).min(1, "At least one source is required"),
  prompt: z.string().min(1, "Prompt is required"),
  owner_email: z.string().email().nullable().optional(),
});

export type Query = z.infer<typeof querySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Brief = z.infer<typeof briefSchema>;

export type BriefListItem = {
  filename: string;
  name: string;
  schedule: string;
  slack_channel: string;
  source_count: number;
  query_count: number;
  sha: string;
};
