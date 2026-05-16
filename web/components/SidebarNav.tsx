"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Database, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname();
  const catalogActive = pathname === "/";
  const scheduleActive = pathname === "/schedule";
  const historyActive = pathname === "/history";
  return (
    <div className="flex flex-col gap-2">
      <Button asChild size="sm" className="w-full justify-start">
        <Link href="/briefs/new">
          <Plus />
          New brief
        </Link>
      </Button>
      <Link
        href="/"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 transition-colors",
          catalogActive
            ? "bg-zinc-100 font-medium text-zinc-900"
            : "hover:bg-zinc-100"
        )}
      >
        <Database className="size-4" />
        Catalog
      </Link>
      <Link
        href="/schedule"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 transition-colors",
          scheduleActive
            ? "bg-zinc-100 font-medium text-zinc-900"
            : "hover:bg-zinc-100"
        )}
      >
        <CalendarClock className="size-4" />
        Schedule
      </Link>
      <Link
        href="/history"
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 transition-colors",
          historyActive
            ? "bg-zinc-100 font-medium text-zinc-900"
            : "hover:bg-zinc-100"
        )}
      >
        <History className="size-4" />
        History
      </Link>
    </div>
  );
}
