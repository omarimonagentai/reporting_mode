"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { BriefMarkdown } from "@/components/BriefMarkdown";
import { Button } from "@/components/ui/button";
import { formatCatalunyaDateTime, relativeFromPast } from "@/lib/cron";
import type { BriefOutput } from "@/lib/outputs";
import type { BriefListItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type HistoryRow = {
  brief: BriefListItem;
  outputs: BriefOutput[]; // already sorted DESC, capped at 3
};

type Props = {
  // Briefs WITH at least one captured output, already sorted by
  // latest-output time DESC. They render first.
  withOutputs: HistoryRow[];
  // Briefs WITHOUT any captured output, sorted alphabetically.
  // They render at the bottom with a muted placeholder.
  withoutOutputs: BriefListItem[];
};

export function HistoryFeed({ withOutputs, withoutOutputs }: Props) {
  if (withOutputs.length === 0 && withoutOutputs.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-8 py-12 text-center text-sm text-zinc-500">
        Cap brief al repositori encara.
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {withOutputs.map((row) => (
        <HistoryCard
          key={row.brief.filename}
          brief={row.brief}
          outputs={row.outputs}
        />
      ))}
      {withoutOutputs.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="px-1 text-[11px] uppercase tracking-wide text-zinc-400">
            Sense output capturat encara
          </div>
          {withoutOutputs.map((brief) => (
            <EmptyHistoryRow key={brief.filename} brief={brief} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  brief,
  outputs,
}: {
  brief: BriefListItem;
  outputs: BriefOutput[];
}) {
  // The latest output is always visible. Older ones (if any) hide
  // behind a per-row expander so the page stays scannable.
  const [expanded, setExpanded] = useState(false);
  const latest = outputs[0];
  const older = outputs.slice(1);
  const hasOlder = older.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <HistoryEntry
        brief={brief}
        output={latest}
        isLatest
      />
      {hasOlder && expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/40">
          {older.map((out) => (
            <HistoryEntry
              key={out.artifact_name}
              brief={brief}
              output={out}
              isLatest={false}
            />
          ))}
        </div>
      )}
      {hasOlder && (
        <div className="flex justify-center border-t border-zinc-100 bg-zinc-50/30 py-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            {expanded ? (
              <>
                <ChevronUp />
                Amaga {older.length} run{older.length === 1 ? "" : "s"} anterior{older.length === 1 ? "" : "s"}
              </>
            ) : (
              <>
                <ChevronDown />
                Veure {older.length} run{older.length === 1 ? "" : "s"} anterior{older.length === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export function HistoryEntry({
  brief,
  output,
  isLatest,
}: {
  brief: BriefListItem;
  output: BriefOutput;
  isLatest: boolean;
}) {
  const date = new Date(output.created_at);
  const ok = output.run_status === "success";
  return (
    <div className={cn("flex flex-col gap-3 px-5 py-4", !isLatest && "pl-8")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {isLatest && (
          <h2 className="text-base font-semibold text-zinc-900">
            {brief.name}
          </h2>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            ok ? "text-emerald-700" : "text-red-700"
          )}
        >
          {ok ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <XCircle className="size-3.5" />
          )}
          {ok ? "Èxit" : "Error"}
        </span>
        <span className="text-xs text-zinc-400">·</span>
        <span className="font-mono text-xs text-zinc-500">
          {relativeFromPast(date)} · {formatCatalunyaDateTime(date)}
        </span>
        <span className="text-xs text-zinc-400">·</span>
        <span className="font-mono text-xs text-zinc-500">
          #{brief.slack_channel}
        </span>
      </div>
      <BriefMarkdown>{output.markdown}</BriefMarkdown>
    </div>
  );
}

function EmptyHistoryRow({ brief }: { brief: BriefListItem }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/40 px-5 py-3">
      <span className="truncate text-sm text-zinc-700">{brief.name}</span>
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-400">
        <MinusCircle className="size-3.5" />
        Cap output capturat encara
      </div>
    </div>
  );
}
