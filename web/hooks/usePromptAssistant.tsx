"use client";

import { createContext, useContext, type ReactNode } from "react";

type Ctx = {
  applyPrompt: (text: string) => void;
};

const PromptAssistantContext = createContext<Ctx | null>(null);

export function PromptAssistantProvider({
  applyPrompt,
  children,
}: {
  applyPrompt: (text: string) => void;
  children: ReactNode;
}) {
  return (
    <PromptAssistantContext.Provider value={{ applyPrompt }}>
      {children}
    </PromptAssistantContext.Provider>
  );
}

export function usePromptAssistant(): Ctx {
  const ctx = useContext(PromptAssistantContext);
  if (!ctx) {
    throw new Error(
      "usePromptAssistant called outside PromptAssistantProvider — mount the provider in BriefForm.tsx"
    );
  }
  return ctx;
}
