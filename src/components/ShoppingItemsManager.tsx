"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { deleteConfirmMessage } from "@/lib/delete-confirm";
import { formatCents } from "@/lib/money";
import {
  ageLabel,
  daysOnList,
  isStaleDesirable,
  parsePriceToCents,
  sortShoppingItems,
  type ShoppingItem,
  type ShoppingItemKind,
} from "@/lib/shopping-list";

export interface ShoppingItemsManagerProps {
  initialItems: ShoppingItem[];
  /** "Hoje" no fuso da família, `YYYY-MM-DD`; injetado pela página. */
  today: string;
}

type FieldErrors = Partial<
  Record<"name" | "kind" | "quantity" | "price", string>
>;

type Feedback = { type: "success" | "error"; message: string } | null;

interface FormState {
  name: string;
  kind: ShoppingItemKind | "";
  quantity: string;
  category: string;
  price: string;
}

interface PriceResponse {
  updated?: boolean;
  item?: ShoppingItem;
}

const KIND_LABELS: Record<ShoppingItemKind, string> = {
  ESSENCIAL: "Essencial",
  DESEJAVEL: "Desejável",
};

const EMPTY_FORM: FormState = {
  name: "",
  kind: "",
  quantity: "1",
  category: "",
  price: "",
};

const VALIDATION_MESSAGES = {
  name: "Informe um nome",
  quantity: "Informe uma quantidade entre 1 e 999",
  kind: "Escolha essencial ou desejável",
  price: "Informe um preço válido",
} as const;

const ADD_SUCCESS_MESSAGE = "Item adicionado à lista.";
const ADD_ERROR_MESSAGE =
  "Não foi possível adicionar o item. Tente novamente.";
const PRICE_EMPTY_MESSAGE = "Não encontramos preços para este item.";
const PRICE_UNAVAILABLE_MESSAGE =
  "Pesquisa de preço indisponível. Informe o preço manualmente ou configure a integração.";
const PRICE_ERROR_MESSAGE =
  "Não foi possível pesquisar o preço agora. Tente novamente.";
const PURCHASED_SUCCESS_MESSAGE = "Item marcado como comprado.";
const PURCHASED_ERROR_MESSAGE =
  "Não foi possível marcar o item como comprado. Tente novamente.";
const DELETE_SUCCESS_MESSAGE = "Item excluído.";
const DELETE_ERROR_MESSAGE =
  "Não foi possível excluir o item. Tente novamente.";
const PRICE_SAVE_ERROR_MESSAGE =
  "Não foi possível salvar o preço. Tente novamente.";
const EMPTY_LIST_MESSAGE =
  "Sua lista de compras está vazia. Adicione o primeiro item no formulário acima.";

const SUCCESS_FEEDBACK_MS = 3000;

function parseQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const quantity = Number(trimmed);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    return null;
  }
  return quantity;
}

function priceLineTotal(item: ShoppingItem): number | null {
  const unit = item.estimatedUnitPriceCents;
  if (unit === null || unit === undefined || unit <= 0) return null;
  const quantity =
    Number.isFinite(item.quantity) && item.quantity > 0
      ? Math.trunc(item.quantity)
      : 1;
  return Math.round(unit) * quantity;
}

function centsToPriceInput(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0) return "";
  return (Math.round(value) / 100).toFixed(2).replace(".", ",");
}

/**
 * Tela `/compras`: formulário de cadastro e lista ativa ordenada (essenciais
 * primeiro, do mais antigo para o mais novo), com pesquisa de preço sob
 * demanda, preço manual editável por item, marcação de compra e exclusão. O
 * preço anterior é sempre preservado quando a pesquisa falha ou não encontra
 * amostras válidas.
 */
