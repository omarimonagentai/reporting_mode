"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMmSs, useRunNow } from "@/hooks/useRunNow";

type Props =
  | { mode: "create" }
  | { mode: "existing"; filename: string };

export function RunNowButton(props: Props) {
  if (props.mode === "create") {
    // Disabled-with-hint on /briefs/new. Wrapping the disabled button
    // in a span keeps the Tooltip listener alive — Radix tooltips don't
    // receive hover events on a child whose pointer-events: none.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button type="button" size="sm" disabled>
              <Play />
              Run Now
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Crea el brief abans de poder executar-lo.
        </TooltipContent>
      </Tooltip>
    );
  }
  return <RunNowButtonExisting filename={props.filename} />;
}

function RunNowButtonExisting({ filename }: { filename: string }) {
  const { running, onCooldown, remainingSeconds, dispatch } =
    useRunNow(filename);
  const disabled = running || onCooldown;
  const label = running
    ? "Running…"
    : onCooldown
      ? `Run Now — torna a provar en ${formatMmSs(remainingSeconds)}`
      : "Run Now";

  return (
    <Button type="button" size="sm" disabled={disabled} onClick={dispatch}>
      <Play />
      {label}
    </Button>
  );
}
