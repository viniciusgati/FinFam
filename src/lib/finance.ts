/**
 * Lógica pura do dashboard financeiro.
 *
 * Nenhuma dessas funções acessa banco de dados ou rede — apenas calculam, o que
 * as torna facilmente testáveis (ver finance.test.ts).
 *
 * Regras completas em docs/SPEC.md §4.
 */

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

export interface FinanceStatus {
  monthKey: string;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  incomeCents: number;
  consumedCents: number;
  /** Percentual da renda consumida (0..∞). 0 quando não há renda. */
  consumedPercent: number;
  /** Fração do mês já decorrida, em percentual (0..100). */
  elapsedPercent: number;
  /** consumedPercent / elapsedPercent — o "ritmo" de gasto. */
  ratio: number;
  level: FinanceLevel;
  color: string;
}

export function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
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

export function computeFinanceStatus(input: FinanceInput): FinanceStatus {
  const referenceDate = input.referenceDate ?? new Date();
  const totalDays = daysInMonth(referenceDate);
  const elapsed = referenceDate.getDate();
  const remaining = totalDays - elapsed;
  const income = Math.max(input.monthlyIncomeCents, 0);
  const consumed = consumedCents(input);

  const percent = income > 0 ? (consumed / income) * 100 : 0;
  const elapsedPercent = (elapsed / totalDays) * 100;
  const ratio = income > 0 ? percent / Math.max(elapsedPercent, 1) : 0;
  const level = classifyLevel(ratio, percent, income);

  return {
    monthKey: monthKey(referenceDate),
    daysInMonth: totalDays,
    daysElapsed: elapsed,
    daysRemaining: remaining,
    incomeCents: income,
    consumedCents: consumed,
    consumedPercent: percent,
    elapsedPercent,
    ratio,
    level,
    color: levelColor(level, ratio),
  };
}

/** Mensagem comparativa com os meses anteriores (SPEC §4.3). */
export function compareWithHistory(
  currentPercent: number,
  previousPercents: number[],
): string {
  if (previousPercents.length === 0) {
    return "Ainda não há histórico suficiente.";
  }
  const better = previousPercents.filter((p) => currentPercent < p).length;
  if (better === previousPercents.length) {
    return `Estão melhores que os últimos ${previousPercents.length} meses.`;
  }
  if (better === 0) {
    return `Estão piores que os últimos ${previousPercents.length} meses.`;
  }
  return `Estão melhores que ${better} dos últimos ${previousPercents.length} meses.`;
}
