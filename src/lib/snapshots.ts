/**
 * Derivação dos snapshots mensais a partir das transações.
 *
 * As funções aqui são puras (sem banco/rede), o que permite testar tanto a
 * matemática quanto os limites do mês (ver snapshots.test.ts). A captura
 * (automática no write/leitura ou via CLI) vive em `snapshot-capture.ts`; o
 * dashboard lê o snapshot de meses fechados via `snapshot-month.ts`.
 *
 * Ciclo de vida (decisão de produto): um mês fechado é capturado uma única vez
 * e **nunca é sobrescrito** automaticamente; correções passam pelo CLI
 * `db:snapshots --force`.
 */

import { buildCategoryBreakdown } from "./category-breakdown";
import { buildDailySeries } from "./dashboard-series";
import {
  consumptionAvailableCents,
  consumptionDailyAverageCents,
  isActiveInMonth,
  monthKey,
  shiftMonthKey,
} from "./finance";
import {
  invoiceLinesForSeries,
  type CardPurchaseForMonth,
} from "./invoices";
import { resolveTimeZone, zonedTimeToUtc } from "./time";
import { isCountedInBudget, type PaymentMethod } from "./variable-expenses";

/** Item fixo (entrada/saída) com os campos de vigência do mês. */
interface FixedItemInput {
  amountCents: number;
  active: boolean;
  startMonth?: string | null;
  endMonth?: string | null;
  category?: string | null;
}

/** Saída fixa crua: além da vigência, traz o dia de vencimento (série diária). */
export interface SnapshotFixedExpense extends FixedItemInput {
  dueDay: number;
}

/** Compra de cartão com a categoria, usada na quebra por categoria. */
export interface SnapshotCardPurchase extends CardPurchaseForMonth {
  category?: string | null;
}

export interface SnapshotTransactionInput {
  monthKey: string;
  incomes: FixedItemInput[];
  variableIncomes: { amountCents: number; date: Date }[];
  fixedExpenses: SnapshotFixedExpense[];
  variableExpenses: {
    amountCents: number;
    date: Date;
    paymentMethod: PaymentMethod;
    category?: string | null;
  }[];
  cardPurchases: SnapshotCardPurchase[];
  /** "Agora" injetável na série diária (testes); default `new Date()`. */
  now?: Date;
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
  /** Entradas fixas vigentes no mês. */
  fixedIncomeCents: number;
  /** Entradas avulsas (venda/saldo) do mês. */
  variableIncomeCents: number;
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
  /** Consumo variável por dia (avulsos + cartão do próprio mês). */
  variableDailyCents: number[];
  /** Obrigações por dia (fixas + parcelas de cartão de meses anteriores). */
  obligationDailyCents: number[];
  /** Gastos do mês por categoria; a soma fecha com `consumedCents`. */
  categories: SnapshotCategory[];
}

/**
 * Quantos meses fechados a captura automática (write/leitura) verifica por vez.
 * Backfills mais profundos ficam para o CLI `db:snapshots`.
 */
export const SNAPSHOT_AUTO_MONTHS = 12;

/** Janela máxima do backfill manual (`db:snapshots`), ~5 anos. */
export const SNAPSHOT_MAX_MONTHS = 60;

/**
 * Meses de `wanted` ausentes em `existing`, preservando a ordem de `wanted`
 * (cronológica, do mais antigo para o mais recente).
 */
export function missingMonthKeys(
  existing: Iterable<string>,
  wanted: string[],
): string[] {
  const present = new Set(existing);
  return wanted.filter((key) => !present.has(key));
}

/**
 * Um mês fechado só vira snapshot quando tem movimentação (renda ou consumo).
 * Meses vazios ficam de fora para não poluir o histórico com linhas zeradas;
 * se depois receberem um lançamento retroativo, a captura seguinte os pega.
 */
export function hasSnapshotData(
  snapshot: Pick<MonthlySnapshotData, "incomeCents" | "consumedCents">,
): boolean {
  return snapshot.incomeCents > 0 || snapshot.consumedCents > 0;
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
 * CREDIT`); compras de cartão contam pela competência da fatura, inclusive
 * parcelas de compras feitas em meses anteriores. A série diária reproduz o
 * gráfico "Consumo por dia" (`buildDailySeries`), para o dashboard de um mês
 * fechado ler tudo do snapshot sem recalcular.
 */
export function buildSnapshot(
  input: SnapshotTransactionInput,
): MonthlySnapshotData {
  const activeIncomes = input.incomes.filter((item) =>
    isActiveInMonth(item, input.monthKey),
  );
  const fixedIncomeCents = sum(activeIncomes);
  const variableIncomeCents = sum(
    input.variableIncomes.filter(
      (item) => monthKey(item.date) === input.monthKey,
    ),
  );
  const incomeCents = fixedIncomeCents + variableIncomeCents;

  const activeFixedExpenses = input.fixedExpenses.filter((item) =>
    isActiveInMonth(item, input.monthKey),
  );
  const fixedExpensesCents = sum(activeFixedExpenses);
  const variableExpensesCents = sum(
    input.variableExpenses.filter(
      (item) =>
        monthKey(item.date) === input.monthKey &&
        isCountedInBudget(item.paymentMethod),
    ),
  );

  const cardInvoiceLines = invoiceLinesForSeries(
    input.cardPurchases,
    input.monthKey,
  );
  const cardExpensesCents = cardInvoiceLines.reduce(
    (total, line) => total + line.amountCents,
    0,
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

  // Série diária idêntica à do dashboard ao vivo (mesma distribuição de dias).
  const series = buildDailySeries({
    referenceDate: firstDayOfMonth(input.monthKey),
    now: input.now,
    incomeCents,
    fixedExpenses: activeFixedExpenses.map((item) => ({
      amountCents: item.amountCents,
      dueDay: item.dueDay,
    })),
    variableExpenses: input.variableExpenses,
    cardInvoiceLines,
  });

  // `buildCategoryBreakdown` pressupõe os avulsos já restritos ao mês (a query
  // do dashboard faz isso); aqui o input pode vir de qualquer mês, então o
  // filtro por competência é aplicado antes para manter a invariante da soma.
  const categories = buildCategoryBreakdown({
    monthKey: input.monthKey,
    fixedExpenses: activeFixedExpenses,
    variableExpenses: input.variableExpenses.filter(
      (item) => monthKey(item.date) === input.monthKey,
    ),
    cardPurchases: input.cardPurchases,
  }).items;

  return {
    monthKey: input.monthKey,
    incomeCents,
    fixedIncomeCents,
    variableIncomeCents,
    fixedExpensesCents,
    variableExpensesCents,
    cardExpensesCents,
    consumedCents,
    consumedPercent,
    consumptionAvailableCents: available,
    dailyAverageCents: consumptionDailyAverageCents(available, daysInMonth),
    daysInMonth,
    variableDailyCents: series.variableDailyCents,
    obligationDailyCents: series.obligationDailyCents,
    categories,
  };
}

/** Meia-noite do dia 1 do mês `YYYY-MM` no fuso da família. */
function firstDayOfMonth(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return zonedTimeToUtc(year, month, 1, resolveTimeZone());
}
