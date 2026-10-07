"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import MaskedInput from "@/components/MaskedInput";
import { formatCents, parseAmountToCents } from "@/lib/money";

export interface FixedItem {
  id: string;
  name: string;
  amountCents: number;
  receiveDay?: number | null;
  dueDay?: number | null;
  category?: string | null;
  startMonth?: string | null;
  endMonth?: string | null;
  active: boolean;
}

export interface FixedItemsManagerProps {
  endpoint: string;
  title: string;
  dayField: "receiveDay" | "dueDay";
  dayLabel: string;
  dayVerb: string;
  showCategory: boolean;
  emptyMessage: string;
  ctaLabel: string;
  savedMessage: string;
  deactivatedMessage: string;
  reactivatedMessage: string;
  fallbackErrorMessage: string;
  initialItems: FixedItem[];
  initialError?: string | null;
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function sortItems(items: FixedItem[]): FixedItem[] {
  return [...items].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id),
  );
}

function daysOf(item: FixedItem, field: "receiveDay" | "dueDay"): number {
  return (item[field] ?? 1) as number;
}

export default function FixedItemsManager(props: FixedItemsManagerProps) {
  const {
    endpoint,
    title,
    dayField,
    dayLabel,
    dayVerb,
    showCategory,
    emptyMessage,
    ctaLabel,
    savedMessage,
    deactivatedMessage,
    reactivatedMessage,
    fallbackErrorMessage,
    initialItems,
    initialError,
  } = props;

  const [items, setItems] = useState<FixedItem[]>(initialItems);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [category, setCategory] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function showSuccess(message: string) {
    setSuccess(message);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSuccess(null), 3000);
  }

  function resetForm() {
    setName("");
    setAmount("");
    setDay("1");
    setCategory("");
    setStartMonth("");
    setEndMonth("");
    setEditingId(null);
    setFieldErrors({});
  }

  function validateForm(): { errors: Record<string, string>; cents: number | null; dayNumber: number } {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Informe um nome";

    const cents = parseAmountToCents(amount);
    if (cents === null) errors.amount = "Informe um valor maior que zero";

    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
      errors.day = "Dia deve ser entre 1 e 31";
    }

    if (startMonth && !MONTH_REGEX.test(startMonth)) {
      errors.startMonth = "Mês inválido (use AAAA-MM)";
    }
    if (endMonth && !MONTH_REGEX.test(endMonth)) {
      errors.endMonth = "Mês inválido (use AAAA-MM)";
    }
    if (
      startMonth &&
      endMonth &&
      MONTH_REGEX.test(startMonth) &&
      MONTH_REGEX.test(endMonth) &&
      endMonth < startMonth
    ) {
      errors.endMonth = "Mês final não pode ser anterior ao inicial";
    }

    return { errors, cents, dayNumber };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors, cents, dayNumber } = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      amountCents: cents,
      [dayField]: dayNumber,
      startMonth: startMonth || null,
      endMonth: endMonth || null,
    };
    if (showCategory) payload.category = category.trim() || null;

    const editing = editingId;
    const target = editing ? `${endpoint}/${editing}` : endpoint;
    const method = editing ? "PATCH" : "POST";

    try {
      const response = await fetch(target, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as
        | (FixedItem & { error?: string })
        | { error?: string };

      if (!response.ok) {
        setError(
          "error" in data && data.error ? data.error : fallbackErrorMessage,
        );
        return;
      }

      const saved = data as FixedItem;
      setItems((previous) =>
        editing
          ? previous.map((item) => (item.id === editing ? saved : item))
          : sortItems([...previous, saved]),
      );
      resetForm();
      showSuccess(savedMessage);
    } catch {
      setError(fallbackErrorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: FixedItem) {
    setBusyId(item.id);
    setError(null);
    const nextActive = !item.active;

    try {
      const response = await fetch(`${endpoint}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? fallbackErrorMessage);
        return;
      }

      setItems((previous) =>
        previous.map((current) =>
          current.id === item.id ? { ...current, active: nextActive } : current,
        ),
      );
      showSuccess(nextActive ? reactivatedMessage : deactivatedMessage);
    } catch {
      setError(fallbackErrorMessage);
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(item: FixedItem) {
    setEditingId(item.id);
    setName(item.name);
    setAmount((item.amountCents / 100).toFixed(2).replace(".", ","));
    setDay(String(daysOf(item, dayField)));
    setCategory(item.category ?? "");
    setStartMonth(item.startMonth ?? "");
    setEndMonth(item.endMonth ?? "");
    setFieldErrors({});
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameInputRef.current?.focus();
  }

  const disabled = saving || busyId !== null;

  return (
    <div className="space-y-8">
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {success}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={focusForm}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              {ctaLabel}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="text-slate-600">{emptyMessage}</p>
            <button
              type="button"
              onClick={focusForm}
              className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              {ctaLabel}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    <span className="truncate">{item.name}</span>
                    {!item.active && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        inativa
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatCents(item.amountCents)} · {dayVerb} dia{" "}
                    {daysOf(item, dayField)}
                    {showCategory && item.category ? ` · ${item.category}` : ""}
                  </p>
                  {(item.startMonth || item.endMonth) && (
                    <p className="text-xs text-slate-400">
                      Vigência: {item.startMonth ?? "início"} →{" "}
                      {item.endMonth ?? "sem fim"}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={disabled}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(item)}
                    disabled={disabled}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                      item.active
                        ? "border border-red-200 text-red-700 hover:bg-red-50"
                        : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {busyId === item.id
                      ? item.active
                        ? "Desativando…"
                        : "Reativando…"
                      : item.active
                        ? "Desativar"
                        : "Reativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {editingId ? "Editar item" : ctaLabel}
        </h2>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Nome</span>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={disabled}
              className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                fieldErrors.name ? "border-red-500" : "border-slate-300"
              }`}
            />
            {fieldErrors.name && (
              <span className="text-sm text-red-600">{fieldErrors.name}</span>
            )}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Valor (R$)
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1.234,56"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  fieldErrors.amount ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.amount && (
                <span className="text-sm text-red-600">{fieldErrors.amount}</span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                {dayLabel}
              </span>
              <input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(event) => setDay(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  fieldErrors.day ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.day && (
                <span className="text-sm text-red-600">{fieldErrors.day}</span>
              )}
            </label>
          </div>

          {showCategory && (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Categoria (opcional)
              </span>
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={disabled}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50"
              />
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Início da vigência (opcional)
              </span>
              <MaskedInput
                mask="month"
                placeholder="AAAA-MM"
                value={startMonth}
                onChange={setStartMonth}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  fieldErrors.startMonth ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.startMonth && (
                <span className="text-sm text-red-600">
                  {fieldErrors.startMonth}
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Fim da vigência (opcional)
              </span>
              <MaskedInput
                mask="month"
                placeholder="AAAA-MM"
                value={endMonth}
                onChange={setEndMonth}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  fieldErrors.endMonth ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.endMonth && (
                <span className="text-sm text-red-600">{fieldErrors.endMonth}</span>
              )}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={disabled}
              className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Salvando…" : editingId ? "Salvar alterações" : ctaLabel}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={disabled}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
