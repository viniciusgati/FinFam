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
import {
  buildQuickIncomePayload,
  mapQuickIncomeFieldErrors,
  validateQuickIncome,
} from "@/lib/quick-income";
import { cycleSavedElsewhereMessage } from "@/lib/saved-elsewhere";
import CategoryDatalist, {
  CATEGORY_DATALIST_ID,
} from "@/components/CategoryDatalist";

const NETWORK_ERROR_MESSAGE =
  "Não foi possível salvar. Verifique sua conexão e tente novamente.";

type EntryType = "expense" | "income";
type Feedback = "success" | "error" | null;

const FIELD_CLASSES =
  "rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

const TYPE_BUTTON_CLASSES =
  "rounded-md px-3 py-1 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

interface QuickExpenseCardProps {
  categorySuggestions?: string[];
  referenceMonthKey?: string;
  windowStart?: string;
  windowNextStart?: string;
}

export default function QuickExpenseCard({
  categorySuggestions = [],
  referenceMonthKey,
  windowStart,
  windowNextStart,
}: QuickExpenseCardProps) {
  const router = useRouter();
  const [entryType, setEntryType] = useState<EntryType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => todayISO());
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<QuickExpenseErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [successMessage, setSuccessMessage] = useState("Gasto criado");
  const [submitting, setSubmitting] = useState(false);

  const isIncome = entryType === "income";

  function selectEntryType(type: EntryType) {
    if (type === entryType) return;
    setEntryType(type);
    setErrors({});
    setFeedback(null);
  }

  async function submitPayload(
    type: EntryType,
    endpoint: string,
    payload: unknown,
  ) {
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        const mapFieldErrors =
          type === "income"
            ? mapQuickIncomeFieldErrors
            : mapQuickExpenseFieldErrors;
        setErrors(mapFieldErrors(body?.fieldErrors));
        return;
      }

      if (response.status !== 201) {
        setFeedback("error");
        return;
      }

      const saved = await response.json().catch(() => null);
      const savedDate = typeof saved?.date === "string" ? saved.date : date;

      setDescription("");
      setAmount("");
      setDate(todayISO());
      setCategory("");
      setSuccessMessage(
        cycleSavedElsewhereMessage({
          baseMessage: type === "income" ? "Entrada criada" : "Gasto criado",
          savedDate,
          selectedMonthKey: referenceMonthKey ?? todayISO().slice(0, 7),
          windowStart,
          windowNextStart,
        }),
      );
      setFeedback("success");
      router.refresh();
    } catch {
      setFeedback("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const baseInput = { description, amount, date };

    if (entryType === "income") {
      const validation = validateQuickIncome(baseInput);
      setErrors(validation);
      if (Object.keys(validation).length > 0) return;

      const payload = buildQuickIncomePayload(baseInput);
      if (!payload) return;

      await submitPayload("income", "/api/variable-incomes", payload);
      return;
    }

    const input = { ...baseInput, category };
    const validation = validateQuickExpense(input);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const payload = buildQuickExpensePayload(input);
    if (!payload) return;

    await submitPayload("expense", "/api/variable-expenses", payload);
  }

  return (
    <section className="h-full rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        Lançamento rápido
      </h2>

      <div
        role="group"
        aria-label="Tipo de lançamento"
        className="mt-3 inline-flex gap-1 rounded-lg border border-border-strong p-1"
      >
        <button
          type="button"
          aria-pressed={entryType === "expense"}
          onClick={() => selectEntryType("expense")}
          className={`${TYPE_BUTTON_CLASSES} ${
            entryType === "expense"
              ? "bg-emerald-600 text-white focus-visible:ring-emerald-600"
              : "text-foreground-muted hover:bg-surface-raised focus-visible:ring-emerald-600"
          }`}
        >
          Despesa
        </button>
        <button
          type="button"
          aria-pressed={entryType === "income"}
          onClick={() => selectEntryType("income")}
          className={`${TYPE_BUTTON_CLASSES} ${
            entryType === "income"
              ? "bg-sky-600 text-white focus-visible:ring-sky-600"
              : "text-foreground-muted hover:bg-surface-raised focus-visible:ring-sky-600"
          }`}
        >
          Entrada
        </button>
      </div>

      <p className="mt-2 text-sm text-foreground-muted">
        {isIncome
          ? "Registre uma entrada em segundos, sem sair do dashboard."
          : "Registre um gasto em segundos, sem sair do dashboard."}
      </p>
      {!isIncome ? (
        <p className="mt-1 text-xs text-foreground-muted">
          Este lançamento já nasce marcado como pago.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-4">
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

          {!isIncome ? (
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
              Categoria
              <input
                type="text"
                value={category}
                list={CATEGORY_DATALIST_ID}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Ex.: Mercado"
                className={FIELD_CLASSES}
              />
            </label>
          ) : null}
        </div>

        {!isIncome ? (
          <CategoryDatalist suggestions={categorySuggestions} />
        ) : null}

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
            {feedback === "success" ? successMessage : null}
            {feedback === "error" ? NETWORK_ERROR_MESSAGE : null}
          </div>
        </div>
      </form>
    </section>
  );
}
