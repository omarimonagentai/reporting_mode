"use client";

import { type ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  columns: string[];
  rows: Record<string, unknown>[];
  total_rows: number;
};

const TRUNCATE_AT = 80;
const DATE_LIKE = /^\d{4}-\d{2}-\d{2}/;

export function PreviewTable({ columns, rows, total_rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        {columns.length > 0 && (
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-medium text-zinc-600"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
        )}
        <p className="text-xs text-zinc-500">
          Cap fila retornada en aquest run.
        </p>
      </div>
    );
  }

  // Best-effort column alignment: number columns right-align by looking
  // at the first non-null value of each column.
  const alignRight = new Set<string>();
  for (const col of columns) {
    for (const row of rows) {
      const v = row[col];
      if (v === null || v === undefined) continue;
      if (typeof v === "number") alignRight.add(col);
      break;
    }
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={cn(
                    "px-3 py-2 font-medium text-zinc-600",
                    alignRight.has(col) ? "text-right" : "text-left"
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="border-t border-zinc-100 even:bg-zinc-50/40"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={cn(
                      "px-3 py-2 align-top",
                      alignRight.has(col) && "text-right"
                    )}
                  >
                    {renderCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total_rows > rows.length && (
        <p className="text-xs text-zinc-500">
          Showing {rows.length} of {total_rows} rows
        </p>
      )}
    </div>
  );
}

function renderCell(value: unknown): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-zinc-400">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="font-mono text-zinc-700">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="font-mono text-zinc-900">{value}</span>;
  }
  if (typeof value === "string") {
    const isDate = DATE_LIKE.test(value);
    const className = isDate ? "font-mono text-zinc-800" : "text-zinc-800";
    return truncatable(value, className);
  }
  // Object / array → compact JSON in a <code>.
  const serialised = safeJson(value);
  return truncatable(serialised, "font-mono text-[11px] text-zinc-700");
}

function truncatable(text: string, className: string): ReactNode {
  if (text.length <= TRUNCATE_AT) {
    return <span className={className}>{text}</span>;
  }
  const truncated = `${text.slice(0, TRUNCATE_AT)}…`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(className, "block max-w-xs truncate")}>
          {truncated}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md break-words">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
