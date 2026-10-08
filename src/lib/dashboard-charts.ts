/**
 * Views puras dos gráficos do dashboard (história #254):
 *
 * - **"Consumo por dia"**: barras do consumo variável (avulsos + compras do mês
 *   no cartão, pela data da compra) + linha do **dia típico** (moda; mediana
 *   como fallback) e marcadores de vencimento (fixas/fatura) fora da escala.
 * - **"Para onde vai a renda"**: composição da renda em contas fixas, fatura,
 *   avulsos e restante.
 *
 * Nenhuma função acessa banco/rede (ver dashboard-charts.test.ts). Textos e
 * números são decididos aqui para o componente só apresentar.
 */

import { formatCents } from "./money";

export interface TypicalDailySpend {
  metric: "mode" | "median";
  /** "Moda" | "Mediana" — diz de onde veio o valor. */
  label: string;
  cents: number;
}

/**
 * Dia típico de consumo: a **moda** dos dias com consumo > 0. Valores em
 * centavos quase não se repetem; quando não há moda única (nenhum repetido ou
 * empate), usa a **mediana** — ambas robustas a picos de compras grandes.
 * Sem nenhum dia com consumo, retorna `null`.
 */
export function typicalDailySpend(
  dailyCents: number[],
): TypicalDailySpend | null {
  const positive = dailyCents.filter((value) => value > 0);
  if (positive.length === 0) return null;

  const counts = new Map<number, number>();
  for (const value of positive) counts.set(value, (counts.get(value) ?? 0) + 1);

  let bestCount = 0;
  let bestValues: number[] = [];
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestValues = [value];
    } else if (count === bestCount) {
      bestValues.push(value);
    }
  }
  if (bestCount >= 2 && bestValues.length === 1) {
    return { metric: "mode", label: "Moda", cents: bestValues[0] };
  }

  const sorted = [...positive].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const cents =
    sorted.length % 2 === 1
      ? sorted[middle]
      : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  return { metric: "median", label: "Mediana", cents };
}

export const CONSUMPTION_CHART_TITLE = "Consumo por dia";
export const CONSUMPTION_CHART_EMPTY_MESSAGE = "Sem consumo variável neste mês";

export interface ConsumptionChartDay {
  /** Dia do mês (1-based). */
  day: number;
  /** Consumo variável do dia (barras). */
  variableCents: number;
  /** Obrigações que vencem no dia (marcadores, fora da escala). */
  obligationCents: number;
}

export interface ConsumptionChartInput {
  variableDailyCents: number[];
  obligationDailyCents: number[];
  /** Dia "até agora" (1-based); dias posteriores ficam atenuados. */
  elapsedDay: number;
  /** Dia de hoje a destacar (1-based); ausente em mês fechado. */
  highlightDay?: number;
}

export interface ConsumptionChartView {
  title: string;
  days: ConsumptionChartDay[];
  /** Maior barra (escala do gráfico). */
  maxVariableCents: number;
  typical: TypicalDailySpend | null;
  /** Altura da linha do dia típico em % da área do gráfico (0 = base). */
  typicalPercent: number;
  /** Consumo de hoje (só quando `highlightDay` é informado). */
  todayCents: number | null;
  /** Dias com consumo acima do dia típico. */
  aboveTypicalCount: number;
  /** Ex.: `Hoje: R$ 12,00 · Dia típico (Moda): R$ 30,00 · 5 dias acima`. */
  summaryLabel: string;
  ariaLabel: string;
  isEmpty: boolean;
  emptyMessage: string;
}

