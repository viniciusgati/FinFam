"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import type { PaymentMethod } from "@/lib/variable-expenses";
import MaskedInput from "@/components/MaskedInput";
import { dateMaskToIso, isoToDateMask } from "@/lib/mask";

export interface ExpenseDTO {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  category: string | null;
  paymentMethod: PaymentMethod;
  paid: boolean;
  creditCardId: string | null;
  createdAt: string;
}

interface MonthOption {
  value: string;
  label: string;
}

interface GastosManagerProps {
  mes: string;
  today: string;
  currentMes: string;
  monthOptions: MonthOption[];
  initialExpenses: ExpenseDTO[];
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  DEBIT: "Débito",
  PIX: "PIX",
  CREDIT: "Crédito",
};

type FieldErrors = Partial<Record<"description" | "amount" | "date", string>>;

interface FormState {
  description: string;
  amount: string;
  date: string;
  category: string;
  paymentMethod: PaymentMethod;
  paid: boolean;
}

type Feedback = { type: "success" | "error"; message: string } | null;

function emptyForm(today: string): FormState {
  return {
    description: "",
    amount: "",
    date: isoToDateMask(today),
    category: "",
    paymentMethod: "PIX",
    paid: true,
  };
}

/** Converte a entrada em reais (ex.: "12,34") para centavos (1234). */
function parseAmountInput(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Converte centavos (1234) para a entrada em reais ("12,34"). */
function formatAmountInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function isInMonth(iso: string, mes: string): boolean {
  return iso.slice(0, 7) === mes;
}

function sortExpenses(list: ExpenseDTO[]): ExpenseDTO[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function mapFieldErrors(raw: unknown): FieldErrors {
  const fieldErrors = (raw ?? {}) as Record<string, string[] | undefined>;
  const next: FieldErrors = {};
  if (fieldErrors.description) next.description = "Informe uma descrição.";
  if (fieldErrors.amountCents) next.amount = "Informe um valor válido.";
  if (fieldErrors.date) next.date = "Informe uma data válida.";
  return next;
}

export default function GastosManager({
  mes,
  today,
  currentMes,
  monthOptions,
  initialExpenses,
}: GastosManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expenses, setExpenses] = useState<ExpenseDTO[]>(initialExpenses);
  const [form, setForm] = useState<FormState>(() => emptyForm(today));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (feedback?.type !== "success") return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const totalCents = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    [expenses],
  );

  function handleMonthChange(value: string) {
    if (value === mes) return;
    startTransition(() => {
      router.push(
        value === currentMes ? "/gastos" : `/gastos?mes=${encodeURIComponent(value)}`,
      );
    });
  }

  function validate(isoDate: string | null): FieldErrors {
    const next: FieldErrors = {};
    if (!form.description.trim()) next.description = "Informe uma descrição.";
    if (parseAmountInput(form.amount) === null)
      next.amount = "Informe um valor válido (ex.: 12,34).";
    if (isoDate === null) next.date = "Informe uma data válida.";
    return next;
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm(today));
    setErrors({});
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editing = editingId !== null;
    const isoDate = dateMaskToIso(form.date);
    const validation = validate(isoDate);
    setErrors(validation);
    if (isoDate === null || Object.keys(validation).length > 0) {
      setFeedback({
        type: "error",
        message: editing
          ? "Não foi possível salvar as alterações."
          : "Não foi possível salvar. Verifique os campos.",
      });
      return;
    }

    const payload = {
      description: form.description.trim(),
      amountCents: parseAmountInput(form.amount),
      date: isoDate,
      category: form.category.trim() ? form.category.trim() : undefined,
      paymentMethod: form.paymentMethod,
      paid: form.paid,
    };

    setSubmitting(true);
    try {
      const response = await fetch(
        editing ? `/api/variable-expenses/${editingId}` : "/api/variable-expenses",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        setErrors(mapFieldErrors(body?.fieldErrors));
        setFeedback({
          type: "error",
          message: editing
            ? "Não foi possível salvar as alterações."
            : "Não foi possível salvar. Verifique os campos.",
        });
        return;
      }

      if (response.status === 404) {
        setFeedback({
          type: "error",
          message: "Gasto não encontrado. Atualize a lista.",
        });
        return;
      }

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: editing
            ? "Não foi possível salvar as alterações."
            : "Não foi possível salvar. Verifique os campos.",
        });
        return;
      }

      const saved: ExpenseDTO = await response.json();
      setExpenses((prev) => {
        const withoutSaved = prev.filter((item) => item.id !== saved.id);
        return sortExpenses(
          isInMonth(saved.date, mes) ? [saved, ...withoutSaved] : withoutSaved,
        );
      });
      resetForm();
      setFeedback({
        type: "success",
        message: editing ? "Alterações salvas" : "Gasto criado",
      });
    } catch {
      setFeedback({
        type: "error",
        message: editing
          ? "Não foi possível salvar as alterações."
          : "Não foi possível salvar. Verifique os campos.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(expense: ExpenseDTO) {
    setEditingId(expense.id);
    setErrors({});
    setFeedback(null);
    setForm({
      description: expense.description,
      amount: formatAmountInput(expense.amountCents),
      date: isoToDateMask(expense.date),
      category: expense.category ?? "",
      paymentMethod: expense.paymentMethod,
      paid: expense.paid,
    });
  }

  function handleCancelEdit() {
    resetForm();
    setFeedback(null);
  }

  async function handleDelete(expense: ExpenseDTO) {
    setDeletingId(expense.id);
    try {
      const response = await fetch(`/api/variable-expenses/${expense.id}`, {
        method: "DELETE",
      });

      if (response.status === 404) {
        setFeedback({
          type: "error",
          message: "Gasto não encontrado. Atualize a lista.",
        });
        return;
      }

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: "Não foi possível excluir. Tente novamente.",
        });
        return;
      }

      setExpenses((prev) => prev.filter((item) => item.id !== expense.id));
      if (editingId === expense.id) resetForm();
      setFeedback({ type: "success", message: "Gasto excluído" });
    } catch {
      setFeedback({
        type: "error",
        message: "Não foi possível excluir. Tente novamente.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const editing = editingId !== null;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Gastos avulsos</h1>
        <p className="text-slate-600">
          Lance um gasto em poucos segundos e veja o total do mês.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Mês
          <select
            value={mes}
            onChange={(event) => handleMonthChange(event.target.value)}
            disabled={isPending}
            aria-busy={isPending}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span
          role="status"
          aria-live="polite"
          aria-busy={isPending}
          className="pb-2 text-sm text-slate-600"
        >
          {isPending ? "Carregando…" : ""}
        </span>
      </div>

      <div aria-live="assertive" role="alert" className="min-h-5">
        {feedback?.type === "error" ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {feedback.message}
          </p>
        ) : null}
      </div>
      <div aria-live="polite" role="status" className="min-h-5">
        {feedback?.type === "success" ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {feedback.message}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Descrição
            <input
              type="text"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "erro-description" : undefined}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              placeholder="Ex.: Mercado do mês"
            />
            {errors.description ? (
              <span id="erro-description" className="text-xs font-normal text-red-600">
                {errors.description}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Valor (R$)
            <input
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => updateField("amount", event.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "erro-amount" : undefined}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              placeholder="12,34"
            />
            {errors.amount ? (
              <span id="erro-amount" className="text-xs font-normal text-red-600">
                {errors.amount}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Data
            <MaskedInput
              mask="date"
              value={form.date}
              onChange={(value) => updateField("date", value)}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? "erro-date" : undefined}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            />
            {errors.date ? (
              <span id="erro-date" className="text-xs font-normal text-red-600">
                {errors.date}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Categoria (opcional)
            <input
              type="text"
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              placeholder="Ex.: Alimentação"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Forma de pagamento
            <select
              value={form.paymentMethod}
              onChange={(event) =>
                updateField("paymentMethod", event.target.value as PaymentMethod)
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_LABELS[method]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(event) => updateField("paid", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            />
            Pago
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {submitting ? "Salvando..." : "Salvar"}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              Cancelar
            </button>
          ) : null}
          {editing ? (
            <span className="text-sm text-slate-500">Editando um gasto…</span>
          ) : null}
        </div>
      </form>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Gastos do mês</h2>
          <p className="text-sm text-slate-700">
            Total do mês:{" "}
            <strong className="text-base font-bold tabular-nums text-slate-900">
              {formatBRL(totalCents)}
            </strong>
          </p>
        </div>

        {expenses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-slate-600">
            {`Nenhum gasto em ${monthOptions.find((option) => option.value === mes)?.label ?? mes}. Lance o primeiro.`}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {expenses.map((expense) => {
              const onCredit = expense.paymentMethod === "CREDIT";
              const busy = deletingId === expense.id;
              return (
                <li
                  key={expense.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-slate-900">
                      {expense.description}
                      {onCredit ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Cartão — não conta no orçamento
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatDate(expense.date)} ·{" "}
                      {PAYMENT_LABELS[expense.paymentMethod]}
                      {expense.category ? ` · ${expense.category}` : ""} ·{" "}
                      {expense.paid ? "Pago" : "Em aberto"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold text-slate-900">
                      {formatBRL(expense.amountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEdit(expense)}
                      disabled={busy || submitting}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(expense)}
                      disabled={busy || submitting}
                      aria-busy={busy}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {busy ? "Excluindo..." : "Excluir"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
