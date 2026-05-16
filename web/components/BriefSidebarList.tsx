"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { BriefListItem } from "@/lib/schemas";

export function BriefSidebarList({ briefs }: { briefs: BriefListItem[] }) {
  const pathname = usePathname();

  if (briefs.length === 0) {
    return (
      <div className="px-2 text-xs text-zinc-400">
        Cap brief encara. Crea&apos;n el primer.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {briefs.map((brief) => {
        const href = `/briefs/${brief.filename}`;
        const isActive = pathname === href;
        return (
          <li key={brief.filename}>
            <Link
              href={href}
              className={cn(
                "block rounded-md px-2 py-1.5 text-sm text-zinc-700 transition-colors",
                isActive
                  ? "bg-zinc-100 font-medium text-zinc-900"
                  : "hover:bg-zinc-100"
              )}
            >
              {brief.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
