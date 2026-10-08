/**
 * Derivação idempotente dos snapshots mensais a partir das transações.
 *
 * As funções aqui são puras (sem banco/rede), o que permite testar tanto a
 * matemática quanto os limites do mês (ver snapshots.test.ts). O CLI em
 * `prisma/snapshots.ts` é quem consulta o banco e faz o upsert.
 */

import { monthKey, shiftMonthKey } from "./finance";

export interface SnapshotTransactionInput {
  monthKey: string;
  incomes: { amountCents: number; active: boolean }[];
  variableIncomes: { amountCents: number; date: Date }[];
  fixedExpenses: { amountCents: number; active: boolean }[];
  variableExpenses: {
    amountCents: number;
    date: Date;
    paymentMethod: string;
  }[];
  cardPurchases: { amountCents: number; purchaseDate: Date }[];
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
 * Simplificação alinhada ao `loadDashboardData`: entradas/saídas fixas ativas
 * contam integralmente; entradas avulsas e gastos avulsos contam pela `date` no
 * mês (gastos com `paymentMethod != CREDIT`); compras de cartão contam pela
 * `purchaseDate`.
 */
export function buildSnapshot(
  input: SnapshotTransactionInput,
): MonthlySnapshotData {
  const incomeCents =
    sum(input.incomes.filter((item) => item.active)) +
    sum(
      input.variableIncomes.filter(
        (item) => monthKey(item.date) === input.monthKey,
      ),
    );
  const fixedExpensesCents = sum(
    input.fixedExpenses.filter((item) => item.active),
  );
  const variableExpensesCents = sum(
    input.variableExpenses.filter(
      (item) =>
        monthKey(item.date) === input.monthKey &&
        item.paymentMethod !== "CREDIT",
    ),
  );
  const cardExpensesCents = sum(
    input.cardPurchases.filter(
      (item) => monthKey(item.purchaseDate) === input.monthKey,
    ),
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
