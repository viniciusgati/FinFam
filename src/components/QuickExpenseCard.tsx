"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  buildQuickExpensePayload,
  mapQuickExpenseFieldErrors,
  todayISO,
  validateQuickExpense,
  type QuickExpenseErrors,
} from "@/lib/quick-expense";

const NETWORK_ERROR_MESSAGE =
  "Não foi possível salvar. Verifique sua conexão e tente novamente.";

type Feedback = "success" | "error" | null;

const FIELD_CLASSES =
  "rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

export default function QuickExpenseCard() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [errors, setErrors] = useState<QuickExpenseErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const input = { description, amount, date };
    const validation = validateQuickExpense(input);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const payload = buildQuickExpensePayload(input);
    if (!payload) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/variable-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        setErrors(mapQuickExpenseFieldErrors(body?.fieldErrors));
        return;
      }

      if (response.status !== 201) {
        setFeedback("error");
        return;
      }

      setDescription("");
      setAmount("");
      setDate(todayISO());
      setFeedback("success");
      router.refresh();
    } catch {
      setFeedback("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="h-full rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        Lançamento rápido
      </h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Registre um gasto em segundos, sem sair do dashboard.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
            Data
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? "erro-quick-date" : undefined}
              className={FIELD_CLASSES}
            />
            {errors.date ? (
              <span id="erro-quick-date" className="text-sm text-red-400">
                {errors.date}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
            Descrição
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: Feira"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "erro-quick-description" : undefined
              }
              className={FIELD_CLASSES}
            />
            {errors.description ? (
              <span
                id="erro-quick-description"
                className="text-sm text-red-400"
              >
                {errors.description}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
            Valor (R$)
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="12,34"
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "erro-quick-amount" : undefined}
              className={FIELD_CLASSES}
            />
            {errors.amount ? (
              <span id="erro-quick-amount" className="text-sm text-red-400">
                {errors.amount}
              </span>
            ) : null}
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Salvando..." : "Salvar"}
          </button>

          <div
            role="status"
            aria-live="polite"
            className={`min-h-5 text-sm ${
              feedback === "error" ? "text-red-400" : "text-emerald-300"
            }`}
          >
            {feedback === "success" ? "Gasto criado" : null}
            {feedback === "error" ? NETWORK_ERROR_MESSAGE : null}
          </div>
        </div>
      </form>
    </section>
  );
}
