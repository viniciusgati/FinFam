/**
 * Lógica pura do dashboard financeiro.
 *
 * Nenhuma dessas funções acessa banco de dados ou rede — apenas calculam, o que
 * as torna facilmente testáveis (ver finance.test.ts).
 *
 * Regras completas em docs/SPEC.md §4.
 */

import { resolveTimeZone, zonedDateParts } from "./time";

export type FinanceLevel =
  | "neutral"
  | "green"
  | "lime"
  | "yellow"
  | "orange"
  | "red";

export interface FinanceInput {
  monthlyIncomeCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  referenceDate?: Date;
}

export type DashboardState = "ready" | "empty";

export interface FinanceStatus {
  monthKey: string;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  incomeCents: number;
  consumedCents: number;
  /** Percentual da renda consumida (0..∞). 0 quando não há renda. */
  consumedPercent: number;
  /**
   * Projeção linear do percentual consumido até o fim do mês, no ritmo atual
   * (SPEC §4.3). 0 quando não há renda cadastrada.
   */
  projectedPercent: number;
  /** Fração do mês já decorrida, em percentual (0..100). */
  elapsedPercent: number;
  /** consumedPercent / elapsedPercent — o "ritmo" de gasto. */
  ratio: number;
  level: FinanceLevel;
  color: string;
}

export function monthKey(date: Date): string {
  const { year, month } = zonedDateParts(date, resolveTimeZone());
  return `${year}-${String(month).padStart(2, "0")}`;
}

const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * Desloca `monthKey` (YYYY-MM) em `delta` meses por aritmética inteira de
 * ano/mês, sem usar `Date` — logo, imune a fusos e ao tamanho dos meses.
 */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const total = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = total - nextYear * 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
}

