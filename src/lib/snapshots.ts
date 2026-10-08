/**
 * Derivação idempotente dos snapshots mensais a partir das transações.
 *
 * As funções aqui são puras (sem banco/rede), o que permite testar tanto a
 * matemática quanto os limites do mês (ver snapshots.test.ts). O CLI em
 * `prisma/snapshots.ts` é quem consulta o banco e faz o upsert.
 */

import { isActiveInMonth, monthKey, shiftMonthKey } from "./finance";
import {
  sumCardExpensesForMonth,
  type CardPurchaseForMonth,
} from "./invoices";

/** Item fixo (entrada/saída) com os campos de vigência do mês. */
interface FixedItemInput {
  amountCents: number;
  active: boolean;
  startMonth?: string | null;
  endMonth?: string | null;
}

export interface SnapshotTransactionInput {
  monthKey: string;
  incomes: FixedItemInput[];
  variableIncomes: { amountCents: number; date: Date }[];
  fixedExpenses: FixedItemInput[];
  variableExpenses: {
    amountCents: number;
    date: Date;
    paymentMethod: string;
  }[];
  cardPurchases: CardPurchaseForMonth[];
}

export interface MonthlySnapshotData {
  monthKey: string;
  incomeCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  consumedCents: number;
  consumedPercent: number;
}

function sum(items: { amountCents: number }[]): number {
  return items.reduce((total, item) => total + item.amountCents, 0);
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
        item.paymentMethod !== "CREDIT",
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

  return {
    monthKey: input.monthKey,
    incomeCents,
    fixedExpensesCents,
    variableExpensesCents,
    cardExpensesCents,
    consumedCents,
    consumedPercent,
  };
}