export function buildConsumptionChartView(
  input: ConsumptionChartInput,
): ConsumptionChartView {
  const days: ConsumptionChartDay[] = input.variableDailyCents.map(
    (variableCents, index) => ({
      day: index + 1,
      variableCents,
      obligationCents: input.obligationDailyCents[index] ?? 0,
    }),
  );
  const maxVariableCents = days.reduce(
    (max, day) => Math.max(max, day.variableCents),
    0,
  );
  const typical = typicalDailySpend(input.variableDailyCents);
  const typicalPercent =
    typical !== null && maxVariableCents > 0
      ? Math.min((typical.cents / maxVariableCents) * 100, 100)
      : 0;
  const todayCents =
    input.highlightDay !== undefined && input.highlightDay >= 1
      ? (input.variableDailyCents[input.highlightDay - 1] ?? 0)
      : null;
  const aboveTypicalCount =
    typical === null
      ? 0
      : days.filter((day) => day.variableCents > typical.cents).length;

  const parts: string[] = [];
  if (todayCents !== null) parts.push(`Hoje: ${formatCents(todayCents)}`);
  if (typical !== null) {
    parts.push(
      `Dia típico (${typical.label}): ${formatCents(typical.cents)}`,
    );
    parts.push(
      aboveTypicalCount === 1
        ? "1 dia acima"
        : `${aboveTypicalCount} dias acima`,
    );
  }

  const obligationDays = days.filter((day) => day.obligationCents > 0).length;
  const obligationPart =
    obligationDays === 1
      ? "1 dia com vencimento de contas fixas ou fatura"
      : `${obligationDays} dias com vencimento de contas fixas ou fatura`;
  const ariaParts = [
    `Consumo por dia, ${days.length} dias`,
    typical !== null
      ? `dia típico ${formatCents(typical.cents)} (${typical.label})`
      : "sem consumo variável",
    obligationDays > 0 ? obligationPart : null,
  ].filter((part): part is string => part !== null);

  return {
    title: CONSUMPTION_CHART_TITLE,
    days,
    maxVariableCents,
    typical,
    typicalPercent,
    todayCents,
    aboveTypicalCount,
    summaryLabel: parts.join(" · "),
    ariaLabel: ariaParts.join("; "),
    isEmpty:
      maxVariableCents === 0 && !days.some((day) => day.obligationCents > 0),
    emptyMessage: CONSUMPTION_CHART_EMPTY_MESSAGE,
  };
}

export const INCOME_ALLOCATION_TITLE = "Para onde vai a renda";
export const INCOME_ALLOCATION_EMPTY_MESSAGE =
  "Sem renda cadastrada neste mês";

export type IncomeAllocationKey = "fixed" | "card" | "variable" | "remaining";

export interface IncomeAllocationRow {
  key: IncomeAllocationKey;
  label: string;
  amountCents: number;
  /** Fatia do total (renda ou consumo, o maior) para a barra empilhada. */
  percent: number;
  barClass: string;
}

export interface IncomeAllocationInput {
  incomeCents: number;
  fixedExpensesCents: number;
  cardExpensesCents: number;
  variableExpensesCents: number;
}

export interface IncomeAllocationView {
  title: string;
  incomeLabel: string;
  rows: IncomeAllocationRow[];
  /** Consumo (fixas + fatura + avulsos) acima da renda do mês. */
  overspent: boolean;
  overspentLabel: string | null;
  ariaLabel: string;
  isEmpty: boolean;
  emptyMessage: string;
}

/**
 * Composição da renda do mês: cada real vai para contas fixas, fatura do
 * cartão, gastos avulsos ou sobra. Quando o consumo passa da renda, a linha de
 * "ainda disponível" some e a mensagem de estouro aparece; as fatias continuam
 * proporcionais ao consumo.
 */
export function buildIncomeAllocationView(
  input: IncomeAllocationInput,
): IncomeAllocationView {
  const income = Math.max(input.incomeCents, 0);
  const fixed = Math.max(input.fixedExpensesCents, 0);
  const card = Math.max(input.cardExpensesCents, 0);
  const variable = Math.max(input.variableExpensesCents, 0);
  const consumed = fixed + card + variable;
  const remaining = income - consumed;
  const overspent = income > 0 && remaining < 0;
  const base = Math.max(income, consumed, 1);
  const percent = (value: number) => Math.round((value / base) * 100);

  const rows: IncomeAllocationRow[] = [
    {
      key: "fixed",
      label: "Contas fixas",
      amountCents: fixed,
      percent: percent(fixed),
      barClass: "bg-sky-500",
    },
    {
      key: "card",
      label: "Fatura do cartão",
      amountCents: card,
      percent: percent(card),
      barClass: "bg-rose-500",
    },
    {
      key: "variable",
      label: "Gastos avulsos",
      amountCents: variable,
      percent: percent(variable),
      barClass: "bg-amber-500",
    },
  ];
  if (remaining >= 0) {
    rows.push({
      key: "remaining",
      label: "Ainda disponível",
      amountCents: remaining,
      percent: percent(remaining),
      barClass: "bg-emerald-500",
    });
  }

  const rowsForAria = rows
    .map((row) => `${row.label.toLowerCase()} ${formatCents(row.amountCents)}`)
    .join(", ");
  const ariaLabel = `Renda do mês de ${formatCents(income)}: ${rowsForAria}.`;

  return {
    title: INCOME_ALLOCATION_TITLE,
    incomeLabel: formatCents(income),
    rows,
    overspent,
    overspentLabel: overspent
      ? `No vermelho: o consumo passou a renda em ${formatCents(-remaining)}.`
      : null,
    ariaLabel,
    isEmpty: income <= 0,
    emptyMessage: INCOME_ALLOCATION_EMPTY_MESSAGE,
  };
}
