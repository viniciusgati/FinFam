"use client";

import { useState } from "react";

interface MonthReviewPanelProps {
  monthKey: string;
  /** Mês estritamente anterior ao corrente. */
  eligible: boolean;
  /** Avaliação determinística local, exibida como fallback. */
  localSummary: string;
}

type Status = "idle" | "loading" | "done" | "fallback";

interface ReviewResponse {
  monthKey?: string;
  summary?: string;
  cached?: boolean;
  error?: string;
}

export default function MonthReviewPanel({
  monthKey,
  eligible,
  localSummary,
}: MonthReviewPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  async function handleReview() {
    setStatus("loading");
    setSummary(null);
    setCached(false);

    try {
      const response = await fetch("/api/ai/month-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey }),
      });

      if (!response.ok) {
        setStatus("fallback");
        return;
      }

      const data = (await response.json()) as ReviewResponse;
      if (!data.summary) {
        setStatus("fallback");
        return;
      }

      setSummary(data.summary);
      setCached(Boolean(data.cached));
      setStatus("done");
    } catch {
      setStatus("fallback");
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Avaliação do mês fechado
        </h2>
        <button
          type="button"
          onClick={handleReview}
          disabled={!eligible || status === "loading"}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading" ? "Avaliando…" : "Avaliar mês fechado"}
        </button>
      </div>

      {!eligible && (
        <p className="text-sm text-subtle">
          O mês atual ainda está em andamento.
        </p>
      )}

      {status === "loading" && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-foreground-muted"
        >
          Gerando avaliação do mês…
        </p>
      )}

      {status === "done" && summary && (
        <div role="status" aria-live="polite" className="space-y-1">
          <p className="text-foreground">{summary}</p>
          {cached && (
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">
              conteúdo em cache
            </p>
          )}
        </div>
      )}

      {status === "fallback" && (
        <div role="status" aria-live="polite" className="space-y-1">
          <p className="text-sm font-medium text-foreground-muted">
            Avaliação por IA indisponível no momento
          </p>
          <p className="text-foreground">{localSummary}</p>
        </div>
      )}
    </section>
  );
}
