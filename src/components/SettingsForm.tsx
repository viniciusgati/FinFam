"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  savingsGoalInputToCents,
  savingsGoalPreview,
} from "@/lib/savings-goal";
import TermHelpLink from "./TermHelpLink";

export interface SettingsFormProps {
  initialCycleStartDay: number;
  initialSavingsGoalCents: number | null;
  /** Dias da janela do ciclo corrente, usados na prévia da meta. */
  cycleWindowDays: number;
  initialError?: string | null;
}

const FALLBACK_ERROR = "Não foi possível salvar. Tente novamente.";
const INVALID_GOAL_ERROR = "Informe um valor de meta válido.";

export const CYCLE_START_HELP =
  "O dia de início do ciclo financeiro define quando seu ciclo começa. A janela do card de diária vai do início do ciclo até hoje; já o percentual consumido usa o mês calendário (do dia 1 ao último dia do mês).";

export const SAVINGS_GOAL_HELP =
  "A meta vale para o ciclo financeiro (a mesma janela da diária) e é opcional. Deixe em branco para não acompanhar uma meta.";

/** Centavos persistidos → texto do campo em reais (`100000` → `1.000,00`). */
function centsToInput(cents: number | null): string {
  if (cents === null || cents <= 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default function SettingsForm({
  initialCycleStartDay,
  initialSavingsGoalCents,
  cycleWindowDays,
  initialError,
}: SettingsFormProps) {
  const [cycleStartDay, setCycleStartDay] = useState(
    String(initialCycleStartDay),
  );
  const [savingsGoal, setSavingsGoal] = useState(
    centsToInput(initialSavingsGoalCents),
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function showSuccess() {
    setSuccess(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSuccess(false), 3000);
  }

  const goalCents = savingsGoalInputToCents(savingsGoal);
  const goalPreview =
    goalCents !== null && goalCents > 0
      ? savingsGoalPreview(goalCents, cycleWindowDays)
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = savingsGoal.trim();
    const parsedGoal = savingsGoalInputToCents(savingsGoal);
    if (trimmed !== "" && parsedGoal === null) {
      setError(INVALID_GOAL_ERROR);
      return;
    }

    const savingsGoalCents = trimmed === "" ? null : parsedGoal;
    setError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleStartDay: Number(cycleStartDay),
          savingsGoalCents,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        cycleStartDay?: number;
        savingsGoalCents?: number | null;
      };

      if (!response.ok) {
        setError(data.error ?? FALLBACK_ERROR);
        return;
      }

      if (typeof data.cycleStartDay === "number") {
        setCycleStartDay(String(data.cycleStartDay));
      }
      if (typeof data.savingsGoalCents === "number") {
        setSavingsGoal(centsToInput(data.savingsGoalCents));
      } else if (data.savingsGoalCents === null) {
        setSavingsGoal("");
      }
      showSuccess();
    } catch {
      setError(FALLBACK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {success && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-200"
        >
          Configuração salva com sucesso
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground-muted">
            Dia de início do ciclo financeiro
          </span>
          <input
            type="number"
            min={1}
            max={28}
            value={cycleStartDay}
            onChange={(event) => setCycleStartDay(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-foreground outline-none focus:border-emerald-500 disabled:bg-surface-strong sm:max-w-[10rem]"
          />
          <span className="block text-xs text-subtle">
            Entre 1 e 28. Use o dia de fechamento do cartão para o ciclo
            refletir o seu mês real.
          </span>
        </label>

        <p className="text-xs text-subtle">
          {CYCLE_START_HELP} <TermHelpLink termId="ciclo" />
        </p>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground-muted">
            Meta de economia por ciclo (opcional)
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={savingsGoal}
            onChange={(event) => setSavingsGoal(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-foreground outline-none focus:border-emerald-500 disabled:bg-surface-strong sm:max-w-[10rem]"
          />
          <span className="block text-xs text-subtle">
            {SAVINGS_GOAL_HELP} A janela do ciclo atual tem {cycleWindowDays}{" "}
            dias.
          </span>
        </label>

        {goalPreview && (
          <p className="text-sm text-foreground-muted">{goalPreview}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </section>
  );
}
