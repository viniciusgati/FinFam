"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  invoiceLinesForMonth,
  type CardPurchaseRecord,
} from "@/lib/invoices";
import { formatCents, parseAmountToCents } from "@/lib/money";
import MaskedInput from "@/components/MaskedInput";
import { dateMaskToIso, isoToDateMask } from "@/lib/mask";

export interface CreditCardData {
  id: string;
  name: string;
  limitCents: number | null;
  closingDay: number;
  dueDay: number;
  active: boolean;
}

export interface CardPurchaseData {
  id: string;
  cardId: string;
  description: string;
  amountCents: number;
  purchaseDate: string | Date;
  category: string | null;
  installmentNumber: number;
  installmentsTotal: number;
  card?: {
    id: string;
    name: string;
    closingDay: number;
    dueDay: number;
  } | null;
}

export interface CreditCardsManagerProps {
  initialCards: CreditCardData[];
  initialPurchases: CardPurchaseData[];
  referenceMonthKey: string;
  initialError?: string | null;
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function sortCards(cards: CreditCardData[]): CreditCardData[] {
  return [...cards].sort(
    (a, b) =>
      a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id),
  );
}

function sortPurchases(purchases: CardPurchaseData[]): CardPurchaseData[] {
  return [...purchases].sort((a, b) => {
    const left = new Date(a.purchaseDate).getTime();
    const right = new Date(b.purchaseDate).getTime();
    return left - right || a.id.localeCompare(b.id);
  });
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = total - nextYear * 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]}/${year}`;
}

function toDateInput(value: string | Date): string {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CreditCardsManager(props: CreditCardsManagerProps) {
  const { initialCards, initialPurchases, referenceMonthKey, initialError } =
    props;

  const [cards, setCards] = useState<CreditCardData[]>(() =>
    sortCards(initialCards),
  );
  const [purchases, setPurchases] = useState<CardPurchaseData[]>(() =>
    sortPurchases(initialPurchases),
  );
  const [referenceMonth, setReferenceMonth] = useState(referenceMonthKey);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(
    initialError ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [closingDay, setClosingDay] = useState("1");
  const [dueDay, setDueDay] = useState("1");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [cardError, setCardError] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);

  const [purchaseCardId, setPurchaseCardId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [category, setCategory] = useState("");
  const [installmentNumber, setInstallmentNumber] = useState("1");
  const [installmentsTotal, setInstallmentsTotal] = useState("1");
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(
    null,
  );
  const [purchaseErrors, setPurchaseErrors] = useState<Record<string, string>>(
    {},
  );
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [savingPurchase, setSavingPurchase] = useState(false);

  const cardFormRef = useRef<HTMLFormElement>(null);
  const cardNameInputRef = useRef<HTMLInputElement>(null);
  const purchaseFormRef = useRef<HTMLFormElement>(null);
  const purchaseDescInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const cardsById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );

  const invoice = useMemo(() => {
    const records: CardPurchaseRecord[] = [];
    for (const purchase of purchases) {
      const card = purchase.card ?? cardsById.get(purchase.cardId);
      if (!card) continue;
      records.push({
        id: purchase.id,
        description: purchase.description,
        category: purchase.category,
        amountCents: purchase.amountCents,
        purchaseDate: new Date(purchase.purchaseDate),
        installmentsTotal: purchase.installmentsTotal,
        card: {
          id: card.id,
          name: card.name,
          closingDay: card.closingDay,
          dueDay: card.dueDay,
        },
      });
    }
    return invoiceLinesForMonth(records, referenceMonth);
  }, [purchases, cardsById, referenceMonth]);

  const referenceLabel = monthLabel(referenceMonth);

  function showSuccess(message: string) {
    setSuccess(message);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSuccess(null), 3000);
  }

  function resetCardForm() {
    setCardName("");
    setCardLimit("");
    setClosingDay("1");
    setDueDay("1");
    setEditingCardId(null);
    setCardErrors({});
    setCardError(null);
  }

  function resetPurchaseForm() {
    setPurchaseCardId("");
    setDescription("");
    setAmount("");
    setPurchaseDate("");
    setCategory("");
    setInstallmentNumber("1");
    setInstallmentsTotal("1");
    setEditingPurchaseId(null);
    setPurchaseErrors({});
    setPurchaseError(null);
  }

  function focusCardForm() {
    cardFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    cardNameInputRef.current?.focus();
  }

  function focusPurchaseForm() {
    purchaseFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    purchaseDescInputRef.current?.focus();
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [cardsResponse, purchasesResponse] = await Promise.all([
        fetch("/api/credit-cards"),
        fetch("/api/card-purchases"),
      ]);
      if (!cardsResponse.ok || !purchasesResponse.ok) {
        throw new Error("Falha ao carregar");
      }
      const [cardsData, purchasesData] = (await Promise.all([
        cardsResponse.json(),
        purchasesResponse.json(),
      ])) as [CreditCardData[], CardPurchaseData[]];
      setCards(sortCards(cardsData));
      setPurchases(sortPurchases(purchasesData));
      setLoadError(null);
    } catch {
      setLoadError("Não foi possível carregar cartões e compras. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function validateCardForm(): { errors: Record<string, string>; limit: number | null } {
    const errors: Record<string, string> = {};

    if (!cardName.trim()) errors.name = "Informe um nome";

    let limit: number | null = null;
    if (cardLimit.trim()) {
      limit = parseAmountToCents(cardLimit);
      if (limit === null) errors.limit = "Informe um valor maior que zero";
    }

    const closing = Number(closingDay);
    if (!Number.isInteger(closing) || closing < 1 || closing > 31) {
      errors.closingDay = "Dia deve ser entre 1 e 31";
    }
    const due = Number(dueDay);
    if (!Number.isInteger(due) || due < 1 || due > 31) {
      errors.dueDay = "Dia deve ser entre 1 e 31";
    }

    return { errors, limit };
  }

  async function handleCardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors, limit } = validateCardForm();
    if (Object.keys(errors).length > 0) {
      setCardErrors(errors);
      return;
    }

    setCardErrors({});
    setCardError(null);
    setSavingCard(true);

    const payload = {
      name: cardName.trim(),
      limitCents: limit,
      closingDay: Number(closingDay),
      dueDay: Number(dueDay),
    };

    const editing = editingCardId;
    const target = editing ? `/api/credit-cards/${editing}` : "/api/credit-cards";
    const method = editing ? "PATCH" : "POST";

    try {
      const response = await fetch(target, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as
        | (CreditCardData & { error?: string })
        | { error?: string };

      if (!response.ok) {
        setCardError(
          "error" in data && data.error
            ? data.error
            : "Não foi possível salvar o cartão. Tente novamente.",
        );
        return;
      }

      const saved = data as CreditCardData;
      setCards((previous) =>
        sortCards(
          editing
            ? previous.map((card) => (card.id === editing ? saved : card))
            : [...previous, saved],
        ),
      );
      resetCardForm();
      showSuccess("Cartão salvo.");
    } catch {
      setCardError("Não foi possível salvar o cartão. Tente novamente.");
    } finally {
      setSavingCard(false);
    }
  }

  async function toggleCardActive(card: CreditCardData) {
    setBusyId(card.id);
    setError(null);
    const nextActive = !card.active;

    try {
      const response = await fetch(`/api/credit-cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });

      if (!response.ok) {
        setError("Não foi possível atualizar o cartão. Tente novamente.");
        return;
      }

      setCards((previous) =>
        previous.map((current) =>
          current.id === card.id ? { ...current, active: nextActive } : current,
        ),
      );
      showSuccess(nextActive ? "Cartão reativado." : "Cartão desativado.");
    } catch {
      setError("Não foi possível atualizar o cartão. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  function startEditCard(card: CreditCardData) {
    setEditingCardId(card.id);
    setCardName(card.name);
    setCardLimit(
      card.limitCents === null
        ? ""
        : (card.limitCents / 100).toFixed(2).replace(".", ","),
    );
    setClosingDay(String(card.closingDay));
    setDueDay(String(card.dueDay));
    setCardErrors({});
    setCardError(null);
    focusCardForm();
  }

  function validatePurchaseForm(isoDate: string | null): {
    errors: Record<string, string>;
    cents: number | null;
  } {
    const errors: Record<string, string> = {};

    if (!purchaseCardId) errors.cardId = "Selecione um cartão";
    if (!description.trim()) errors.description = "Informe uma descrição";

    const cents = parseAmountToCents(amount);
    if (cents === null) errors.amount = "Informe um valor maior que zero";

    if (isoDate === null) errors.purchaseDate = "Informe a data da compra";

    const number = Number(installmentNumber);
    if (!Number.isInteger(number) || number < 1) {
      errors.installmentNumber = "A parcela deve ser pelo menos 1";
    }
    const total = Number(installmentsTotal);
    if (!Number.isInteger(total) || total < 1) {
      errors.installmentsTotal = "O total de parcelas deve ser pelo menos 1";
    }
    if (
      !errors.installmentNumber &&
      !errors.installmentsTotal &&
      number > total
    ) {
      errors.installmentNumber =
        "A parcela não pode ser maior que o total de parcelas";
    }

    return { errors, cents };
  }

  async function handlePurchaseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const isoDate = dateMaskToIso(purchaseDate);
    const { errors, cents } = validatePurchaseForm(isoDate);
    if (isoDate === null || Object.keys(errors).length > 0) {
      setPurchaseErrors(errors);
      return;
    }

    setPurchaseErrors({});
    setPurchaseError(null);
    setSavingPurchase(true);

    const payload = {
      cardId: purchaseCardId,
      description: description.trim(),
      amountCents: cents,
      purchaseDate: `${isoDate}T00:00:00`,
      category: category.trim() || null,
      installmentNumber: Number(installmentNumber),
      installmentsTotal: Number(installmentsTotal),
    };

    const editing = editingPurchaseId;
    const target = editing
      ? `/api/card-purchases/${editing}`
      : "/api/card-purchases";
    const method = editing ? "PATCH" : "POST";

    try {
      const response = await fetch(target, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as
        | (CardPurchaseData & { error?: string })
        | { error?: string };

      if (!response.ok) {
        setPurchaseError(
          "error" in data && data.error
            ? data.error
            : "Não foi possível salvar a compra. Tente novamente.",
        );
        return;
      }

      const saved = data as CardPurchaseData;
      setPurchases((previous) =>
        sortPurchases(
          editing
            ? previous.map((purchase) =>
                purchase.id === editing ? saved : purchase,
              )
            : [...previous, saved],
        ),
      );
      resetPurchaseForm();
      showSuccess("Compra salva.");
    } catch {
      setPurchaseError("Não foi possível salvar a compra. Tente novamente.");
    } finally {
      setSavingPurchase(false);
    }
  }

  function startEditPurchase(purchase: CardPurchaseData) {
    setEditingPurchaseId(purchase.id);
    setPurchaseCardId(purchase.cardId);
    setDescription(purchase.description);
    setAmount((purchase.amountCents / 100).toFixed(2).replace(".", ","));
    setPurchaseDate(isoToDateMask(toDateInput(purchase.purchaseDate)));
    setCategory(purchase.category ?? "");
    setInstallmentNumber(String(purchase.installmentNumber));
    setInstallmentsTotal(String(purchase.installmentsTotal));
    setPurchaseErrors({});
    setPurchaseError(null);
    focusPurchaseForm();
  }

  async function deletePurchase(purchase: CardPurchaseData) {
    if (
      !window.confirm(
        "Excluir esta compra? As parcelas deixam de aparecer na fatura.",
      )
    ) {
      return;
    }

    setBusyId(purchase.id);
    setError(null);

    try {
      const response = await fetch(`/api/card-purchases/${purchase.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError("Não foi possível excluir a compra. Tente novamente.");
        return;
      }

      setPurchases((previous) =>
        previous.filter((current) => current.id !== purchase.id),
      );
      if (editingPurchaseId === purchase.id) resetPurchaseForm();
      showSuccess("Compra excluída.");
    } catch {
      setError("Não foi possível excluir a compra. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  function navigateMonth(delta: number) {
    const next = shiftMonth(referenceMonth, delta);
    setReferenceMonth(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("mes", next);
      window.history.replaceState(null, "", url.toString());
    }
  }

  const disabled = savingCard || savingPurchase || busyId !== null || loading;

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

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Fatura de {referenceLabel}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Mês anterior
            </button>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Próximo mês
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Carregando…</p>
        ) : invoice.lines.length === 0 ? (
          <p className="mt-4 text-slate-600">
            Nenhuma parcela cai em {referenceLabel}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {invoice.lines.map((line) => (
              <li
                key={`${line.purchaseId}-${line.installmentNumber}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {line.description}
                  </p>
                  <p className="text-sm text-slate-500">
                    parcela {line.installmentNumber}/{line.installmentsTotal} ·{" "}
                    {line.cardName}
                    {line.category ? ` · ${line.category}` : ""}
                  </p>
                </div>
                <span className="font-semibold text-slate-900">
                  {formatCents(line.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-base">
          <span className="font-medium text-slate-600">Total do mês</span>
          <span className="text-xl font-bold text-slate-900">
            {formatCents(invoice.totalCents)}
          </span>
        </p>
      </section>

      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Cartões</h2>
          {cards.length > 0 && (
            <button
              type="button"
              onClick={focusCardForm}
              disabled={disabled}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              Cadastrar cartão
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="font-medium text-slate-700">
              Nenhum cartão cadastrado ainda
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre um cartão para lançar compras e ver a fatura
            </p>
            <button
              type="button"
              onClick={focusCardForm}
              disabled={disabled}
              className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              Cadastrar cartão
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="flex items-center gap-2 font-medium text-slate-900">
                    <span className="truncate">{card.name}</span>
                    {!card.active && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        inativo
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
                    Fechamento dia {card.closingDay} · Vencimento dia{" "}
                    {card.dueDay}
                    {card.limitCents !== null
                      ? ` · Limite ${formatCents(card.limitCents)}`
                      : " · Sem limite"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEditCard(card)}
                    disabled={disabled}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCardActive(card)}
                    disabled={disabled}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${
                      card.active
                        ? "border border-red-200 text-red-700 hover:bg-red-50"
                        : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {busyId === card.id
                      ? card.active
                        ? "Desativando…"
                        : "Reativando…"
                      : card.active
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
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          {editingCardId ? "Editar cartão" : "Cadastrar cartão"}
        </h3>

        {cardError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {cardError}
          </p>
        )}

        <form
          ref={cardFormRef}
          onSubmit={handleCardSubmit}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Nome</span>
              <input
                ref={cardNameInputRef}
                type="text"
                value={cardName}
                onChange={(event) => setCardName(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  cardErrors.name ? "border-red-500" : "border-slate-300"
                }`}
              />
              {cardErrors.name && (
                <span className="text-sm text-red-600">{cardErrors.name}</span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Limite (R$, opcional)
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1.234,56"
                value={cardLimit}
                onChange={(event) => setCardLimit(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  cardErrors.limit ? "border-red-500" : "border-slate-300"
                }`}
              />
              {cardErrors.limit && (
                <span className="text-sm text-red-600">{cardErrors.limit}</span>
              )}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Dia de fechamento
              </span>
              <input
                type="number"
                min={1}
                max={31}
                value={closingDay}
                onChange={(event) => setClosingDay(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  cardErrors.closingDay ? "border-red-500" : "border-slate-300"
                }`}
              />
              {cardErrors.closingDay && (
                <span className="text-sm text-red-600">
                  {cardErrors.closingDay}
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Dia de vencimento
              </span>
              <input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  cardErrors.dueDay ? "border-red-500" : "border-slate-300"
                }`}
              />
              {cardErrors.dueDay && (
                <span className="text-sm text-red-600">{cardErrors.dueDay}</span>
              )}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={disabled}
              className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingCard
                ? "Salvando…"
                : editingCardId
                  ? "Salvar alterações"
                  : "Cadastrar cartão"}
            </button>
            {editingCardId && (
              <button
                type="button"
                onClick={resetCardForm}
                disabled={disabled}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Compras</h2>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando…</p>
        ) : purchases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="font-medium text-slate-700">Nenhuma compra lançada</p>
            <button
              type="button"
              onClick={focusPurchaseForm}
              disabled={disabled}
              className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              Lançar compra
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {purchases.map((purchase) => {
              const card = purchase.card ?? cardsById.get(purchase.cardId);
              return (
                <li
                  key={purchase.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium text-slate-900">
                      {purchase.description}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatCents(purchase.amountCents)} ·{" "}
                      {toDateInput(purchase.purchaseDate)} ·{" "}
                      parcela {purchase.installmentNumber}/
                      {purchase.installmentsTotal}
                      {card ? ` · ${card.name}` : ""}
                      {purchase.category ? ` · ${purchase.category}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEditPurchase(purchase)}
                      disabled={disabled}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePurchase(purchase)}
                      disabled={disabled}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {busyId === purchase.id ? "Excluindo…" : "Excluir"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          {editingPurchaseId ? "Editar compra" : "Lançar compra"}
        </h3>

        {purchaseError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {purchaseError}
          </p>
        )}

        <form
          ref={purchaseFormRef}
          onSubmit={handlePurchaseSubmit}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Cartão</span>
              <select
                value={purchaseCardId}
                onChange={(event) => setPurchaseCardId(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  purchaseErrors.cardId ? "border-red-500" : "border-slate-300"
                }`}
              >
                <option value="">Selecione um cartão</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                    {card.active ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
              {purchaseErrors.cardId && (
                <span className="text-sm text-red-600">
                  {purchaseErrors.cardId}
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Descrição
              </span>
              <input
                ref={purchaseDescInputRef}
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  purchaseErrors.description
                    ? "border-red-500"
                    : "border-slate-300"
                }`}
              />
              {purchaseErrors.description && (
                <span className="text-sm text-red-600">
                  {purchaseErrors.description}
                </span>
              )}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Valor total (R$)
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="1.234,56"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  purchaseErrors.amount ? "border-red-500" : "border-slate-300"
                }`}
              />
              {purchaseErrors.amount && (
                <span className="text-sm text-red-600">
                  {purchaseErrors.amount}
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Data</span>
              <MaskedInput
                mask="date"
                value={purchaseDate}
                onChange={setPurchaseDate}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  purchaseErrors.purchaseDate
                    ? "border-red-500"
                    : "border-slate-300"
                }`}
              />
              {purchaseErrors.purchaseDate && (
                <span className="text-sm text-red-600">
                  {purchaseErrors.purchaseDate}
                </span>
              )}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Parcela (nº)
              </span>
              <input
                type="number"
                min={1}
                value={installmentNumber}
                onChange={(event) => setInstallmentNumber(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  purchaseErrors.installmentNumber
                    ? "border-red-500"
                    : "border-slate-300"
                }`}
              />
              {purchaseErrors.installmentNumber && (
                <span className="text-sm text-red-600">
                  {purchaseErrors.installmentNumber}
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Total de parcelas
              </span>
              <input
                type="number"
                min={1}
                value={installmentsTotal}
                onChange={(event) => setInstallmentsTotal(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 disabled:bg-slate-50 ${
                  purchaseErrors.installmentsTotal
                    ? "border-red-500"
                    : "border-slate-300"
                }`}
              />
              {purchaseErrors.installmentsTotal && (
                <span className="text-sm text-red-600">
                  {purchaseErrors.installmentsTotal}
                </span>
              )}
            </label>

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
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={disabled}
              className="rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingPurchase
                ? "Salvando…"
                : editingPurchaseId
                  ? "Salvar alterações"
                  : "Lançar compra"}
            </button>
            {editingPurchaseId && (
              <button
                type="button"
                onClick={resetPurchaseForm}
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
