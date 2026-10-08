/**
 * Agregação de gastos por categoria (história #253).
 *
 * Função pura: nenhuma consulta a banco/rede. Recebe o `monthKey` (YYYY-MM) e
 * as **mesmas coleções que `loadDashboardData` já tem em memória**, aplicando os
 * filtros internamente (o dono do filtro é esta função, uma única vez):
 *
 * - `fixedExpenses`: saídas fixas **cruas** (`active: true` vindo da query) →
 *   filtradas por `isActiveInMonth` (vigência `startMonth`/`endMonth`).
 * - `variableExpenses`: avulsos **já restritos ao mês** pela query de `date` →
 *   filtrados por `isCountedInBudget` (idempotente; exclui `CREDIT`, evitando a
 *   dupla contagem com a fatura, SPEC §3.3).
 * - `cardPurchases`: compras **cruas com `card`** → `allocateInstallments` e cada
 *   parcela cuja competência (`monthKey`) coincide com o mês de referência entra
 *   pela parcela, nunca pelo valor integral.
 *
 * Invariante: `sum(items) === totalCents`, e no fixture o total coincide com
 * `fixedExpensesCents + variableExpensesCents + cardExpensesCents`
 * (`consumedCents`). Os valores persistidos são inteiros não negativos por
 * validação de schema, então a soma direta de `amountCents` fecha exatamente.
 */

import {
  categoryKey,
  normalizeCategoryLabel,
  NO_CATEGORY_LABEL,
} from "./categories";
import { isActiveInMonth, type MonthVigency } from "./finance";
import { allocateInstallments, type InstallmentPlanInput } from "./invoices";
import { formatCents } from "./money";
import { isCountedInBudget, type PaymentMethod } from "./variable-expenses";

/** Saída fixa crua, com os campos de vigência e categoria. */
export interface CategoryBreakdownFixedExpense extends MonthVigency {
  amountCents: number;
  category?: string | null;
}

/** Gasto avulso já restrito ao mês pela query; a categoria é opcional. */
export interface CategoryBreakdownVariableExpense {
  amountCents: number;
  category?: string | null;
  paymentMethod: PaymentMethod;
}

/** Compra de cartão crua com o cartão; a competência vem de `allocateInstallments`. */
export interface CategoryBreakdownCardPurchase extends InstallmentPlanInput {
  category?: string | null;
  card: { closingDay: number; dueDay: number };
}

export interface CategoryBreakdownInput {
  /** Mês de referência no formato `YYYY-MM`. */
  monthKey: string;
  fixedExpenses: CategoryBreakdownFixedExpense[];
  variableExpenses: CategoryBreakdownVariableExpense[];
  cardPurchases: CategoryBreakdownCardPurchase[];
}

export interface CategoryBreakdownItem {
  /** Rótulo exibido: primeiro rótulo normalizado encontrado para a chave. */
  category: string;
  amountCents: number;
}

export interface CategoryBreakdown {
  monthKey: string;
  items: CategoryBreakdownItem[];
  totalCents: number;
}

/**
 * Soma o gasto do mês por categoria, alinhado à competência da fatura.
 *
 * Agrupa por `categoryKey`; o rótulo é o primeiro normalizado encontrado na
 * ordem de varredura fixas → avulsos → parcelas de cartão, preservando a ordem
 * de entrada de cada coleção. `null`/`""`/só espaços viram {@link NO_CATEGORY_LABEL}.
 * Lista todas as fatias com valor > 0, ordenadas por valor desc e, no empate,
 * por `localeCompare(..., "pt-BR")` ascendente sobre o rótulo exibido.
 */
export function buildCategoryBreakdown(
  input: CategoryBreakdownInput,
): CategoryBreakdown {
  const { monthKey } = input;
  const byKey = new Map<string, CategoryBreakdownItem>();

  const add = (rawCategory: string | null | undefined, amountCents: number) => {
    const key = categoryKey(rawCategory);
    const existing = byKey.get(key);
    if (existing) {
      existing.amountCents += amountCents;
      return;
    }
    byKey.set(key, {
      category: normalizeCategoryLabel(rawCategory) ?? NO_CATEGORY_LABEL,
      amountCents,
    });
  };

  for (const expense of input.fixedExpenses) {
    if (!isActiveInMonth(expense, monthKey)) continue;
    add(expense.category, expense.amountCents);
  }

  for (const expense of input.variableExpenses) {
    if (!isCountedInBudget(expense.paymentMethod)) continue;
    add(expense.category, expense.amountCents);
  }

  for (const purchase of input.cardPurchases) {
    const installments = allocateInstallments(
      purchase,
      purchase.card.closingDay,
      purchase.card.dueDay,
    );
    for (const installment of installments) {
      if (installment.monthKey !== monthKey) continue;
      add(purchase.category, installment.amountCents);
    }
  }

  const items = [...byKey.values()].filter((item) => item.amountCents > 0);
  items.sort(
    (a, b) =>
      b.amountCents - a.amountCents ||
      a.category.localeCompare(b.category, "pt-BR"),
  );

  return {
    monthKey,
    items,
    totalCents: items.reduce((total, item) => total + item.amountCents, 0),
  };
}

export const CATEGORY_BREAKDOWN_TITLE = "Gastos por categoria";
export const CATEGORY_BREAKDOWN_EMPTY_MESSAGE =
  "Nenhum gasto por categoria neste mês";
export const CATEGORY_BREAKDOWN_EMPTY_CTA_LABEL = "Registrar gastos";
export const CATEGORY_BREAKDOWN_EMPTY_CTA_HREF = "/gastos";

export interface CategoryBreakdownView {
  title: string;
  /** Itens no formato `Rótulo — R$ valor`, na ordem da agregação. */
  itemLabels: string[];
  /** Linha de total no formato `Total — R$ valor`. */
  totalLabel: string;
  isEmpty: boolean;
  emptyMessage: string;
  emptyCtaLabel: string;
  emptyCtaHref: string;
}

/**
 * View pura da seção: monta todos os textos (inclusive os do estado vazio) para
 * o componente de apresentação não montar UI à mão e o teste rodar sem DOM.
 */
export function categoryBreakdownView(
  breakdown: CategoryBreakdown,
): CategoryBreakdownView {
  return {
    title: CATEGORY_BREAKDOWN_TITLE,
    itemLabels: breakdown.items.map(
      (item) => `${item.category} — ${formatCents(item.amountCents)}`,
    ),
    totalLabel: `Total — ${formatCents(breakdown.totalCents)}`,
    isEmpty: breakdown.items.length === 0,
    emptyMessage: CATEGORY_BREAKDOWN_EMPTY_MESSAGE,
    emptyCtaLabel: CATEGORY_BREAKDOWN_EMPTY_CTA_LABEL,
    emptyCtaHref: CATEGORY_BREAKDOWN_EMPTY_CTA_HREF,
  };
}
