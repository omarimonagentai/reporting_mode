import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { HistoryFeed, type HistoryRow } from "@/components/HistoryFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { getBriefList } from "@/lib/briefs";
import { fetchAllRecentBriefOutputs, type BriefOutput } from "@/lib/outputs";
import type { BriefListItem } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">History</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Els últims outputs capturats de cada brief, agrupats per brief.
      </p>

      <Suspense fallback={<HistorySkeleton />}>
        <HistoryData />
      </Suspense>
    </div>
  );
}

async function HistoryData() {
  let briefs: BriefListItem[];
  let outputsBySlug: Map<string, BriefOutput[]>;
  try {
    briefs = await getBriefList();
    outputsBySlug = await fetchAllRecentBriefOutputs(
      briefs.map((b) => b.filename),
      3
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return <HistoryError message={message} />;
  }

  const withOutputs: HistoryRow[] = [];
  const withoutOutputs: BriefListItem[] = [];

  for (const brief of briefs) {
    const list = outputsBySlug.get(brief.filename);
    if (list && list.length > 0) {
      withOutputs.push({ brief, outputs: list });
    } else {
      withoutOutputs.push(brief);
    }
  }

  // Briefs with outputs: descending by latest output's created_at.
  // (Each list inside outputsBySlug is already sorted DESC by the
  // lib, so list[0] is the latest.)
  withOutputs.sort(
    (a, b) =>
      new Date(b.outputs[0].created_at).getTime() -
      new Date(a.outputs[0].created_at).getTime()
  );
  // Briefs without outputs: alphabetical, case-insensitive locale.
  withoutOutputs.sort((a, b) => a.name.localeCompare(b.name, "ca"));

  return (
    <HistoryFeed withOutputs={withOutputs} withoutOutputs={withoutOutputs} />
  );
}

function HistorySkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-baseline gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryError({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50/60 px-6 py-8 text-center">
      <AlertTriangle className="mx-auto size-7 text-amber-500" />
      <h2 className="mt-3 text-sm font-medium text-zinc-900">
        No s&apos;ha pogut carregar l&apos;historial
      </h2>
      <p className="mt-1 text-xs text-zinc-500">{message}</p>
      <p className="mt-3 text-xs text-zinc-500">
        Recarrega la pàgina per tornar a intentar-ho. La barra lateral i la
        resta de la plataforma continuen funcionant.
      </p>
    </div>
  );
}
