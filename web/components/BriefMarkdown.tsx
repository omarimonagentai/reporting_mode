"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  children: string;
  className?: string;
};

/**
 * Shared markdown renderer for captured GROQ outputs.
 *
 * Used by both the global /history page and the per-brief drawer
 * on the brief detail. One component, one place to tune
 * typography and component overrides so the two surfaces stay
 * visually consistent.
 *
 * GFM enabled for tables, task lists and strikethrough — GROQ
 * occasionally emits those. Raw HTML stays escaped (no
 * `rehype-raw`); even though usage is internal, defending against
 * surprises in LLM output is the right default.
 */
export function BriefMarkdown({ children, className }: Props) {
  return (
    <div
      className={cn(
        "prose-brief max-w-none text-sm leading-relaxed text-zinc-800",
        // Custom in-place "prose" rules — we don't depend on the
        // tailwind-typography plugin so this is hand-rolled, but
        // small enough to keep inline.
        "[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-zinc-900",
        "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-zinc-900",
        "[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-zinc-900",
        "[&_h4]:mb-1.5 [&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:text-zinc-700",
        "[&_p]:my-2",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_strong]:font-semibold [&_strong]:text-zinc-900",
        "[&_em]:italic",
        "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-zinc-800",
        "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-zinc-200 [&_pre]:bg-zinc-50 [&_pre]:p-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-600",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
        "[&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium",
        "[&_td]:border [&_td]:border-zinc-200 [&_td]:px-2 [&_td]:py-1",
        "[&_hr]:my-4 [&_hr]:border-zinc-200",
        "[&_a]:text-zinc-900 [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-zinc-700",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
