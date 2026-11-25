"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  parseReserveAmountInput,
  reserveAmountInputValue,
  RESERVE_FORM_BUTTON,
  RESERVE_FORM_ERROR,
  RESERVE_FORM_INVALID,
  RESERVE_FORM_LABEL,
  RESERVE_FORM_SUCCESS,
  saveReserveSnapshot,
} from "@/lib/reserve";

export interface ReserveSnapshotFormProps {
  /** Mês de início do ciclo (YYYY-MM) confirmado na rota. */
  monthKey: string;
  /** Último saldo confirmado; `null` quando ainda não há snapshot. */
  currentAmountCents: number | null;
}

type Feedback = "success" | "error" | null;

/**
 * Formulário compacto de confirmação do saldo guardado. O valor vai para
 * `/api/reserve` e a página é revalidada (`router.refresh`) para o diagnóstico
 * recalcular cobertura/gap com o novo saldo.
 */
export default function ReserveSnapshotForm({
  monthKey,
  currentAmountCents,
}: ReserveSnapshotFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(() =>
    reserveAmountInputValue(currentAmountCents),
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [error, setError] = useState<string | null>(null);

  const cents = parseReserveAmountInput(value);
  const showInvalid = value.trim().length > 0 && cents === null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cents === null) return;

    setSubmitting(true);
    setFeedback(null);
    setError(null);

    const result = await saveReserveSnapshot({ monthKey, amountCents: cents });
    if (result.ok) {
      setFeedback("success");
      router.refresh();
    } else {
      setError(result.error ?? RESERVE_FORM_ERROR);
      setFeedback("error");
    }
    setSubmitting(false);
  }

  return (
    <div className="mt-3">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-wrap items-end gap-2"
      >
        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-subtle">
            {RESERVE_FORM_LABEL}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0,00"
            aria-label={RESERVE_FORM_LABEL}
            aria-invalid={showInvalid}
            className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-emerald-500 ${
              showInvalid ? "border-red-500" : "border-border-strong"
            }`}
          />
        </label>
        <button
          type="submit"
          disabled={submitting || cents === null}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Salvando…" : RESERVE_FORM_BUTTON}
        </button>
      </form>

      {showInvalid && (
        <p className="mt-1 text-xs text-red-400">{RESERVE_FORM_INVALID}</p>
      )}

      {feedback === "error" && (
        <p
          role="alert"
          className="mt-1 text-xs text-red-400"
        >
          {error ?? RESERVE_FORM_ERROR}
        </p>
      )}

      {feedback === "success" && (
        <p
          role="status"
          aria-live="polite"
          className="mt-1 text-xs font-medium text-emerald-300"
        >
          {RESERVE_FORM_SUCCESS}
        </p>
      )}
    </div>
  );
}
