import { BriefSidebarList } from "@/components/BriefSidebarList";
import { SidebarNav } from "@/components/SidebarNav";
import { getBriefListWithRuns, type BriefListItemWithRun } from "@/lib/briefs";

export async function BriefSidebar() {
  let briefs: BriefListItemWithRun[] = [];
  let errorMessage: string | null = null;
  try {
    briefs = await getBriefListWithRuns();
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <SidebarNav />

      {errorMessage ? (
        <div className="px-2 text-xs text-red-600">
          No s&apos;han pogut carregar els briefs: {errorMessage}
        </div>
      ) : (
        <BriefSidebarList briefs={briefs} />
      )}
    </div>
  );
}
