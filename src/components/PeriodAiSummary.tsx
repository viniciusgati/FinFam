"use client";

import { useState } from "react";
import {
  fetchPeriodAiSummary,
  PERIOD_AI_BUTTON_LABEL,
  PERIOD_AI_ERROR_MESSAGE,
  PERIOD_AI_LOADING_LABEL,
  PERIOD_AI_LOADING_MESSAGE,
  PERIOD_AI_LOCAL_NOTE,
  type PeriodAiSummaryResponse,
} from "@/lib/period-ai-summary";

export interface PeriodAiSummaryProps {
  /** Mês de início do ciclo corrente, enviado à rota. */
  monthKey: string;
  /** Texto determinístico exibido quando a rota/rede falha. */
  fallback: string;
}

type Status = "idle" | "loading" | "done";

/**
 * Bloco opcional "Leitura da IA" dentro do diagnóstico do período. O botão
 * pede a narrativa à rota; falha de rede/rota mostra o fallback local e marca
 * explicitamente que não houve IA. Nenhum dado sai do servidor por este
 * componente.
 */
export default function PeriodAiSummary({
  monthKey,
  fallback,
}: PeriodAiSummaryProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PeriodAiSummaryResponse | null>(null);
  const [failed, setFailed] = useState(false);

  async function handleGenerate() {
    setStatus("loading");
    setResult(null);
    setFailed(false);

    const outcome = await fetchPeriodAiSummary({ monthKey });
    if (outcome.data === null) {
      setFailed(true);
    } else {
      setResult(outcome.data);
    }
    setStatus("done");
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-strong px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
          Leitura da IA
        </h3>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === "loading"}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading"
            ? PERIOD_AI_LOADING_LABEL
            : PERIOD_AI_BUTTON_LABEL}
        </button>
      </div>

      {status === "loading" && (
        <p
          role="status"
          aria-live="polite"
          className="mt-2 text-sm text-foreground-muted"
        >
          {PERIOD_AI_LOADING_MESSAGE}
        </p>
      )}

      {status === "done" && failed && (
        <div role="status" aria-live="polite" className="mt-2 space-y-1">
          <p className="text-sm font-medium text-foreground-muted">
            {PERIOD_AI_ERROR_MESSAGE}
          </p>
          <p className="text-sm text-foreground">{fallback}</p>
        </div>
      )}

      {result !== null && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 space-y-2 text-sm text-foreground"
        >
          <p>{result.summary}</p>
          {result.actions.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-foreground-muted">
              {result.actions.map((action) => (
                <li key={`${action.factId}-${action.text}`}>{action.text}</li>
              ))}
            </ul>
          )}
          {result.source === "local" && (
            <p className="text-xs font-medium text-foreground-muted">
              {PERIOD_AI_LOCAL_NOTE}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
