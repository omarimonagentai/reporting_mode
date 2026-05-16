"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BriefListItem } from "@/lib/schemas";

type FetchState =
  | { kind: "loading" }
  | { kind: "ready"; briefs: BriefListItem[] }
  | { kind: "error"; message: string };

export function BriefSidebar() {
  const params = useParams<{ name?: string }>();
  const activeFilename = params?.name;
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/briefs", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { briefs: BriefListItem[] };
        if (!cancelled) setState({ kind: "ready", briefs: data.briefs });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4">
      <Button asChild size="sm" className="w-full justify-start">
        <Link href="/briefs/new">
          <Plus />
          New brief
        </Link>
      </Button>

      {state.kind === "loading" && (
        <div className="px-2 text-xs text-zinc-400">Loading briefs…</div>
      )}

      {state.kind === "error" && (
        <div className="px-2 text-xs text-red-600">
          No s&apos;han pogut carregar els briefs: {state.message}
        </div>
      )}

      {state.kind === "ready" && state.briefs.length === 0 && (
        <div className="px-2 text-xs text-zinc-400">
          Cap brief encara. Crea&apos;n el primer.
        </div>
      )}

      {state.kind === "ready" && state.briefs.length > 0 && (
        <ul className="flex flex-col gap-1">
          {state.briefs.map((brief) => {
            const isActive = brief.filename === activeFilename;
            return (
              <li key={brief.filename}>
                <Link
                  href={`/briefs/${brief.filename}`}
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
      )}
    </div>
  );
}
