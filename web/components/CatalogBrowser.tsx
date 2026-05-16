"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Database,
  Plus,
  Search,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReportWithQueries } from "@/lib/mode-types";

type Props = {
  reports: ReportWithQueries[];
};

export function CatalogBrowser({ reports }: Props) {
  const [query, setQuery] = useState("");
  // Map of report token → set of query tokens whose badge has been
  // inline-expanded by the user.
  const [expandedBadges, setExpandedBadges] = useState<Set<string>>(
    () => new Set()
  );

  const trimmed = query.trim().toLowerCase();

  // Filtered view: when the search is active, hide reports that don't
  // match by name AND whose queries don't match by name/token. Auto-
  // expand reports with a query match.
  const filtered = useMemo(() => {
    if (!trimmed) {
      return reports.map((r) => ({
        report: r,
        queries: r.queries,
        autoOpen: false,
      }));
    }
    const out: {
      report: ReportWithQueries;
      queries: typeof reports[number]["queries"];
      autoOpen: boolean;
    }[] = [];
    for (const report of reports) {
      const reportMatches =
        report.name.toLowerCase().includes(trimmed) ||
        report.token.toLowerCase().includes(trimmed);
      const matchingQueries = report.queries.filter(
        (q) =>
          q.name.toLowerCase().includes(trimmed) ||
          q.token.toLowerCase().includes(trimmed)
      );
      const queryMatched = matchingQueries.length > 0;
      if (!reportMatches && !queryMatched) continue;
      out.push({
        report,
        queries: queryMatched ? matchingQueries : report.queries,
        autoOpen: queryMatched,
      });
    }
    return out;
  }, [reports, trimmed]);

  const accordionValue = useMemo(() => {
    if (!trimmed) return undefined;
    return filtered.filter((f) => f.autoOpen).map((f) => f.report.token);
  }, [filtered, trimmed]);

  function toggleBadge(reportToken: string, queryToken: string) {
    const key = `${reportToken}::${queryToken}`;
    setExpandedBadges((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Stats strip: gives a quick at-a-glance of the catalog scale.
  const totalQueries = reports.reduce(
    (acc, r) => acc + r.queries.length,
    0
  );
  const usedQueries = reports.reduce(
    (acc, r) =>
      acc + r.queries.filter((q) => (q.used_by?.length ?? 0) > 0).length,
    0
  );

  if (reports.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-8 py-12 text-center">
        <Database className="mx-auto size-8 text-zinc-400" />
        <p className="mt-3 text-sm text-zinc-500">
          Cap report al space Mode configurat.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span>
          <strong className="font-medium text-zinc-900">
            {reports.length}
          </strong>{" "}
          reports
        </span>
        <span className="text-zinc-300">·</span>
        <span>
          <strong className="font-medium text-zinc-900">
            {totalQueries}
          </strong>{" "}
          queries
        </span>
        <span className="text-zinc-300">·</span>
        <span>
          <strong className="font-medium text-zinc-900">
            {usedQueries}
          </strong>{" "}
          en ús per algun brief
        </span>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca reports o queries per nom o token…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && trimmed ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-10 text-center text-sm text-zinc-500">
          Cap report o query coincideix amb «{trimmed}».
        </div>
      ) : (
        <Accordion
          type="multiple"
          className="mt-5 gap-3"
          value={accordionValue}
        >
          {filtered.map(({ report, queries }) => (
            <ReportCard
              key={report.token}
              report={report}
              queries={queries}
              expandedBadges={expandedBadges}
              onToggleBadge={toggleBadge}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}

function ReportCard({
  report,
  queries,
  expandedBadges,
  onToggleBadge,
}: {
  report: ReportWithQueries;
  queries: ReportWithQueries["queries"];
  expandedBadges: Set<string>;
  onToggleBadge: (reportToken: string, queryToken: string) => void;
}) {
  return (
    <AccordionItem
      value={report.token}
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md data-[state=open]:shadow-md"
    >
      <AccordionTrigger className="rounded-none border-0 px-5 py-4 hover:no-underline">
        <div className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            <Database className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-zinc-900">
              {report.name}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">
              {report.token}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="shrink-0 rounded-full bg-zinc-100 font-normal text-zinc-600"
          >
            {report.queries.length}{" "}
            {report.queries.length === 1 ? "query" : "queries"}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-0">
        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
          {queries.length === 0 ? (
            <p className="text-xs italic text-zinc-400">
              Aquest report no té queries.
            </p>
          ) : (
            queries.map((q) => {
              const badgeOpen = expandedBadges.has(
                `${report.token}::${q.token}`
              );
              const count = q.used_by?.length ?? 0;
              return (
                <QueryRow
                  key={q.token}
                  name={q.name}
                  token={q.token}
                  count={count}
                  open={badgeOpen}
                  onToggleBadge={() => onToggleBadge(report.token, q.token)}
                  consumers={q.used_by ?? []}
                  reportToken={report.token}
                />
              );
            })
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function QueryRow({
  name,
  token,
  count,
  open,
  onToggleBadge,
  consumers,
  reportToken,
}: {
  name: string;
  token: string;
  count: number;
  open: boolean;
  onToggleBadge: () => void;
  consumers: ReportWithQueries["queries"][number]["used_by"];
  reportToken: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 transition-colors hover:bg-zinc-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-900">{name}</p>
          <p className="mt-0.5 font-mono text-xs text-zinc-400">{token}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {count === 0 ? (
            <>
              <Badge
                variant="outline"
                className="rounded-full border-zinc-200 font-normal text-zinc-400"
              >
                0 briefs
              </Badge>
              <Button asChild size="xs" variant="ghost">
                <Link href={`/briefs/new?prefill_report=${reportToken}`}>
                  <Plus />
                  Create brief
                </Link>
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleBadge}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                open
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
              aria-expanded={open}
            >
              <span>
                usat per {count} brief{count === 1 ? "" : "s"}
              </span>
              <ChevronDown
                className={cn(
                  "size-3 transition-transform",
                  open && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
      </div>
      {open && count > 0 && consumers && consumers.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-zinc-200 pt-2.5 pl-1">
          {consumers.map((b) => (
            <li key={b.filename}>
              <Link
                href={`/briefs/${b.filename}`}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-700 transition-colors hover:text-zinc-900 hover:no-underline"
              >
                <ArrowRight className="size-3 text-zinc-400" />
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