export default function ShoppingItemsManager({
  initialItems,
  today,
}: ShoppingItemsManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<ShoppingItem[]>(() =>
    sortShoppingItems(initialItems),
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [priceEditorId, setPriceEditorId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);

  useEffect(() => {
    if (feedback?.type !== "success") return;
    const timer = setTimeout(() => setFeedback(null), SUCCESS_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const activeItems = useMemo(() => sortShoppingItems(items), [items]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): {
    fieldErrors: FieldErrors;
    quantity: number | null;
    priceCents: number | null;
  } {
    const fieldErrors: FieldErrors = {};

    if (!form.name.trim()) fieldErrors.name = VALIDATION_MESSAGES.name;
    if (!form.kind) fieldErrors.kind = VALIDATION_MESSAGES.kind;

    const quantity = parseQuantity(form.quantity);
    if (quantity === null) fieldErrors.quantity = VALIDATION_MESSAGES.quantity;

    let priceCents: number | null = null;
    if (form.price.trim()) {
      priceCents = parsePriceToCents(form.price);
      if (priceCents === null) fieldErrors.price = VALIDATION_MESSAGES.price;
    }

    return { fieldErrors, quantity, priceCents };
  }

  function mapServerFieldErrors(raw: unknown): FieldErrors {
    const serverErrors = (raw ?? {}) as Record<string, string[] | undefined>;
    const next: FieldErrors = {};
    if (serverErrors.name) {
      next.name = serverErrors.name[0] ?? VALIDATION_MESSAGES.name;
    }
    if (serverErrors.kind) {
      next.kind = serverErrors.kind[0] ?? VALIDATION_MESSAGES.kind;
    }
    if (serverErrors.quantity) {
      next.quantity = serverErrors.quantity[0] ?? VALIDATION_MESSAGES.quantity;
    }
    if (serverErrors.estimatedUnitPriceCents) {
      next.price =
        serverErrors.estimatedUnitPriceCents[0] ?? VALIDATION_MESSAGES.price;
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { fieldErrors, quantity, priceCents } = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || quantity === null) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/shopping-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          kind: form.kind,
          quantity,
          category: form.category.trim() || null,
          estimatedUnitPriceCents: priceCents,
        }),
      });

      if (response.status === 400) {
        const body = await response.json().catch(() => null);
        setErrors(mapServerFieldErrors(body?.fieldErrors));
        return;
      }

      if (!response.ok) {
        setFeedback({ type: "error", message: ADD_ERROR_MESSAGE });
        return;
      }

      const created: ShoppingItem = await response.json();
      setItems((prev) => sortShoppingItems([...prev, created]));
      setForm(EMPTY_FORM);
      setErrors({});
      setFeedback({ type: "success", message: ADD_SUCCESS_MESSAGE });
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: ADD_ERROR_MESSAGE });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSearchPrice(item: ShoppingItem) {
    setSearchingId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/shopping-items/${item.id}/price`, {
        method: "POST",
      });

      if (response.status === 503) {
        setFeedback({ type: "error", message: PRICE_UNAVAILABLE_MESSAGE });
        return;
      }

      if (!response.ok) {
        setFeedback({ type: "error", message: PRICE_ERROR_MESSAGE });
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | PriceResponse
        | null;
      const updated = body?.item;
      if (!body?.updated || !updated) {
        setFeedback({ type: "error", message: PRICE_EMPTY_MESSAGE });
        return;
      }

      setItems((prev) =>
        prev.map((current) => (current.id === updated.id ? updated : current)),
      );
      setFeedback({
        type: "success",
        message: `Preço atualizado: ${formatCents(
          updated.estimatedUnitPriceCents ?? 0,
        )} (${updated.priceSampleCount ?? 0} amostras).`,
      });
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: PRICE_ERROR_MESSAGE });
    } finally {
      setSearchingId(null);
    }
  }

  function openPriceEditor(item: ShoppingItem) {
    setPriceEditorId(item.id);
    setPriceDraft(centsToPriceInput(item.estimatedUnitPriceCents));
    setPriceError(null);
    setFeedback(null);
  }

  function closePriceEditor() {
    setPriceEditorId(null);
    setPriceDraft("");
    setPriceError(null);
  }

  async function handleSavePrice(
    event: FormEvent<HTMLFormElement>,
    item: ShoppingItem,
  ) {
    event.preventDefault();

    const trimmed = priceDraft.trim();
    let priceCents: number | null = null;
    if (trimmed) {
      priceCents = parsePriceToCents(trimmed);
      if (priceCents === null) {
        setPriceError(VALIDATION_MESSAGES.price);
        return;
      }
    }

    setPriceError(null);
    setSavingPriceId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/shopping-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimatedUnitPriceCents:
            priceCents !== null && priceCents > 0 ? priceCents : null,
        }),
      });

      if (!response.ok) {
        setFeedback({ type: "error", message: PRICE_SAVE_ERROR_MESSAGE });
        return;
      }

      const updated: ShoppingItem = await response.json();
      setItems((prev) =>
        prev.map((current) => (current.id === updated.id ? updated : current)),
      );
      setPriceEditorId(null);
      setPriceDraft("");
      setFeedback({
        type: "success",
        message: `Preço salvo: ${formatCents(
          updated.estimatedUnitPriceCents ?? 0,
        )}.`,
      });
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: PRICE_SAVE_ERROR_MESSAGE });
    } finally {
      setSavingPriceId(null);
    }
  }

  async function handleMarkPurchased(item: ShoppingItem) {
    setMarkingId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/shopping-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchased: true }),
      });

      if (!response.ok) {
        setFeedback({ type: "error", message: PURCHASED_ERROR_MESSAGE });
        return;
      }

      setItems((prev) => prev.filter((current) => current.id !== item.id));
      setFeedback({ type: "success", message: PURCHASED_SUCCESS_MESSAGE });
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: PURCHASED_ERROR_MESSAGE });
    } finally {
      setMarkingId(null);
    }
  }

  async function handleDelete(item: ShoppingItem) {
    if (!window.confirm(deleteConfirmMessage(item.name))) return;

    setDeletingId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/shopping-items/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setFeedback({ type: "error", message: DELETE_ERROR_MESSAGE });
        return;
      }

      setItems((prev) => prev.filter((current) => current.id !== item.id));
      setFeedback({ type: "success", message: DELETE_SUCCESS_MESSAGE });
      router.refresh();
    } catch {
      setFeedback({ type: "error", message: DELETE_ERROR_MESSAGE });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Lista de compras</h1>
        <p className="text-foreground-muted">
          Registre o que está acabando, pesquise o preço e veja o impacto no
          orçamento do ciclo antes de ir ao mercado.
        </p>
      </header>

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
        className="space-y-4 rounded-2xl border border-border bg-surface p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label
            htmlFor="shopping-name"
            className="flex flex-col gap-1 text-sm font-medium text-foreground-muted sm:col-span-2"
          >
            Nome
            <input
              id="shopping-name"
              name="name"
              type="text"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "erro-shopping-name" : undefined}
              placeholder="Ex.: Leite"
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            />
            {errors.name ? (
              <span
                id="erro-shopping-name"
                className="text-xs font-normal text-red-400"
              >
                {errors.name}
              </span>
            ) : null}
          </label>

          <label
            htmlFor="shopping-kind"
            className="flex flex-col gap-1 text-sm font-medium text-foreground-muted"
          >
            Classificação
            <select
              id="shopping-kind"
              name="kind"
              value={form.kind}
              onChange={(event) =>
                updateField("kind", event.target.value as ShoppingItemKind | "")
              }
              aria-invalid={Boolean(errors.kind)}
              aria-describedby={errors.kind ? "erro-shopping-kind" : undefined}
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <option value="">Selecione</option>
              <option value="ESSENCIAL">Essencial</option>
              <option value="DESEJAVEL">Desejável</option>
            </select>
            {errors.kind ? (
              <span
                id="erro-shopping-kind"
                className="text-xs font-normal text-red-400"
              >
                {errors.kind}
              </span>
            ) : null}
          </label>

          <label
            htmlFor="shopping-quantity"
            className="flex flex-col gap-1 text-sm font-medium text-foreground-muted"
          >
            Quantidade
            <input
              id="shopping-quantity"
              name="quantity"
              type="number"
              min={1}
              max={999}
              step={1}
              inputMode="numeric"
              value={form.quantity}
              onChange={(event) => updateField("quantity", event.target.value)}
              aria-invalid={Boolean(errors.quantity)}
              aria-describedby={
                errors.quantity ? "erro-shopping-quantity" : undefined
              }
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            />
            {errors.quantity ? (
              <span
                id="erro-shopping-quantity"
                className="text-xs font-normal text-red-400"
              >
                {errors.quantity}
              </span>
            ) : null}
          </label>

          <label
            htmlFor="shopping-category"
            className="flex flex-col gap-1 text-sm font-medium text-foreground-muted"
          >
            Categoria (opcional)
            <input
              id="shopping-category"
              name="category"
              type="text"
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              placeholder="Ex.: Alimentação"
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            />
          </label>

          <label
            htmlFor="shopping-price"
            className="flex flex-col gap-1 text-sm font-medium text-foreground-muted"
          >
            Preço unitário (R$, opcional)
            <input
              id="shopping-price"
              name="price"
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => updateField("price", event.target.value)}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? "erro-shopping-price" : undefined}
              placeholder="0,00"
              className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            />
            {errors.price ? (
              <span
                id="erro-shopping-price"
                className="text-xs font-normal text-red-400"
              >
                {errors.price}
              </span>
            ) : null}
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {submitting ? "Adicionando…" : "Adicionar item"}
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold text-foreground">Itens ativos</h2>

        {activeItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong bg-surface-raised px-4 py-6 text-center text-foreground-muted">
            {EMPTY_LIST_MESSAGE}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {activeItems.map((item) => {
              const searching = searchingId === item.id;
              const marking = markingId === item.id;
              const deleting = deletingId === item.id;
              const savingPrice = savingPriceId === item.id;
              const editingPrice = priceEditorId === item.id;
              const busy = searching || marking || deleting || savingPrice;
              const stale = isStaleDesirable(item, today);
              const age = ageLabel(daysOnList(item.addedOn, today), stale);
              const unitPrice = item.estimatedUnitPriceCents;
              const total = priceLineTotal(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">
                      {item.name}
                      <span className="ml-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-foreground-muted">
                        {KIND_LABELS[item.kind]}
                      </span>
                      {stale ? (
                        <span className="ml-2 rounded-full bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-200">
                          adiado
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {item.category ? `${item.category} · ` : ""}
                      Qtd. {item.quantity} · {age}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {unitPrice !== null ? (
                        <>
                          <span className="tabular-nums font-medium text-foreground">
                            {formatCents(unitPrice)}
                          </span>{" "}
                          por unidade
                          {total !== null ? (
                            <> · total {formatCents(total)}</>
                          ) : null}
                        </>
                      ) : (
                        "Sem preço estimado"
                      )}
                      {item.priceSampleCount ? (
                        <> · {item.priceSampleCount} amostras</>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSearchPrice(item)}
                      disabled={busy}
                      aria-busy={searching}
                      className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {searching ? "Pesquisando…" : "Pesquisar preço"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPriceEditor(item)}
                      disabled={busy}
                      className="rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-sm font-medium text-foreground-muted transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {unitPrice !== null && unitPrice > 0
                        ? "Editar preço"
                        : "Informar preço"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarkPurchased(item)}
                      disabled={busy}
                      aria-busy={marking}
                      className="rounded-lg border border-border-strong bg-surface-raised px-3 py-1.5 text-sm font-medium text-foreground-muted transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {marking ? "Salvando…" : "Marcar como comprado"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={busy}
                      aria-busy={deleting}
                      className="rounded-lg border border-red-800 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {deleting ? "Excluindo…" : "Excluir"}
                    </button>
                  </div>
                  {editingPrice ? (
                    <form
                      onSubmit={(event) => handleSavePrice(event, item)}
                      noValidate
                      className="basis-full space-y-2 rounded-xl border border-border-strong bg-surface-raised p-3"
                    >
                      <label
                        htmlFor={`shopping-price-${item.id}`}
                        className="flex flex-col gap-1 text-sm font-medium text-foreground-muted"
                      >
                        Preço unitário (R$)
                        <input
                          id={`shopping-price-${item.id}`}
                          name="price"
                          type="text"
                          inputMode="decimal"
                          value={priceDraft}
                          onChange={(event) =>
                            setPriceDraft(event.target.value)
                          }
                          aria-invalid={Boolean(priceError)}
                          aria-describedby={
                            priceError
                              ? `erro-shopping-price-${item.id}`
                              : undefined
                          }
                          placeholder="0,00"
                          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="submit"
                          disabled={savingPrice}
                          aria-busy={savingPrice}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                          {savingPrice ? "Salvando…" : "Salvar preço"}
                        </button>
                        <button
                          type="button"
                          onClick={closePriceEditor}
                          disabled={savingPrice}
                          className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground-muted transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                      {priceError ? (
                        <span
                          id={`erro-shopping-price-${item.id}`}
                          className="text-xs font-normal text-red-400"
                        >
                          {priceError}
                        </span>
                      ) : null}
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
