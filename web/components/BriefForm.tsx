"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { briefSchema, type Brief } from "@/lib/schemas";

type FormMode = "view" | "edit";

type Props = {
  filename: string;
  initialBrief: Brief;
  initialSha: string;
  loadedAt: string;
};

const formSchema = briefSchema;
type FormValues = z.infer<typeof formSchema>;

const FIELD_HELP = {
  name: 'Nom llegible del brief (ex: "App Version Adoption"). Es mostra a la barra lateral i a Slack. El nom del fitxer es deriva d\'aquest valor.',
  schedule:
    'Expressió cron de 5 camps (minut hora dia-mes mes dia-setmana). Ex: "0 8 * * *" = cada dia a les 08:00. El constructor visual arribarà a la tasca 3.0.',
  timezone:
    'Zona horària amb què s\'interpreta el cron. Ex: "Europe/Madrid". Per defecte "Europe/Madrid".',
  slack_channel:
    'Canal de Slack on es publica el brief. Sense "#", només el nom (ex: "test-github-oriol"). El bot ha de ser membre del canal.',
  prompt:
    "Prompt complet que rep el LLM amb les dades de Mode adjuntades. Pots usar markdown, llistes i instruccions estructurades.",
  mode_report_token:
    'Token del report de Mode (l\'string que apareix a la URL del report: "/reports/<token>"). Identifica el dashboard origen.',
  query_token:
    'Token de la query dins del report de Mode. Apareix a la URL ampliada de la query individual. Determina quines dades es passen al LLM.',
  csv: "Si està marcat, s'adjunta el CSV brut d'aquesta query com a resposta dins del thread de Slack.",
};

function formatLoadedAt(iso: string): string {
  const fmt = new Intl.DateTimeFormat("ca-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date(iso));
}

function FieldHelp({ text }: { text: string }) {
  return <p className="mt-1 text-xs text-zinc-500">{text}</p>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function ReadonlyValue({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className={
        mono
          ? "rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 font-mono"
          : "rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
      }
    >
      {children}
    </div>
  );
}

export function BriefForm({ filename, initialBrief, initialSha, loadedAt }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>("view");
  const [sha, setSha] = useState(initialSha);
  const [brief, setBrief] = useState(initialBrief);
  const [isSaving, setIsSaving] = useState(false);

  const defaultValues = useMemo<FormValues>(() => brief, [brief]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const isEditing = mode === "edit";

  function enterEdit() {
    reset(brief);
    setMode("edit");
  }

  function cancelEdit() {
    reset(brief);
    setMode("view");
  }

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/briefs/${filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: values, sha }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { sha: string };
      setSha(data.sha);
      setBrief(values);
      reset(values);
      setMode("view");
      toast.success("Brief desat");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`No s'ha pogut desar: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">
          Carregat a {formatLoadedAt(loadedAt)}
        </div>
        {mode === "view" ? (
          <Button type="button" size="sm" variant="outline" onClick={enterEdit}>
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={cancelEdit}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Desant…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="name">Name</Label>
        {isEditing ? (
          <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        ) : (
          <ReadonlyValue>{brief.name}</ReadonlyValue>
        )}
        <FieldHelp text={FIELD_HELP.name} />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="schedule">Schedule (cron)</Label>
          {isEditing ? (
            <Input
              id="schedule"
              className="font-mono"
              {...register("schedule")}
              aria-invalid={!!errors.schedule}
            />
          ) : (
            <ReadonlyValue mono>{brief.schedule}</ReadonlyValue>
          )}
          <FieldHelp text={FIELD_HELP.schedule} />
          <FieldError message={errors.schedule?.message} />
        </div>

        <div>
          <Label htmlFor="timezone">Timezone</Label>
          {isEditing ? (
            <Input
              id="timezone"
              {...register("timezone")}
              aria-invalid={!!errors.timezone}
            />
          ) : (
            <ReadonlyValue mono>{brief.timezone}</ReadonlyValue>
          )}
          <FieldHelp text={FIELD_HELP.timezone} />
          <FieldError message={errors.timezone?.message} />
        </div>
      </div>

      <div>
        <Label htmlFor="slack_channel">Slack channel</Label>
        {isEditing ? (
          <Input
            id="slack_channel"
            className="font-mono"
            {...register("slack_channel")}
            aria-invalid={!!errors.slack_channel}
          />
        ) : (
          <ReadonlyValue mono>#{brief.slack_channel}</ReadonlyValue>
        )}
        <FieldHelp text={FIELD_HELP.slack_channel} />
        <FieldError message={errors.slack_channel?.message} />
      </div>

      <div>
        <Label>Sources</Label>
        <div className="mt-2 flex flex-col gap-3">
          {brief.sources.map((source, sIdx) => (
            <div
              key={sIdx}
              className="rounded-md border border-zinc-200 bg-white p-4"
            >
              <div className="text-xs font-medium text-zinc-500">
                Source #{sIdx + 1}
              </div>

              <div className="mt-2">
                <Label htmlFor={`mode_report_token_${sIdx}`}>
                  Mode report token
                </Label>
                {isEditing ? (
                  <Input
                    id={`mode_report_token_${sIdx}`}
                    className="font-mono"
                    {...register(`sources.${sIdx}.mode_report_token` as const)}
                    aria-invalid={
                      !!errors.sources?.[sIdx]?.mode_report_token
                    }
                  />
                ) : (
                  <ReadonlyValue mono>{source.mode_report_token}</ReadonlyValue>
                )}
                <FieldHelp text={FIELD_HELP.mode_report_token} />
                <FieldError
                  message={
                    errors.sources?.[sIdx]?.mode_report_token?.message
                  }
                />
              </div>

              <div className="mt-4">
                <Label>Queries</Label>
                <div className="mt-2 flex flex-col gap-2">
                  {source.queries.map((query, qIdx) => (
                    <div
                      key={qIdx}
                      className="flex items-start gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
                    >
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            className="font-mono"
                            placeholder="Query token"
                            {...register(
                              `sources.${sIdx}.queries.${qIdx}.token` as const
                            )}
                            aria-invalid={
                              !!errors.sources?.[sIdx]?.queries?.[qIdx]?.token
                            }
                          />
                        ) : (
                          <div className="font-mono text-sm text-zinc-900">
                            {query.token}
                          </div>
                        )}
                        <FieldError
                          message={
                            errors.sources?.[sIdx]?.queries?.[qIdx]?.token
                              ?.message
                          }
                        />
                      </div>

                      <label className="flex shrink-0 items-center gap-2 pt-2 text-sm text-zinc-700">
                        <Controller
                          control={control}
                          name={`sources.${sIdx}.queries.${qIdx}.csv` as const}
                          render={({ field }) => (
                            <input
                              type="checkbox"
                              className="size-4 rounded border-zinc-300"
                              disabled={!isEditing}
                              checked={field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                            />
                          )}
                        />
                        CSV
                      </label>
                    </div>
                  ))}
                </div>
                <FieldHelp text={FIELD_HELP.query_token} />
                <FieldHelp text={FIELD_HELP.csv} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="prompt">Prompt</Label>
        {isEditing ? (
          <Textarea
            id="prompt"
            rows={20}
            className="font-mono text-sm"
            {...register("prompt")}
            aria-invalid={!!errors.prompt}
          />
        ) : (
          <pre className="mt-2 max-h-[40rem] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm text-zinc-900 whitespace-pre-wrap">
            {brief.prompt}
          </pre>
        )}
        <FieldHelp text={FIELD_HELP.prompt} />
        <FieldError message={errors.prompt?.message} />
      </div>
    </form>
  );
}
