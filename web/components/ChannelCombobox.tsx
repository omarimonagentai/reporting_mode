"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Copy, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SlackChannel } from "@/lib/slack";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaInvalid?: boolean;
};

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; channels: SlackChannel[] }
  | { kind: "error"; message: string };

const BOT_INVITE_SNIPPET = "/invite @cooltra-reporting-bot";
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function ChannelCombobox({ value, onChange, disabled, ariaInvalid }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChannels = useCallback(async (opts: { force?: boolean } = {}) => {
    setState((prev) =>
      prev.kind === "ready" ? prev : { kind: "loading" }
    );
    try {
      const url = opts.force ? "/api/channels?force=true" : "/api/channels";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { channels: SlackChannel[] };
      setState({ kind: "ready", channels: data.channels });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ kind: "error", message });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchChannels();
    pollRef.current = setInterval(() => {
      void fetchChannels();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchChannels]);

  const channels = state.kind === "ready" ? state.channels : [];
  const matchedChannel = channels.find((c) => c.name === value);
  const showBotWarning =
    state.kind === "ready" && value.trim() !== "" && !matchedChannel;

  function selectChannel(name: string) {
    onChange(name);
    setQuery("");
    setOpen(false);
  }

  function commitTyped() {
    const trimmed = query.trim().replace(/^#/, "");
    if (!trimmed) return;
    selectChannel(trimmed);
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(BOT_INVITE_SNIPPET);
      toast.success("Copiat!", { duration: 2000 });
    } catch {
      toast.error("No s'ha pogut copiar");
    }
  }

  const trimmedQuery = query.trim().replace(/^#/, "");
  const exactMatch = channels.some((c) => c.name === trimmedQuery);
  const showUseTyped = trimmedQuery.length > 0 && !exactMatch;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm transition-colors",
              "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
              "disabled:cursor-not-allowed disabled:opacity-60",
              ariaInvalid && "border-red-300 ring-2 ring-red-100"
            )}
          >
            <span className="font-mono">
              {value ? (
                <>
                  {matchedChannel?.is_private ? (
                    <Lock className="mr-1 inline size-3.5" />
                  ) : (
                    <span className="mr-0.5 text-zinc-500">#</span>
                  )}
                  {value}
                </>
              ) : (
                <span className="text-zinc-400 font-sans">Select channel…</span>
              )}
            </span>
            <ChevronsUpDown className="size-4 text-zinc-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search channels…"
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && showUseTyped) {
                  e.preventDefault();
                  commitTyped();
                }
              }}
            />
            <CommandList>
              {state.kind === "loading" && (
                <div className="px-3 py-4 text-xs text-zinc-500">
                  Carregant canals…
                </div>
              )}
              {state.kind === "error" && (
                <div className="px-3 py-4 text-xs text-red-600">
                  Error: {state.message}
                </div>
              )}
              {state.kind === "ready" && channels.length === 0 && (
                <CommandEmpty>
                  <div className="px-3 py-3 text-xs text-zinc-500">
                    El bot no és a cap canal encara. Afegeix-lo amb{" "}
                    <code className="font-mono">{BOT_INVITE_SNIPPET}</code> a
                    Slack i refresca.
                  </div>
                </CommandEmpty>
              )}
              {state.kind === "ready" && channels.length > 0 && (
                <CommandGroup>
                  {channels
                    .filter((c) =>
                      trimmedQuery
                        ? c.name.toLowerCase().includes(trimmedQuery.toLowerCase())
                        : true
                    )
                    .map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => selectChannel(c.name)}
                        className="font-mono"
                      >
                        {c.is_private ? (
                          <Lock className="size-3.5 text-zinc-500" />
                        ) : (
                          <span className="text-zinc-500">#</span>
                        )}
                        <span>{c.name}</span>
                        {value === c.name && (
                          <Check className="ml-auto size-3.5 text-zinc-500" />
                        )}
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
              {showUseTyped && (
                <CommandGroup>
                  <CommandItem
                    value={`__use__${trimmedQuery}`}
                    onSelect={() => selectChannel(trimmedQuery)}
                    className="font-sans text-zinc-700"
                  >
                    Use «<span className="font-mono">{trimmedQuery}</span>»
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <div className="flex items-center justify-end border-t border-zinc-100 px-2 py-1.5">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => void fetchChannels({ force: true })}
            >
              <RefreshCw />
              Refresh channels
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {showBotWarning && (
        <Alert variant="default" className="border-amber-300 bg-amber-50">
          <AlertTitle className="text-amber-900">
            El bot no és al canal #{value}
          </AlertTitle>
          <AlertDescription className="text-amber-900/80">
            <div>
              Afegeix-lo abans del proper run amb aquesta comanda dins del canal a Slack:
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded bg-white/60 px-2 py-1 font-mono text-xs">
                {BOT_INVITE_SNIPPET}
              </code>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={copyInvite}
              >
                <Copy />
                Copy
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
