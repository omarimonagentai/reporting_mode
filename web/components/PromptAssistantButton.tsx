"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onClick: () => void;
};

export function PromptAssistantButton({ onClick }: Props) {
  return (
    <Button type="button" variant="outline" size="xs" onClick={onClick}>
      <Bot />
      Prompt Assistant
    </Button>
  );
}
