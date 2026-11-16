/**
 * Filtros de `/gastos` aplicados no cliente sobre os gastos do mês já carregados.
 *
 * Nenhuma função aqui acessa banco de dados ou rede: a lista chega pronta e os
 * filtros são combinados com AND, preservando a ordem recebida. A URL é a fonte
 * de verdade; o parse/build dos parâmetros fica nas funções de `expense-filters`
 * usadas pela página e pelo manager (ver expense-filters.test.ts).
 */

import { categoryKey } from "./categories";
import { PAYMENT_METHODS, type PaymentMethod } from "./variable-expenses";

/** Status suportado pelo filtro: em aberto (não pago) ou pago. */
export type ExpenseStatusFilter = "open" | "paid";

/** Sentinela de URL que representa gastos sem categoria. */
export const NO_CATEGORY_FILTER = "__none__";

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
 * Normaliza o termo de busca: decompõe acentos (NFD), remove diacríticos,
 * passa para minúsculas, faz `trim` e colapsa espaços internos.
 */
export function normalizeSearchTerm(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
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
