/**
 * Filtros de `/gastos` aplicados no cliente sobre os gastos do mês já carregados.
 *
 * Nenhuma função aqui acessa banco de dados ou rede: a lista chega pronta e os
 * filtros são combinados com AND, preservando a ordem recebida. A URL é a fonte
 * de verdade; o parse/build dos parâmetros fica nas funções de `expense-filters`
 * usadas pela página e pelo manager (ver expense-filters.test.ts).
 */

import { categoryKey, normalizeCategoryLabel } from "./categories";
import { formatCents } from "./money";
import { PAYMENT_METHODS, type PaymentMethod } from "./variable-expenses";

/** Status suportado pelo filtro: em aberto (não pago) ou pago. */
export type ExpenseStatusFilter = "open" | "paid";

/** Sentinela de URL que representa gastos sem categoria. */
export const NO_CATEGORY_FILTER = "__none__";

/** Campo de filtro que um chip ativo pode remover. */
export type ExpenseFilterKey = "q" | "category" | "payment" | "status";

/** Rótulo de exibição de cada forma de pagamento no filtro. */
export const PAYMENT_FILTER_LABELS: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  DEBIT: "Débito",
  PIX: "PIX",
  CREDIT: "Crédito",
};

const STATUS_FILTER_LABELS: Record<ExpenseStatusFilter, string> = {
  open: "Em aberto",
  paid: "Pago",
};

/** Rótulo exato do botão que remove todos os filtros. */
export const CLEAR_FILTERS_LABEL = "Limpar filtros";

export interface ExpenseFilters {
  /** Busca por descrição (substring, caixa/acento-insensível). */
  q?: string | null;
  /** Rótulo normalizado da categoria ou {@link NO_CATEGORY_FILTER}. */
  category?: string | null;
  /** Valor exato do enum de forma de pagamento. */
  payment?: string | null;
  /** `open`, `paid` ou ausente/inválido. */
  status?: string | null;
}

/** Campos mínimos de um gasto para aplicar os filtros. */
export interface FilterableExpense {
  description: string;
  amountCents: number;
  category: string | null;
  paymentMethod: PaymentMethod;
  paid: boolean;
}

/**
 * Forma canônica do termo de busca: `trim` e colapso de espaços internos,
 * preservando caixa e acentos (é o que o chip deve exibir).
 */
