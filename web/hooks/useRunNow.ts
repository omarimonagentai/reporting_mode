"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const COOLDOWN_MS = 2 * 60 * 1000;
const STORAGE_PREFIX = "runnow:";
const DISPATCHED_EVENT = "runnow:dispatched";

function storageKey(filename: string) {
  return `${STORAGE_PREFIX}${filename}`;
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

function emitDispatched(filename: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DISPATCHED_EVENT, { detail: { filename } })
  );
}

export function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type RunNowState = {
  running: boolean;
  onCooldown: boolean;
  remainingSeconds: number;
  dispatch: () => Promise<void>;
};

// Shared Run Now state for a single brief. Two consumers (header button +
// sidebar kebab) call this hook with the same filename and stay in sync
// because (a) the cooldown deadline is persisted in localStorage and
// (b) every successful dispatch fires a window custom event the hook
// listens to. The same-tab live sync matters because localStorage events
// don't fire in the originating tab — without the custom event the other
// button would only refresh on next mount or reload.
export function useRunNow(filename: string): RunNowState {
  const [running, setRunning] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function refresh() {
      setDeadline(readPersistedDeadline(filename));
    }
    refresh();
    function onDispatched(event: Event) {
      const detail = (event as CustomEvent).detail as
        | { filename?: string }
        | undefined;
      if (detail?.filename === filename) refresh();
    }
    window.addEventListener(DISPATCHED_EVENT, onDispatched as EventListener);
    return () => {
      window.removeEventListener(
        DISPATCHED_EVENT,
        onDispatched as EventListener
      );
    };
  }, [filename]);

  useEffect(() => {
    if (deadline === null) return;
    function update() {
      const r = Math.max(0, Math.ceil((deadline! - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) setDeadline(null);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const dispatch = useCallback(async () => {
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
        emitDispatched(filename);
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
      emitDispatched(filename);
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
  return { running, onCooldown, remainingSeconds: remaining, dispatch };
}
