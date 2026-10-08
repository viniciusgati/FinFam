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

import {
  consumptionAvailableCents,
  consumptionDailyAverageCents,
  daysInMonth as daysInMonthOf,
  monthKey,
} from "./finance";
import { formatCents } from "./money";
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
  /**
   * Gasto **variável** por dia (avulsos no orçamento), sem fixas nem faturas,
   * distribuído pela `date`. Mesmo comprimento de `dailyExpensesCents`.
   */
  variableDailyExpensesCents: number[];
  /** Média diária do consumo disponível (entradas − fixas) no mês. */
  consumptionDailyAverageCents: number;
  entriesCents: number;
  totalExpensesCents: number;
  dailyBudgetCents: number;
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
  const variableDaily = new Array<number>(totalDays).fill(0);

  for (const expense of input.fixedExpenses ?? []) {
    daily[dayIndex(expense.dueDay, totalDays)] += expense.amountCents;
  }

  for (const expense of input.variableExpenses ?? []) {
    if (!isCountedInBudget(expense.paymentMethod)) continue;
    if (monthKey(expense.date) !== referenceMonth) continue;
    const day = zonedDateParts(expense.date, timeZone).day;
    const index = dayIndex(day, totalDays);
    daily[index] += expense.amountCents;
    variableDaily[index] += expense.amountCents;
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
  const projectedMonthEndCents =
    elapsedDay > 0
      ? Math.round((running / elapsedDay) * totalDays)
      : 0;

  const consumptionDailyAverage = consumptionDailyAverageCents(
    consumptionAvailableCents({
      monthlyIncomeCents: entriesCents,
      fixedExpensesCents: (input.fixedExpenses ?? []).reduce(
        (total, expense) => total + expense.amountCents,
        0,
      ),
    }),
    totalDays,
  );

  return {
    daysInMonth: totalDays,
    elapsedDay,
    dailyExpensesCents: daily,
    cumulativeExpensesCents: cumulative,
    variableDailyExpensesCents: variableDaily,
    consumptionDailyAverageCents: consumptionDailyAverage,
    entriesCents,
    totalExpensesCents,
    dailyBudgetCents,
    projectedMonthEndCents,
  };
}

/**
 * Consumo disponível (`entradas − gastos fixos`) e sua média diária em cada
 * janela. É uma leitura **informativa**: não substitui o `%` protagonista, o
 * orçamento livre do ciclo (`dailyAllowanceCents`) nem a avaliação do dia
 * (`rateDay`). Faturas de cartão e avulsos contam como consumo variável e ficam
 * fora da subtração (SPEC §3.2/§3.4).
 */
export interface ConsumptionSummary {
  /** Entradas − gastos fixos, nunca negativo. */
  availableCents: number;
  /** Gastos fixos ≥ entradas no mês (renda insuficiente para as obrigações). */
  overCommitted: boolean;
  /** Consumo disponível ÷ dias do mês calendário. */
  dailyByMonthCents: number;
  /** Consumo disponível ÷ dias decorridos. */
  dailyByElapsedCents: number;
  /** Consumo disponível ÷ dias do ciclo; `null` fora do mês corrente. */
  dailyByCycleCents: number | null;
  daysInMonth: number;
  daysElapsed: number;
  /** Total de dias do ciclo financeiro; `null` fora do mês corrente. */
  cycleDays: number | null;
}

export interface BuildConsumptionSummaryInput {
  incomeCents: number;
  fixedExpensesCents: number;
  daysInMonth: number;
  daysElapsed: number;
  cycleDays?: number | null;
}

export function buildConsumptionSummary(
  input: BuildConsumptionSummaryInput,
): ConsumptionSummary {
  const availableCents = consumptionAvailableCents({
    monthlyIncomeCents: input.incomeCents,
    fixedExpensesCents: input.fixedExpensesCents,
  });
  const cycleDays = input.cycleDays ?? null;

  return {
    availableCents,
    overCommitted: input.fixedExpensesCents >= input.incomeCents,
    dailyByMonthCents: consumptionDailyAverageCents(
      availableCents,
      input.daysInMonth,
    ),
    dailyByElapsedCents: consumptionDailyAverageCents(
      availableCents,
      input.daysElapsed,
    ),
    dailyByCycleCents:
      cycleDays === null
        ? null
        : consumptionDailyAverageCents(availableCents, cycleDays),
    daysInMonth: input.daysInMonth,
    daysElapsed: input.daysElapsed,
    cycleDays,
  };
}

/**
 * Mensagem de indisponibilidade quando as contas fixas consomem toda a renda do
 * mês. Compartilhada entre o rótulo do card e o gráfico de gasto variável.
 */
export const CONSUMPTION_UNAVAILABLE_LABEL =
  "Sem consumo disponível: as contas fixas consomem toda a renda do mês.";

/**
 * Rótulo do consumo disponível e da média diária (janela "mês"). Quando as
 * contas fixas consomem toda a renda, não exibe valores em R$ — apenas a
 * mensagem de indisponibilidade.
 */
export function consumptionAverageLabel(summary: ConsumptionSummary): string {
  if (summary.overCommitted) {
    return CONSUMPTION_UNAVAILABLE_LABEL;
  }
  return `Consumo de ${formatCents(summary.availableCents)} · ${formatCents(
    summary.dailyByMonthCents,
  )}/dia (mês) · não inclui contas fixas`;
}
