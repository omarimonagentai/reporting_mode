"use client";

import { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props =
  | { mode: "create" }
  | { mode: "existing"; filename: string };

const COOLDOWN_MS = 2 * 60 * 1000;

function storageKey(filename: string) {
  return `runnow:${filename}`;
}

function readPersistedDeadline(filename: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(filename));
  if (!raw) return null;
  const t = Number(raw);
  if (!Number.isFinite(t) || t <= Date.now()) return null;
  return t;
}

function writePersistedDeadline(filename: string, deadlineMs: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(filename), String(deadlineMs));
}

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  const [running, setRunning] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  // Hydrate the cooldown deadline from localStorage on mount so the
  // countdown survives reloads.
  useEffect(() => {
    const d = readPersistedDeadline(filename);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d) setDeadline(d);
  }, [filename]);

  // Tick the visible countdown every second while a deadline is set.
  useEffect(() => {
    if (deadline === null) return;
    const update = () => {
      const r = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) setDeadline(null);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const onClick = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/briefs/${filename}/run`, {
        method: "POST",
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retry_after_seconds?: number;
        };
        const retry = data.retry_after_seconds ?? 120;
        const d = Date.now() + retry * 1000;
        writePersistedDeadline(filename, d);
        setDeadline(d);
        toast.warning(`Cooldown actiu — torna a provar en ${retry}s.`);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as {
        status: "ok";
        workflow_url: string;
      };
      const d = Date.now() + COOLDOWN_MS;
      writePersistedDeadline(filename, d);
      setDeadline(d);
      toast.success("Run dispatched a GitHub Actions", {
        description: "El missatge arribarà a Slack quan acabi.",
        action: {
          label: "Veure",
          onClick: () => window.open(data.workflow_url, "_blank"),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }, [filename]);

  const onCooldown = deadline !== null && remaining > 0;
  const disabled = running || onCooldown;

  const label = running
    ? "Running…"
    : onCooldown
      ? `Run Now — torna a provar en ${formatMmSs(remaining)}`
      : "Run Now";

  return (
    <Button type="button" size="sm" disabled={disabled} onClick={onClick}>
      <Play />
      {label}
    </Button>
  );
}