/** Rótulo pt-BR de um mês `YYYY-MM` (ex.: "agosto de 2026"). */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} de ${year}`;
}

/**
 * Os 4 `monthKey` (YYYY-MM) imediatamente anteriores ao mês de `reference`,
 * do mais recente para o mais antigo. Cruza o ano natural (jan/2026 →
 * dez/2025, nov/2025, ...). Reutilizado pelo seed (prisma/seed.ts) para
 * montar o histórico de meses fechados do dashboard.
 */
export function previousMonthKeys(reference: Date): string[] {
  const current = monthKey(reference);
  const keys: string[] = [];
  for (let offset = 1; offset <= 4; offset++) {
    keys.push(shiftMonthKey(current, -offset));
  }
  return keys;
}

/** Campos mínimos para decidir se um item fixo vigora em um mês. */
export interface MonthVigency {
  active: boolean;
  startMonth?: string | null;
  endMonth?: string | null;
}

/**
 * Um item fixo (entrada ou saída) conta no mês `month` (YYYY-MM) quando está
 * ativo e dentro da vigência. Vigência é inclusiva nas duas pontas e os limites
 * nulos significam "sem limite" (ver suposições da história #212).
 */
export function isActiveInMonth(item: MonthVigency, month: string): boolean {
  if (item.active !== true) return false;
  if (item.startMonth && item.startMonth > month) return false;
  if (item.endMonth && item.endMonth < month) return false;
  return true;
}

export function daysInMonth(date: Date): number {
  const { year, month } = zonedDateParts(date, resolveTimeZone());
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function consumedCents(input: FinanceInput): number {
  return (
    Math.max(input.fixedExpensesCents, 0) +
    Math.max(input.variableExpensesCents, 0) +
    Math.max(input.cardExpensesCents, 0)
  );
}

/**
 * Classifica a situação. Usa o ritmo quando há renda; retorna "neutral"
 * quando a renda mensal não está cadastrada (ver SPEC §5.6).
 */
export function classifyLevel(
  ratio: number,
  consumedPercent: number,
  incomeCents: number,
): FinanceLevel {
  if (incomeCents <= 0) return "neutral";
  if (consumedPercent >= 100) return "red";
  if (ratio <= 0.8) return "green";
  if (ratio <= 1.0) return "lime";
  if (ratio <= 1.25) return "yellow";
  if (ratio <= 1.6) return "orange";
  return "red";
}

/** Cor HSL interpolada do verde (120°) ao vermelho (0°) conforme o ritmo. */
export function heatColor(ratio: number): string {
  const clamped = Math.min(Math.max(ratio, 0), 2);
  const hue = 120 - (clamped / 2) * 120;
  return `hsl(${Math.round(hue)} 65% 42%)`;
}

export function levelColor(level: FinanceLevel, ratio: number): string {
  if (level === "neutral") return "hsl(0 0% 45%)";
  return heatColor(ratio);
}

/**
 * Projeção linear do percentual consumido até o fim do mês, mantendo o ritmo
 * atual. Retorna 0 quando não há renda cadastrada (percentual indefinido).
 */
export function projectedPercent(
  consumedPercentValue: number,
  totalDays: number,
  elapsed: number,
  incomeCents: number,
): number {
  if (incomeCents <= 0) return 0;
  return (consumedPercentValue * totalDays) / Math.max(elapsed, 1);
}

export function computeFinanceStatus(input: FinanceInput): FinanceStatus {
  const referenceDate = input.referenceDate ?? new Date();
  const currentMonth = monthKey(referenceDate);
  const totalDays = daysInMonth(referenceDate);
  const elapsed = zonedDateParts(referenceDate, resolveTimeZone()).day;
  const remaining = totalDays - elapsed;
  const income = Math.max(input.monthlyIncomeCents, 0);
  const consumed = consumedCents(input);

  const percent = income > 0 ? (consumed / income) * 100 : 0;
  const elapsedPercent = (elapsed / totalDays) * 100;
  const ratio = income > 0 ? percent / Math.max(elapsedPercent, 1) : 0;
  const level = classifyLevel(ratio, percent, income);
  const projected = projectedPercent(percent, totalDays, elapsed, income);

  return {
    monthKey: currentMonth,
    daysInMonth: totalDays,
    daysElapsed: elapsed,
    daysRemaining: remaining,
    incomeCents: income,
    consumedCents: consumed,
    consumedPercent: percent,
    projectedPercent: projected,
    elapsedPercent,
    ratio,
    level,
    color: levelColor(level, ratio),
  };
}

/**
 * Seleciona o estado de exibição do dashboard a partir da renda mensal.
 *
 * Usa a mesma normalização de `computeFinanceStatus`: renda `<= 0` (inclui
 * zero e negativo) significa que ainda não há dados para calcular percentual.
 */
export function resolveDashboardState(input: {
  monthlyIncomeCents: number;
}): DashboardState {
  return input.monthlyIncomeCents <= 0 ? "empty" : "ready";
}

/** Mensagem comparativa com os meses anteriores (SPEC §4.3). */
export function compareWithHistory(
  currentPercent: number,
  previousPercents: number[],
): string {
  if (previousPercents.length === 0) {
    return "Ainda não há histórico suficiente.";
  }
  const better = previousPercents.filter((p) => currentPercent <= p).length;
  if (better === previousPercents.length) {
    return `Estão melhores que os últimos ${previousPercents.length} meses.`;
  }
  if (better === 0) {
    return `Estão piores que os últimos ${previousPercents.length} meses.`;
  }
  return `Estão melhores que ${better} dos últimos ${previousPercents.length} meses.`;
}

export interface DashboardViewInput {
  dbError: boolean;
  incomeCents: number;
  consumedPercent: number;
  projectedPercent: number;
  previousPercents: number[];
}

/**
 * Estados visíveis do dashboard, decididos por uma função pura para poderem
 * ser testados sem DOM (o projeto não possui test runner de DOM).
 */
export type DashboardView =
  | { state: "error" }
  | { state: "empty" }
  | { state: "ok"; percent: number; feedback: string };

export function dashboardView(input: DashboardViewInput): DashboardView {
  if (input.dbError) return { state: "error" };
  if (
    resolveDashboardState({ monthlyIncomeCents: input.incomeCents }) === "empty"
  ) {
    return { state: "empty" };
  }

  return {
    state: "ok",
    percent: Math.round(input.consumedPercent),
    feedback: compareWithHistory(input.projectedPercent, input.previousPercents),
  };
}
