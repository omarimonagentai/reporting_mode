import "server-only";

export type SlackChannel = {
  id: string;
  name: string;
  is_private: boolean;
};

type SlackChannelsResponse = {
  ok: boolean;
  error?: string;
  channels?: Array<{
    id: string;
    name: string;
    is_private?: boolean;
    is_member?: boolean;
  }>;
  response_metadata?: { next_cursor?: string };
};

const SLACK_API = "https://slack.com/api";
const PAGE_LIMIT = 200;

export async function listChannels(): Promise<SlackChannel[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN must be set");
  }

  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      types: "public_channel,private_channel",
      limit: String(PAGE_LIMIT),
      exclude_archived: "true",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(
      `${SLACK_API}/conversations.list?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      throw new Error(`Slack HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as SlackChannelsResponse;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
    }
    for (const c of data.channels ?? []) {
      if (c.is_member) {
        channels.push({
          id: c.id,
          name: c.name,
          is_private: Boolean(c.is_private),
        });
      }
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  channels.sort((a, b) => a.name.localeCompare(b.name, "ca"));
  return channels;
}
