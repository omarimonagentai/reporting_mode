import { BriefForm } from "@/components/BriefForm";

export default function NewBriefPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">New brief</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Omple els camps; el nom del fitxer es derivarà del camp Name.
      </p>
      <div className="mt-8">
        <BriefForm intent="create" />
      </div>
    </div>
  );
}
