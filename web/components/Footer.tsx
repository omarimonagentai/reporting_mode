import { getLatestCommit } from "@/lib/version";

function formatMadrid(iso: string): string {
  const fmt = new Intl.DateTimeFormat("ca-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute} Madrid`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export async function Footer() {
  let content: string;
  try {
    const commit = await getLatestCommit();
    content = `Built from ${commit.sha.slice(0, 7)} · ${truncate(
      commit.message,
      50
    )} · ${formatMadrid(commit.authoredAt)}`;
  } catch {
    content = "Version info unavailable";
  }

  return (
    <footer className="px-6 py-3 text-right text-xs text-zinc-500 font-mono">
      {content}
    </footer>
  );
}
