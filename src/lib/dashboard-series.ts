/**
 * Motor puro das séries diárias do dashboard.
 *
 * Nenhuma função aqui acessa banco de dados ou rede — apenas distribui os
 * gastos do mês pelo dia em que cada um "acontece" (avulsos na data, fixas no
 * vencimento e faturas no vencimento do cartão), o que a torna facilmente
 * testável (ver dashboard-series.test.ts).
 *
 * Consequência importante: `sum(dailyExpensesCents) === totalExpensesCents`
 * que, por construção em `loadDashboardData`, coincide com o `consumedCents`
 * de `computeFinanceStatus`. Avulsos no crédito não entram (SPEC §3.3) para não
 * duplicar a fatura.
 */

import { daysInMonth as daysInMonthOf, monthKey } from "./finance";
import { resolveTimeZone, zonedDateParts } from "./time";
import {
  isCountedInBudget,
  type PaymentMethod,
} from "./variable-expenses";

export interface SeriesFixedExpense {
  amountCents: number;
  dueDay: number;
}

export interface SeriesVariableExpense {
  amountCents: number;
  date: Date;
  paymentMethod: PaymentMethod;
}

/** Parcela de fatura já alocada ao mês, com o vencimento do cartão. */
export interface SeriesCardInvoiceLine {
  amountCents: number;
  dueDay: number;
}

export interface BuildDailySeriesInput {
  referenceDate: Date;
  /** "Agora" usado para decidir o dia de hoje/elapsedDay. Default: new Date(). */
  now?: Date;
  incomeCents?: number;
  fixedExpenses?: SeriesFixedExpense[];
  variableExpenses?: SeriesVariableExpense[];
  cardInvoiceLines?: SeriesCardInvoiceLine[];
}

export interface DailySeries {
  daysInMonth: number;
  /** Dia considerado "até agora" (mês corrente: hoje; passado: fim do mês). */
  elapsedDay: number;
  dailyExpensesCents: number[];
  cumulativeExpensesCents: number[];
  entriesCents: number;
  totalExpensesCents: number;
  dailyBudgetCents: number;
  /**
   * Orçamento diário livre de obrigações: renda menos saídas fixas e faturas
   * de cartão, dividida pelos dias do mês. Nunca negativo.
   */
  dailyFreeBudgetCents: number;
  todayExpensesCents: number;
  projectedMonthEndCents: number;
}

/** Índice 0-based de um dia 1-based, limitado ao tamanho do mês. */
function dayIndex(day: number, totalDays: number): number {
  const clamped = Math.min(Math.max(Math.trunc(day), 1), totalDays);
  return clamped - 1;
}

/**
 * Monta a série diária do mês de `referenceDate`.
 *
 * `dailyExpensesCents` cobre o mês inteiro (dias futuros inclusive) para que a
 * soma bata com o total consumido; `cumulativeExpensesCents` é truncado em
 * `elapsedDay`, refletindo apenas o que já ocorreu.
 */
export function buildDailySeries(input: BuildDailySeriesInput): DailySeries {
  const timeZone = resolveTimeZone();
  const totalDays = daysInMonthOf(input.referenceDate);
  const referenceMonth = monthKey(input.referenceDate);
  const currentMonth = monthKey(input.now ?? new Date());

  let elapsedDay: number;
  if (referenceMonth < currentMonth) {
    elapsedDay = totalDays;
  } else if (referenceMonth === currentMonth) {
    elapsedDay = zonedDateParts(input.now ?? new Date(), timeZone).day;
  } else {
    elapsedDay = 0;
  }
  elapsedDay = Math.min(Math.max(elapsedDay, 0), totalDays);

  const daily = new Array<number>(totalDays).fill(0);

  for (const expense of input.fixedExpenses ?? []) {
    daily[dayIndex(expense.dueDay, totalDays)] += expense.amountCents;
  }

  for (const expense of input.variableExpenses ?? []) {
    if (!isCountedInBudget(expense.paymentMethod)) continue;
    if (monthKey(expense.date) !== referenceMonth) continue;
    const day = zonedDateParts(expense.date, timeZone).day;
    daily[dayIndex(day, totalDays)] += expense.amountCents;
  }

  for (const line of input.cardInvoiceLines ?? []) {
    daily[dayIndex(line.dueDay, totalDays)] += line.amountCents;
  }

  const totalExpensesCents = daily.reduce((total, value) => total + value, 0);

  const cumulative: number[] = [];
  let running = 0;
  for (let day = 0; day < elapsedDay; day += 1) {
    running += daily[day];
    cumulative.push(running);
  }

  const entriesCents = Math.max(input.incomeCents ?? 0, 0);
  const dailyBudgetCents =
    totalDays > 0 ? Math.round(entriesCents / totalDays) : 0;
  const obligationsCents =
    (input.fixedExpenses ?? []).reduce(
      (total, expense) => total + expense.amountCents,
      0,
    ) +
    (input.cardInvoiceLines ?? []).reduce(
      (total, line) => total + line.amountCents,
      0,
    );
  const freeBudgetCents = Math.max(entriesCents - obligationsCents, 0);
  const dailyFreeBudgetCents =
    totalDays > 0 ? Math.round(freeBudgetCents / totalDays) : 0;
  const todayExpensesCents =
    elapsedDay > 0 ? daily[elapsedDay - 1] : 0;
  const projectedMonthEndCents =
    elapsedDay > 0
      ? Math.round((running / elapsedDay) * totalDays)
      : 0;

  return {
    daysInMonth: totalDays,
    elapsedDay,
    dailyExpensesCents: daily,
    cumulativeExpensesCents: cumulative,
    entriesCents,
    totalExpensesCents,
    dailyBudgetCents,
    dailyFreeBudgetCents,
    todayExpensesCents,
    projectedMonthEndCents,
  };
}
