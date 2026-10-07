"use client";

import { useState, type FormEvent } from "react";
import { parseAmountToCents } from "@/lib/money";
import {
  simulatePurchase,
  VERDICT_LABELS,
  type PurchaseVerdict,
} from "@/lib/ai/purchase-simulator";

interface PurchaseSimulatorProps {
  incomeCents: number;
  spentCents: number;
  elapsedDay: number;
  daysInMonth: number;
  previousMonthsCents: number[];
}

type Status = "idle" | "loading" | "done";

interface SimulationResult {
  verdict: PurchaseVerdict;
  summary: string;
}

interface SimulatorResponse {
  verdict?: PurchaseVerdict;
  summary?: string;
}

const VERDICT_CLASSES: Record<PurchaseVerdict, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cuidado: "border-amber-300 bg-amber-50 text-amber-800",
  nao: "border-red-300 bg-red-50 text-red-800",
};

export default function PurchaseSimulator({
  incomeCents,
  spentCents,
  elapsedDay,
  daysInMonth,
  previousMonthsCents,
}: PurchaseSimulatorProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [failed, setFailed] = useState(false);

  const cents = parseAmountToCents(value);
  const invalid = cents === null;
  const showValidation = invalid;

  function buildLocalResult(purchaseCents: number): SimulationResult {
    const simulation = simulatePurchase({
      incomeCents,
      spentCents,
      elapsedDay,
      daysInMonth,
      purchaseCents,
      previousMonthsCents,
    });
    return { verdict: simulation.verdict, summary: simulation.summary };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cents === null) return;

    setStatus("loading");
    setResult(null);
    setFailed(false);

    try {
      const response = await fetch("/api/ai/purchase-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incomeCents,
          spentCents,
          elapsedDay,
          daysInMonth,
          purchaseCents: cents,
          previousMonthsCents,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as SimulatorResponse;
      if (!response.ok || !data.verdict) {
        setResult(buildLocalResult(cents));
      } else {
        setResult({
          verdict: data.verdict,
          summary: data.summary ?? buildLocalResult(cents).summary,
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
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Posso comprar?
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3" noValidate>
        <label className="flex-1 space-y-1">
          <span className="text-sm font-medium text-slate-700">
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
            className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 ${
              showValidation ? "border-red-500" : "border-slate-300"
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
        <p className="text-sm text-red-600">Informe um valor maior que zero</p>
      )}

      {status === "loading" && (
        <p role="status" aria-live="polite" className="text-sm text-slate-600">
          Analisando sua compra…
        </p>
      )}

      {status === "done" && failed && (
        <p role="alert" className="text-sm text-red-700">
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
          <p className="text-sm">{result.summary}</p>
        </div>
      )}
    </section>
  );
}
