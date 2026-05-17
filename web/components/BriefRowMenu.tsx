"use client";

import Link from "next/link";
import { Edit, History, MoreVertical, Play } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMmSs, useRunNow } from "@/hooks/useRunNow";
import { cn } from "@/lib/utils";

export function BriefRowMenu({ filename }: { filename: string }) {
  const { running, onCooldown, remainingSeconds, dispatch } =
    useRunNow(filename);

  const runDisabled = running || onCooldown;
  const runLabel = running
    ? "Running…"
    : onCooldown
      ? `Run Now (${formatMmSs(remainingSeconds)})`
      : "Run Now";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Brief actions"
          // `opacity-0 group-hover:opacity-100` makes the kebab quiet by
          // default; `focus-visible:` keeps it reachable by keyboard;
          // `data-[state=open]:` pins it visible while the popover is open
          // so it doesn't blink away when the cursor leaves the row.
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-900 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          // The kebab sits inside the row's anchor element; without this
          // a click on the kebab would also navigate to the brief.
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <MoreVertical className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-48 p-1">
        <MenuLink
          href={`/briefs/${filename}?edit=1`}
          icon={<Edit className="size-4 text-zinc-500" />}
          label="Edit"
        />
        <button
          type="button"
          disabled={runDisabled}
          onClick={() => void dispatch()}
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
            "text-zinc-700 hover:bg-zinc-100",
            "disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:bg-transparent"
          )}
        >
          <Play className="size-4 text-zinc-500" />
          {runLabel}
        </button>
        <MenuLink
          href={`/briefs/${filename}?history=1`}
          icon={<History className="size-4 text-zinc-500" />}
          label="History"
        />
      </PopoverContent>
    </Popover>
  );
}

function MenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
    >
      {icon}
      {label}
    </Link>
  );
}
