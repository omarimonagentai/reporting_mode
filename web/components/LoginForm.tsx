"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  next: string;
};

export function LoginForm({ next }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "Error desconegut");
        return;
      }
      // Navigate to the requested page (defaults to /). Use
      // `replace` so the login page doesn't sit in the back-button
      // history.
      router.replace(next || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconegut");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          className="mt-1.5"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        className="w-full"
        disabled={!password || submitting}
      >
        {submitting ? "Entrant…" : "Entrar"}
      </Button>
    </form>
  );
}
