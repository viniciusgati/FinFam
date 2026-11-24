"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConsumptionMode } from "@/lib/consumption-mode";

export const CONSUMPTION_MODE_SAVED_MESSAGE = "Modo de consumo atualizado";
export const CONSUMPTION_MODE_SAVE_ERROR =
  "Não foi possível salvar o modo de consumo. Tente novamente.";
export const CONSUMPTION_MODE_SAVING_LABEL = "Salvando…";
export const CONSUMPTION_MODE_GROUP_LABEL = "Modo de consumo do ciclo";

export const CONSUMPTION_MODE_OPTIONS: ReadonlyArray<{
  mode: ConsumptionMode;
  label: string;
}> = [
  { mode: "INCOME", label: "Renda do ciclo" },
  { mode: "VARIABLE_BUDGET", label: "Orçamento variável" },
];

/** Corpo exato enviado para `PUT /api/settings` ao trocar o modo. */
export function consumptionModePayload(
  cycleStartDay: number,
  mode: ConsumptionMode,
): { cycleStartDay: number; consumptionMode: ConsumptionMode } {
  return { cycleStartDay, consumptionMode: mode };
}

export interface ConsumptionModeToggleProps {
  /** Modo persistido no carregamento da Home. */
  initialMode: ConsumptionMode;
  /** Dia de início do ciclo, reenviado para manter a configuração completa. */
  cycleStartDay: number;
}

const BUTTON_CLASSES =
  "rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Seletor do modo de consumo do ciclo na Home (história #380).
 *
 * A troca é persistida via `PUT /api/settings`; o modo selecionado só muda
 * depois da resposta de sucesso (sem alteração otimista). Enquanto salva, os
 * dois botões ficam desabilitados e o escolhido mostra "Salvando…". Sucesso e
 * erro aparecem acima do grupo, em `role="status"`/`role="alert"`.
 */
export default function ConsumptionModeToggle({
  initialMode,
  cycleStartDay,
}: ConsumptionModeToggleProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ConsumptionMode>(initialMode);
  const [savingMode, setSavingMode] = useState<ConsumptionMode | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectMode(nextMode: ConsumptionMode) {
    if (savingMode !== null || nextMode === mode) return;

    setSuccess(false);
    setError(null);
    setSavingMode(nextMode);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(consumptionModePayload(cycleStartDay, nextMode)),
      });

      if (!response.ok) {
        setError(CONSUMPTION_MODE_SAVE_ERROR);
        return;
      }

      setMode(nextMode);
      setSuccess(true);
      router.refresh();
    } catch {
      setError(CONSUMPTION_MODE_SAVE_ERROR);
    } finally {
      setSavingMode(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {success && (
        <p
          role="status"
          className="rounded-lg border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm font-medium text-emerald-200"
        >
          {CONSUMPTION_MODE_SAVED_MESSAGE}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-sm font-medium text-red-200"
        >
          {error}
        </p>
      )}

      <div
        role="group"
        aria-label={CONSUMPTION_MODE_GROUP_LABEL}
        className="inline-flex gap-1 rounded-lg border border-border-strong bg-surface p-1"
      >
        {CONSUMPTION_MODE_OPTIONS.map((option) => {
          const selected = mode === option.mode;
          const savingThis = savingMode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => selectMode(option.mode)}
              disabled={savingMode !== null}
              aria-pressed={selected}
              aria-busy={savingThis ? true : undefined}
              className={`${BUTTON_CLASSES} ${
                selected
                  ? "bg-emerald-600 text-white"
                  : "text-foreground-muted hover:bg-surface-raised"
              }`}
            >
              {savingThis ? CONSUMPTION_MODE_SAVING_LABEL : option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
