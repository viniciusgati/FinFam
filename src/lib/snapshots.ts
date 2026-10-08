/**
 * Derivação idempotente dos snapshots mensais a partir das transações.
 *
 * As funções aqui são puras (sem banco/rede), o que permite testar tanto a
 * matemática quanto os limites do mês (ver snapshots.test.ts). O CLI em
 * `prisma/snapshots.ts` é quem consulta o banco e faz o upsert.
 */

import { buildCategoryBreakdown } from "./category-breakdown";
import {
  consumptionAvailableCents,
  consumptionDailyAverageCents,
  isActiveInMonth,
  monthKey,
  shiftMonthKey,
} from "./finance";
import {
  sumCardExpensesForMonth,
  type CardPurchaseForMonth,
} from "./invoices";
import { isCountedInBudget, type PaymentMethod } from "./variable-expenses";

/** Item fixo (entrada/saída) com os campos de vigência do mês. */
interface FixedItemInput {
  amountCents: number;
  active: boolean;
  startMonth?: string | null;
  endMonth?: string | null;
  category?: string | null;
}

/** Compra de cartão com a categoria, usada na quebra por categoria. */
export interface SnapshotCardPurchase extends CardPurchaseForMonth {
  category?: string | null;
}

export interface SnapshotTransactionInput {
  monthKey: string;
  incomes: FixedItemInput[];
  variableIncomes: { amountCents: number; date: Date }[];
  fixedExpenses: FixedItemInput[];
  variableExpenses: {
    amountCents: number;
    date: Date;
    paymentMethod: PaymentMethod;
    category?: string | null;
  }[];
  cardPurchases: SnapshotCardPurchase[];
}

/** Fatia de gasto por categoria persistida no snapshot mensal. */
export interface SnapshotCategory {
  /** Rótulo normalizado exibido (`NO_CATEGORY_LABEL` quando vazio/ausente). */
  category: string;
  amountCents: number;
}

export interface MonthlySnapshotData {
  monthKey: string;
  incomeCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  consumedCents: number;
  consumedPercent: number;
  /** Consumo disponível (`entradas − gastos fixos`), nunca negativo. */
  consumptionAvailableCents: number;
  /** Média diária do consumo disponível no mês calendário. */
  dailyAverageCents: number;
  /** Dias do mês calendário derivados do `monthKey`. */
  daysInMonth: number;
  /** Gastos do mês por categoria; a soma fecha com `consumedCents`. */
  categories: SnapshotCategory[];
}

function sum(items: { amountCents: number }[]): number {
  return items.reduce((total, item) => total + item.amountCents, 0);
}

/**
 * Dias do mês calendário de um `monthKey` (YYYY-MM). Aritmética pura sobre o
 * ano/mês (o dia 0 do mês seguinte é o último do mês atual), imune a fusos.
 */
export function daysInMonthKey(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Últimos `n` meses estritamente anteriores ao mês de `referenceDate`, em ordem
 * cronológica. Nunca inclui o mês corrente.
 */
export function monthRange(referenceDate: Date, n: number): string[] {
  const current = monthKey(referenceDate);
  const keys: string[] = [];
  for (let i = n; i >= 1; i -= 1) {
    keys.push(shiftMonthKey(current, -i));
  }
  return keys;
}

/**
 * Agrega as transações de um mês e calcula o snapshot correspondente.
 *
 * Paridade com o `loadDashboardData`: entradas/saídas fixas respeitam a
 * vigência (`isActiveInMonth`, não só o flag `active`); entradas avulsas e
 * gastos avulsos contam pela `date` no mês (gastos com `paymentMethod !=
 * CREDIT`); compras de cartão contam pela competência da fatura
 * (`sumCardExpensesForMonth`), inclusive parcelas de compras feitas em meses
 * anteriores.
 */
export function buildSnapshot(
  input: SnapshotTransactionInput,
): MonthlySnapshotData {
  const incomeCents =
    sum(
      input.incomes.filter((item) => isActiveInMonth(item, input.monthKey)),
    ) +
    sum(
      input.variableIncomes.filter(
        (item) => monthKey(item.date) === input.monthKey,
      ),
    );
  const fixedExpensesCents = sum(
    input.fixedExpenses.filter((item) =>
      isActiveInMonth(item, input.monthKey),
    ),
  );
  const variableExpensesCents = sum(
    input.variableExpenses.filter(
      (item) =>
        monthKey(item.date) === input.monthKey &&
        isCountedInBudget(item.paymentMethod),
    ),
  );
  const cardExpensesCents = sumCardExpensesForMonth(
    input.cardPurchases,
    input.monthKey,
  );
  const consumedCents =
    fixedExpensesCents + variableExpensesCents + cardExpensesCents;
  const consumedPercent =
    incomeCents > 0 ? (consumedCents / incomeCents) * 100 : 0;

  const available = consumptionAvailableCents({
    monthlyIncomeCents: incomeCents,
    fixedExpensesCents,
  });
  const daysInMonth = daysInMonthKey(input.monthKey);

  // `buildCategoryBreakdown` pressupõe os avulsos já restritos ao mês (a query
  // do dashboard faz isso); aqui o input pode vir de qualquer mês, então o
  // filtro por competência é aplicado antes para manter a invariante da soma.
  const categories = buildCategoryBreakdown({
    monthKey: input.monthKey,
    fixedExpenses: input.fixedExpenses,
    variableExpenses: input.variableExpenses.filter(
      (item) => monthKey(item.date) === input.monthKey,
    ),
    cardPurchases: input.cardPurchases,
  }).items;

  return {
    monthKey: input.monthKey,
    incomeCents,
    fixedExpensesCents,
    variableExpensesCents,
    cardExpensesCents,
    consumedCents,
    consumedPercent,
    consumptionAvailableCents: available,
    dailyAverageCents: consumptionDailyAverageCents(available, daysInMonth),
    daysInMonth,
    categories,
  };
}
