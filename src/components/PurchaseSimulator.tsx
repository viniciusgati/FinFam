"use client";

import { useState, type FormEvent } from "react";
import { parseAmountToCents } from "@/lib/money";
import {
  simulatePurchase,
  VERDICT_LABELS,
  type PurchaseVerdict,
  type SimulatePurchaseInput,
} from "@/lib/ai/purchase-simulator";

interface PurchaseSimulatorProps {
  /** Orçamento livre restante do ciclo em centavos. */
  freeBudgetCents: number;
  /** Poder de compra por dia do ciclo em centavos (negativo se estourado). */
  dailyCents: number;
  /** Dias restantes do ciclo, contando hoje. */
  remainingDays: number;
  /** Ritmo recente de gastos avulsos por dia; `null` sem base para medir. */
  usualDailySpendCents: number | null;
}

type Status = "idle" | "loading" | "done";

interface SimulationResult {
  verdict: PurchaseVerdict;
  summary: string;
  impactLabel: string;
}

interface SimulatorResponse {
  verdict?: PurchaseVerdict;
  summary?: string;
}

const VERDICT_CLASSES: Record<PurchaseVerdict, string> = {
  ok: "border-emerald-700 bg-emerald-950 text-emerald-200",
  cuidado: "border-amber-700 bg-amber-950 text-amber-200",
  nao: "border-red-700 bg-red-950 text-red-200",
};

export default function PurchaseSimulator({
  freeBudgetCents,
  dailyCents,
  remainingDays,
  usualDailySpendCents,
}: PurchaseSimulatorProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [failed, setFailed] = useState(false);

  const cents = parseAmountToCents(value);
  const invalid = cents === null;
  const showValidation = invalid;

  function buildInput(purchaseCents: number): SimulatePurchaseInput {
    return {
      freeBudgetCents,
      dailyCents,
      remainingDays,
      usualDailySpendCents,
      purchaseCents,
    };
  }

  function buildLocalResult(purchaseCents: number): SimulationResult {
    const simulation = simulatePurchase(buildInput(purchaseCents));
    return {
      verdict: simulation.verdict,
      summary: simulation.summary,
      impactLabel: simulation.impactLabel,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cents === null) return;

    setStatus("loading");
    setResult(null);
    setFailed(false);

    const input = buildInput(cents);

    try {
      const response = await fetch("/api/ai/purchase-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = (await response.json().catch(() => ({}))) as SimulatorResponse;
      const local = buildLocalResult(cents);
      if (!response.ok || !data.verdict) {
        setResult(local);
      } else {
        setResult({
          verdict: data.verdict,
          summary: data.summary ?? local.summary,
          impactLabel: local.impactLabel,
        });
      }
    } catch {
      // Falha de rota/rede: mantém o veredito + justificativa locais.
      try {
        setResult(buildLocalResult(cents));
      } catch {
        setFailed(true);
      }
    } finally {
      setStatus("done");
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-6 text-left shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Posso comprar?</h2>
      <p className="text-sm text-foreground-muted">
        Veja quanto a compra reduz o seu poder de compra por dia até o fim do
        ciclo.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3" noValidate>
        <label className="flex-1 space-y-1">
          <span className="text-sm font-medium text-foreground-muted">
            Valor da compra (R$)
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="1.234,56"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label="Valor da compra em reais"
            aria-invalid={showValidation}
            className={`w-full rounded-lg border bg-surface-raised px-3 py-2 text-foreground outline-none focus:border-emerald-500 ${
              showValidation ? "border-red-500" : "border-border-strong"
            }`}
          />
        </label>

        <button
          type="submit"
          disabled={invalid || status === "loading"}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading" ? "Consultando…" : "Simular"}
        </button>
      </form>

      {showValidation && (
        <p className="text-sm text-red-400">Informe um valor maior que zero</p>
      )}

      {status === "loading" && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-foreground-muted"
        >
          Analisando sua compra…
        </p>
      )}

      {status === "done" && failed && (
        <p role="alert" className="text-sm text-red-300">
          Não foi possível simular agora. Tente novamente.
        </p>
      )}

      {result && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Veredito: ${VERDICT_LABELS[result.verdict]}`}
          className={`space-y-1 rounded-xl border px-4 py-3 ${VERDICT_CLASSES[result.verdict]}`}
        >
          <p className="text-base font-semibold">
            {VERDICT_LABELS[result.verdict]}
          </p>
          <p className="text-sm font-medium">{result.impactLabel}</p>
          <p className="text-sm">{result.summary}</p>
        </div>
      )}
    </section>
  );
}
