import { Suspense } from "react";
import { CalendarClock } from "lucide-react";
import { ScheduleTable, type ScheduleRow } from "./ScheduleTable";
import { Skeleton } from "@/components/ui/skeleton";
import { getBriefListWithRuns } from "@/lib/briefs";
import { nextFireAt } from "@/lib/cron";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Schedule</h1>

      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleData />
      </Suspense>
    </div>
  );
}

async function ScheduleData() {
  const briefs = await getBriefListWithRuns();
  const rows: ScheduleRow[] = briefs.map((b) => ({
    brief: b,
    next: nextFireAt(b.schedule),
  }));

  if (rows.length === 0 || rows.every((r) => r.next === null)) {
    return <EmptyState hasBriefs={rows.length > 0} />;
  }

  return <ScheduleTable rows={rows} />;
}

function EmptyState({ hasBriefs }: { hasBriefs: boolean }) {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-8 py-12 text-center">
      <CalendarClock className="mx-auto size-8 text-zinc-400" />
      <h2 className="mt-3 text-sm font-medium text-zinc-900">
        Cap execució programada properament
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        {hasBriefs
          ? "Cap dels briefs té un schedule vàlid. Edita'n algun per assignar-li un cron."
          : "Crea el primer brief des de la barra lateral."}
      </p>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-4 gap-4 border-t border-zinc-100 px-4 py-3"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
