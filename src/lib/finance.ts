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
   * Projeção do percentual da renda comprometido até o fim do mês, somando as
   * obrigações conhecidas ao gasto avulso no ritmo diário atual (SPEC §4.3).
   * 0 quando não há renda cadastrada.
   */
  projectedPercent: number;
  /** Fração do mês já decorrida, em percentual (0..100). */
  elapsedPercent: number;
  /**
   * Coeficiente de situação: gasto_avulso_diario / diaria_disponivel, ou seja,
   * o quanto do orçamento diário livre já está sendo consumido por gasto
   * avulso. Quando não há diária disponível (obrigações ≥ renda), cai no
   * fallback projeção / renda (SPEC §4.2).
   */
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
 * Rótulo textual do nível, legível independentemente da cor (acessibilidade
 * para daltonismo/baixa visão). "neutral" nunca aparece junto a um percentual:
 * renda `<= 0` cai no estado vazio do dashboard (ver `resolveDashboardState`),
 * mas o mapeamento é mantido completo e coberto por teste unitário.
 */
const LEVEL_LABELS: Record<FinanceLevel, string> = {
  neutral: "Sem renda cadastrada",
  green: "Ok",
  lime: "Atenção",
  yellow: "Cuidado",
  orange: "Alerta",
  red: "Crítico",
};

export function levelLabel(level: FinanceLevel): string {
  return LEVEL_LABELS[level];
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Converte `hsl(H S% L%)` ou hex (`#rgb`/`#rrggbb`) para RGB 0..255. */
function parseColor(color: string): Rgb {
  const value = color.trim();

  const hexMatch = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const hex =
      hexMatch[1].length === 3
        ? hexMatch[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hexMatch[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  const hslMatch = value.match(
    /^hsl\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*\)$/,
  );
  if (hslMatch) {
    return hslToRgb(
      Number(hslMatch[1]),
      Number(hslMatch[2]) / 100,
      Number(hslMatch[3]) / 100,
    );
  }

  throw new Error(`Formato de cor não suportado: ${color}`);
}

/** Luminância relativa WCAG 2.1 (0..1). */
function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste WCAG 2.1 entre duas cores (1..21). */
export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(parseColor(foreground));
  const bg = relativeLuminance(parseColor(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Cor de texto entre preto puro e branco puro com maior contraste sobre
 * `backgroundColor` (hsl ou hex), garantindo legibilidade sobre qualquer tom.
 */
export function textColorForBackground(
  backgroundColor: string,
): "#000000" | "#ffffff" {
  const black = contrastRatio("#000000", backgroundColor);
  const white = contrastRatio("#ffffff", backgroundColor);
  return black >= white ? "#000000" : "#ffffff";
}

/**
 * Converte a projeção monetária do mês em percentual da renda. Retorna 0
 * quando não há renda cadastrada (percentual indefinido).
 */
export function projectedPercent(
  projectedCents: number,
  incomeCents: number,
): number {
  if (incomeCents <= 0) return 0;
  return (projectedCents / incomeCents) * 100;
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

  // Obrigações já comprometidas no mês (saídas fixas + faturas de cartão) não
  // entram no ritmo: só o gasto avulso é medido contra o orçamento diário livre.
  const obligations =
    Math.max(input.fixedExpensesCents, 0) + Math.max(input.cardExpensesCents, 0);
  const freeBudget = Math.max(income - obligations, 0);
  const dailyAvailable = totalDays > 0 ? freeBudget / totalDays : 0;
  const variable = Math.max(input.variableExpensesCents, 0);
  const dailySpend = variable / Math.max(elapsed, 1);
  const projectedCents = obligations + dailySpend * totalDays;

  const ratio =
    dailyAvailable > 0
      ? dailySpend / dailyAvailable
      : income > 0
        ? projectedCents / income
        : 0;
  const level = classifyLevel(ratio, percent, income);
  const projected = projectedPercent(projectedCents, income);

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

/**
 * Rótulo do contador do card principal: dias até o fim do mês calendário,
 * contando o dia corrente (inclusivo). Ex.: dia 08 de um mês de 31 dias ⇒
 * "24 dias para o fim do mês"; no último dia ⇒ "Hoje é o último dia do mês".
 */
export function monthEndCountdownLabel(days: number): string {
  if (days <= 1) return "Hoje é o último dia do mês";
  return `${days} dias para o fim do mês`;
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
