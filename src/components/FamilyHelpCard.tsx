"use client";

import { useState } from "react";
import FamilyInsightList from "@/components/FamilyInsightList";
import {
  FAMILY_HELP_BUTTON_LABEL,
  FAMILY_HELP_BUTTON_LOADING_LABEL,
  FAMILY_HELP_ERROR_MESSAGE,
  FAMILY_HELP_LOADING_MESSAGE,
} from "@/lib/ai/family-help";
import type { FamilyInsight } from "@/lib/family-insights";

interface FamilyHelpCardProps {
  /** Insights determinísticos já montados por `buildFamilyInsights`. */
  insights: FamilyInsight[];
  /** Texto local determinístico exibido quando a IA está indisponível. */
  fallback: string;
  /** Mês de referência enviado à rota de IA. */
  monthKey: string;
}

type Status = "idle" | "loading" | "done" | "error";

interface FamilyHelpResponse {
  summary?: string;
  error?: string;
}

/**
 * Card "Ajuda à família": lista os insights determinísticos (renderizados no
 * servidor) e oferece o resumo complementar da IA sob demanda. Sem chave, em
 * falha ou erro de rede, o botão volta a habilitado e o fallback local aparece.
 */
export default function FamilyHelpCard({
  insights,
  fallback,
  monthKey,
}: FamilyHelpCardProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<string | null>(null);

  async function handleGenerate() {
    setStatus("loading");
    setSummary(null);

    try {
      const response = await fetch("/api/ai/family-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey }),
      });
      const data = (await response.json().catch(() => ({}))) as FamilyHelpResponse;

      if (!response.ok || !data.summary) {
        setStatus("error");
        return;
      }

      setSummary(data.summary);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Ajuda à família</h2>

      <FamilyInsightList insights={insights} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === "loading"}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading"
            ? FAMILY_HELP_BUTTON_LOADING_LABEL
            : FAMILY_HELP_BUTTON_LABEL}
        </button>
      </div>

      {status === "loading" && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-foreground-muted"
        >
          {FAMILY_HELP_LOADING_MESSAGE}
        </p>
      )}

      {status === "done" && summary && (
        <p role="status" aria-live="polite" className="text-foreground">
          {summary}
        </p>
      )}

      {status === "error" && (
        <div role="status" aria-live="polite" className="space-y-1">
          <p className="text-sm font-medium text-foreground-muted">
            {FAMILY_HELP_ERROR_MESSAGE}
          </p>
          <p className="text-foreground">{fallback}</p>
        </div>
      )}
    </section>
  );
}
