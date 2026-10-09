"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import MaskedInput from "@/components/MaskedInput";
import { dateMaskToIso, isoToDateMask } from "@/lib/mask";
import { savedElsewhereMessage } from "@/lib/saved-elsewhere";
import { deleteConfirmMessage } from "@/lib/delete-confirm";

export interface VariableIncomeDTO {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  createdAt: string;
}

interface MonthOption {
  value: string;
  label: string;
}

interface ExtraIncomesManagerProps {
  mes: string;
  today: string;
  currentMes: string;
  monthOptions: MonthOption[];
  initialIncomes: VariableIncomeDTO[];
  initialError?: string | null;
}

type FieldErrors = Partial<Record<"description" | "amount" | "date", string>>;

interface FormState {
  description: string;
  amount: string;
  date: string;
}

type Feedback = { type: "success" | "error"; message: string } | null;

function emptyForm(today: string): FormState {
  return { description: "", amount: "", date: isoToDateMask(today) };
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
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
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

function sortIncomes(list: VariableIncomeDTO[]): VariableIncomeDTO[] {
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

/**
 * Seção "Entradas avulsas" da página Entradas: venda de algo, saldo que sobrou
 * etc. Somam à renda do mês da data e ao orçamento do ciclo.
 */
export default function ExtraIncomesManager({
  mes,
  today,
  currentMes,
  monthOptions,
  initialIncomes,
  initialError = null,
}: ExtraIncomesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [incomes, setIncomes] = useState<VariableIncomeDTO[]>(initialIncomes);
  const [form, setForm] = useState<FormState>(() => emptyForm(today));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (feedback?.type !== "success") return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const totalCents = useMemo(
    () => incomes.reduce((sum, income) => sum + income.amountCents, 0),
    [incomes],
  );

  const monthName =
    monthOptions.find((option) => option.value === mes)?.label ?? mes;

  function handleMonthChange(value: string) {
    if (value === mes) return;
    startTransition(() => {
      router.push(
        value === currentMes
          ? "/entradas"
          : `/entradas?mes=${encodeURIComponent(value)}`,
      );
    });
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(isoDate: string | null): FieldErrors {
    const next: FieldErrors = {};
    if (!form.description.trim()) next.description = "Informe uma descrição.";
    if (parseAmountInput(form.amount) === null)
      next.amount = "Informe um valor válido (ex.: 12,34).";
    if (isoDate === null) next.date = "Informe uma data válida.";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isoDate = dateMaskToIso(form.date);
    const validation = validate(isoDate);
    setErrors(validation);
    if (isoDate === null || Object.keys(validation).length > 0) return;

    const payload = {
      description: form.description.trim(),
      amountCents: parseAmountInput(form.amount),
      date: isoDate,
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/variable-incomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        setErrors(mapFieldErrors(body?.fieldErrors));
        setFeedback({ type: "error", message: "Verifique os campos." });
        return;
      }

      if (response.status !== 201) {
        setFeedback({
          type: "error",
          message: "Não foi possível salvar. Tente novamente.",
        });
        return;
      }

      const saved: VariableIncomeDTO = await response.json();
      setIncomes((prev) => {
        const withoutSaved = prev.filter((item) => item.id !== saved.id);
        return sortIncomes(
          isInMonth(saved.date, mes) ? [saved, ...withoutSaved] : withoutSaved,
        );
      });
      setForm(emptyForm(today));
      setFeedback({
        type: "success",
        message: savedElsewhereMessage({
          baseMessage: "Entrada criada",
          savedMonthKey: saved.date.slice(0, 7),
          selectedMonthKey: mes,
        }),
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Não foi possível salvar. Tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(income: VariableIncomeDTO) {
    if (!window.confirm(deleteConfirmMessage(income.description))) {
      return;
    }

    setDeletingId(income.id);
    try {
      const response = await fetch(`/api/variable-incomes/${income.id}`, {
        method: "DELETE",
      });

      if (response.status === 404) {
        setFeedback({
          type: "error",
          message: "Entrada não encontrada. Atualize a lista.",
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

      setIncomes((prev) => prev.filter((item) => item.id !== income.id));
      setFeedback({ type: "success", message: "Entrada excluída" });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Não foi possível excluir. Tente novamente.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">
          Entradas avulsas
        </h2>
        <p className="text-foreground-muted">
          Vendeu algo ou sobrou saldo? Lance aqui: conta como renda do mês da
          data e aumenta o orçamento do ciclo.
        </p>
      </header>

      {initialError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200"
        >
          {initialError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
          Mês
          <select
            value={mes}
            onChange={(event) => handleMonthChange(event.target.value)}
            disabled={isPending}
            aria-busy={isPending}
            className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
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
          className="pb-2 text-sm text-foreground-muted"
        >
          {isPending ? "Carregando…" : ""}
        </span>
      </div>

      <div aria-live="assertive" role="alert" className="min-h-5">
        {feedback?.type === "error" ? (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-sm font-medium text-red-200">
            {feedback.message}
          </p>
        ) : null}
      </div>
      <div aria-live="polite" role="status" className="min-h-5">
        {feedback?.type === "success" ? (
          <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm font-medium text-emerald-200">
            {feedback.message}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 rounded-2xl border border-border bg-surface-raised p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted sm:col-span-2">
            Descrição
            <input
              type="text"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "erro-entrada-description" : undefined
              }
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              placeholder="Ex.: Vendi a bicicleta"
            />
            {errors.description ? (
              <span
                id="erro-entrada-description"
                className="text-xs font-normal text-red-400"
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
              value={form.amount}
              onChange={(event) => updateField("amount", event.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={
                errors.amount ? "erro-entrada-amount" : undefined
              }
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              placeholder="12,34"
            />
            {errors.amount ? (
              <span
                id="erro-entrada-amount"
                className="text-xs font-normal text-red-400"
              >
                {errors.amount}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
            Data
            <MaskedInput
              mask="date"
              value={form.date}
              onChange={(value) => updateField("date", value)}
              aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? "erro-entrada-date" : undefined}
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            />
            {errors.date ? (
              <span
                id="erro-entrada-date"
                className="text-xs font-normal text-red-400"
              >
                {errors.date}
              </span>
            ) : null}
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Salvando..." : "Salvar entrada"}
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground">
            Entradas avulsas do mês
          </h3>
          <p className="text-sm text-foreground-muted">
            Total do mês:{" "}
            <strong className="text-base font-bold tabular-nums text-foreground">
              {formatBRL(totalCents)}
            </strong>
          </p>
        </div>

        {incomes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong bg-surface-raised px-4 py-6 text-center text-foreground-muted">
            {`Nenhuma entrada avulsa em ${monthName}. Lance a primeira.`}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {incomes.map((income) => {
              const busy = deletingId === income.id;
              return (
                <li
                  key={income.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">
                      {income.description}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {formatDate(income.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold text-emerald-300">
                      + {formatBRL(income.amountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(income)}
                      disabled={busy || submitting}
                      aria-busy={busy}
                      className="rounded-lg border border-red-800 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-60"
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