export function canonicalSearchTerm(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Normaliza o termo de busca: decompõe acentos (NFD), remove diacríticos,
 * passa para minúsculas, faz `trim` e colapsa espaços internos.
 */
export function normalizeSearchTerm(value: string | null | undefined): string {
  return canonicalSearchTerm(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function isPaymentMethod(value: string | null | undefined): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

function isStatus(value: string | null | undefined): value is ExpenseStatusFilter {
  return value === "open" || value === "paid";
}

function matchesQuery(
  expense: FilterableExpense,
  query: string | null | undefined,
): boolean {
  const term = normalizeSearchTerm(query);
  if (term === "") return true;
  return normalizeSearchTerm(expense.description).includes(term);
}

function matchesCategory(
  expense: FilterableExpense,
  category: string | null | undefined,
): boolean {
  if (category === null || category === undefined || category === "") return true;
  if (category === NO_CATEGORY_FILTER) return expense.category === null;

  const wanted = categoryKey(category);
  if (wanted === "") return true;
  return categoryKey(expense.category) === wanted;
}

function matchesPayment(
  expense: FilterableExpense,
  payment: string | null | undefined,
): boolean {
  if (!isPaymentMethod(payment)) return true;
  return expense.paymentMethod === payment;
}

function matchesStatus(
  expense: FilterableExpense,
  status: string | null | undefined,
): boolean {
  if (!isStatus(status)) return true;
  return status === "open" ? !expense.paid : expense.paid;
}

/**
 * Aplica os filtros com AND sobre a lista do mês, preservando a ordem recebida.
 * Filtros vazios, ausentes ou inválidos são ignorados (sem erro).
 */
export function filterExpenses<T extends FilterableExpense>(
  items: T[],
  filters: ExpenseFilters = {},
): T[] {
  const { q, category, payment, status } = filters;

  const hasQuery = normalizeSearchTerm(q) !== "";
  const hasCategory =
    typeof category === "string" &&
    category !== "" &&
    (category === NO_CATEGORY_FILTER || categoryKey(category) !== "");
  const hasPayment = isPaymentMethod(payment);
  const hasStatus = isStatus(status);

  if (!hasQuery && !hasCategory && !hasPayment && !hasStatus) return items;

  return items.filter(
    (expense) =>
      matchesQuery(expense, q) &&
      matchesCategory(expense, category) &&
      matchesPayment(expense, payment) &&
      matchesStatus(expense, status),
  );
}

/** Soma dos valores da lista visível; lista vazia soma zero. */
export function sumExpenseAmounts(items: Array<{ amountCents: number }>): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lê os parâmetros de URL e devolve apenas os filtros válidos. Valores
 * vazios, desconhecidos ou de tipo errado são ignorados (viram `null`).
 * `q`/`categoria` são trim/colapsados; caixa e acentos são preservados.
 */
export function parseExpenseFilters(
  params: Record<string, string | string[] | undefined> = {},
): ExpenseFilters {
  const rawPayment = firstValue(params.pagamento);
  const rawStatus = firstValue(params.status);
  return {
    q: canonicalSearchTerm(firstValue(params.q)) || null,
    category: normalizeCategoryLabel(firstValue(params.categoria)),
    payment: isPaymentMethod(rawPayment) ? rawPayment : null,
    status: isStatus(rawStatus) ? rawStatus : null,
  };
}

/**
 * Monta a query string de filtros preservando `mes`. Só parâmetros válidos e
 * não vazios entram, o que garante round-trip estável com
 * {@link parseExpenseFilters}.
 */
export function buildExpenseFilterQuery(
  mes: string,
  filters: ExpenseFilters = {},
): string {
  const params = new URLSearchParams();
  params.set("mes", mes);

  const q = canonicalSearchTerm(filters.q);
  if (q !== "") params.set("q", q);

  const category = normalizeCategoryLabel(filters.category);
  if (category !== null) params.set("categoria", category);

  if (isPaymentMethod(filters.payment)) params.set("pagamento", filters.payment);
  if (isStatus(filters.status)) params.set("status", filters.status);

  return params.toString();
}

/** Devolve uma cópia dos filtros sem o campo indicado. */
export function removeExpenseFilter(
  filters: ExpenseFilters,
  key: ExpenseFilterKey,
): ExpenseFilters {
  return { ...filters, [key]: null };
}

export interface ExpenseFilterChip {
  /** Campo removido quando o chip é acionado. */
  key: ExpenseFilterKey;
  /** Rótulo exato exibido no chip. */
  label: string;
}

/**
 * Chips dos filtros ativos, na ordem `q`, categoria, pagamento, status.
 * Categorias especiais usam o rótulo {@link NO_CATEGORY_LABEL}.
 */
export function activeExpenseFilterChips(
  filters: ExpenseFilters = {},
): ExpenseFilterChip[] {
  const chips: ExpenseFilterChip[] = [];

  const q = canonicalSearchTerm(filters.q);
  if (q !== "") chips.push({ key: "q", label: `Descrição: "${q}"` });

  if (filters.category === NO_CATEGORY_FILTER) {
    chips.push({ key: "category", label: "Categoria: Sem categoria" });
  } else {
    const category = normalizeCategoryLabel(filters.category);
    if (category !== null) {
      chips.push({ key: "category", label: `Categoria: ${category}` });
    }
  }

  if (isPaymentMethod(filters.payment)) {
    chips.push({
      key: "payment",
      label: `Pagamento: ${PAYMENT_FILTER_LABELS[filters.payment]}`,
    });
  }

  if (isStatus(filters.status)) {
    chips.push({
      key: "status",
      label: `Status: ${STATUS_FILTER_LABELS[filters.status]}`,
    });
  }

  return chips;
}

/** Há ao menos um filtro válido ativo? */
export function hasActiveExpenseFilters(filters: ExpenseFilters = {}): boolean {
  return activeExpenseFilterChips(filters).length > 0;
}

/** Resumo acessível da lista visível, ex.: `3 de 12 gastos`. */
export function visibleExpensesCountText(
  visibleCount: number,
  totalCount: number,
): string {
  return `${visibleCount} de ${totalCount} gastos`;
}

/** Linha do total do mês inteiro, ex.: `Total do mês: R$ 1.234,56`. */
export function monthTotalText(totalCents: number): string {
  return `Total do mês: ${formatCents(totalCents)}`;
}

/**
 * Linha do total da lista filtrada, ex.:
 * `Total filtrado: R$ 120,00 · 3 de 12 gastos`.
 */
export function filteredTotalText(
  totalCents: number,
  visibleCount: number,
  totalCount: number,
): string {
  return `Total filtrado: ${formatCents(totalCents)} · ${visibleExpensesCountText(
    visibleCount,
    totalCount,
  )}`;
}

/** Empty state quando há filtros ativos, ex.: `Nenhum gasto para os filtros selecionados em novembro de 2026.` */
export function filteredExpensesEmptyText(monthLabel: string): string {
  return `Nenhum gasto para os filtros selecionados em ${monthLabel}.`;
}
