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
export const CONSUMPTION_CHART_EMPTY_CTA_LABEL = "Registrar gastos";
export const CONSUMPTION_CHART_EMPTY_CTA_HREF = "/gastos";

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
  /** Soma do consumo variável do mês (barras). */
  totalVariableCents: number;
  /** Soma das obrigações que vencem no mês (marcadores). */
  obligationTotalCents: number;
  /** Ex.: `Hoje: R$ 12,00 · Dia típico (Moda): R$ 30,00 · 5 dias acima`. */
  summaryLabel: string;
  ariaLabel: string;
  isEmpty: boolean;
  emptyMessage: string;
  emptyCtaLabel: string;
  emptyCtaHref: string;
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
  const totalVariableCents = days.reduce(
    (total, day) => total + day.variableCents,
    0,
  );
  const obligationTotalCents = days.reduce(
    (total, day) => total + day.obligationCents,
    0,
  );

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
    `consumo total ${formatCents(totalVariableCents)}`,
    typical !== null
      ? `dia típico ${formatCents(typical.cents)} (${typical.label})`
      : "sem consumo variável",
    obligationDays > 0
      ? `${obligationPart} totalizando ${formatCents(obligationTotalCents)}`
      : null,
  ].filter((part): part is string => part !== null);

  return {
    title: CONSUMPTION_CHART_TITLE,
    days,
    maxVariableCents,
    typical,
    typicalPercent,
    todayCents,
    aboveTypicalCount,
    totalVariableCents,
    obligationTotalCents,
    summaryLabel: parts.join(" · "),
    ariaLabel: ariaParts.join("; "),
    isEmpty:
      maxVariableCents === 0 && !days.some((day) => day.obligationCents > 0),
    emptyMessage: CONSUMPTION_CHART_EMPTY_MESSAGE,
    emptyCtaLabel: CONSUMPTION_CHART_EMPTY_CTA_LABEL,
    emptyCtaHref: CONSUMPTION_CHART_EMPTY_CTA_HREF,
  };
}

export const INCOME_ALLOCATION_TITLE = "Para onde vai a renda";
export const INCOME_ALLOCATION_EMPTY_MESSAGE =
  "Sem renda cadastrada neste mês";
export const INCOME_ALLOCATION_EMPTY_CTA_LABEL = "Registrar gastos";
export const INCOME_ALLOCATION_EMPTY_CTA_HREF = "/gastos";

export type IncomeAllocationKey = "fixed" | "card" | "variable" | "remaining";
export type IncomeEntryKey = "fixedIncome" | "variableIncome";

export interface IncomeAllocationEntry {
  key: IncomeEntryKey;
  label: string;
  amountCents: number;
  /** Valor formatado em R$ (ex.: `R$ 800,00`). */
  amountLabel: string;
}

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
  fixedIncomeCents: number;
  variableIncomeCents: number;
  fixedExpensesCents: number;
  cardExpensesCents: number;
  variableExpensesCents: number;
}

export interface IncomeAllocationView {
  title: string;
  /** Entradas decompostas em fixas e variáveis (rótulo + valor formatado). */
  entriesByType: IncomeAllocationEntry[];
  /** Soma das entradas do mês. */
  totalIncomeCents: number;
  /** Renda total formatada (ex.: `R$ 1.000,00`). */
  incomeLabel: string;
  rows: IncomeAllocationRow[];
  /** Consumo disponível = entradas − contas fixas (nunca negativo). */
  consumptionCents: number;
  consumptionLabel: string;
  /** Saldo do mês = entradas − (fixas + fatura + avulsos); negativo ⇒ estouro. */
  balanceCents: number;
  balanceLabel: string;
  /** Consumo (fixas + fatura + avulsos) acima da renda do mês. */
  overspent: boolean;
  overspentLabel: string | null;
  ariaLabel: string;
  isEmpty: boolean;
  emptyMessage: string;
  emptyCtaLabel: string;
  emptyCtaHref: string;
}

/**
 * Composição da renda do mês: as entradas (fixas + variáveis) viram contas
 * fixas, fatura do cartão, gastos avulsos e sobra. Destaca ainda o **consumo
 * disponível** (entradas − fixas, nunca negativo) e o **saldo do mês**
 * (entradas − todas as saídas; negativo ⇒ estouro). Quando o saldo é negativo a
 * linha de sobra some da barra e a mensagem de estouro aparece; as fatias
 * continuam proporcionais ao consumo.
 */
export function buildIncomeAllocationView(
  input: IncomeAllocationInput,
): IncomeAllocationView {
  const fixedIncome = Math.max(input.fixedIncomeCents, 0);
  const variableIncome = Math.max(input.variableIncomeCents, 0);
  const income = Math.max(input.incomeCents, 0);
  const fixed = Math.max(input.fixedExpensesCents, 0);
  const card = Math.max(input.cardExpensesCents, 0);
  const variable = Math.max(input.variableExpensesCents, 0);
  const consumed = fixed + card + variable;
  const remaining = income - consumed;
  const consumption = Math.max(income - fixed, 0);
  const overspent = income > 0 && remaining < 0;
  const base = Math.max(income, consumed, 1);
  const percent = (value: number) => Math.round((value / base) * 100);

  const entriesByType: IncomeAllocationEntry[] = [
    {
      key: "fixedIncome",
      label: "Entradas fixas",
      amountCents: fixedIncome,
      amountLabel: formatCents(fixedIncome),
    },
    {
      key: "variableIncome",
      label: "Entradas variáveis",
      amountCents: variableIncome,
      amountLabel: formatCents(variableIncome),
    },
  ];

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
      label: "Saldo do mês",
      amountCents: remaining,
      percent: percent(remaining),
      barClass: "bg-emerald-500",
    });
  }

  const entriesForAria = entriesByType
    .map((entry) => `${entry.label} ${entry.amountLabel}`)
    .join(", ");
  const rowsForAria = rows
    .map((row) => `${row.label} ${formatCents(row.amountCents)}`)
    .join(", ");
  const ariaLabel = `${INCOME_ALLOCATION_TITLE}: ${entriesForAria}, total de entradas ${formatCents(income)}, ${rowsForAria}, consumo disponível ${formatCents(consumption)}, saldo do mês ${formatCents(remaining)}.`;

  return {
    title: INCOME_ALLOCATION_TITLE,
    entriesByType,
    totalIncomeCents: income,
    incomeLabel: formatCents(income),
    rows,
    consumptionCents: consumption,
    consumptionLabel: formatCents(consumption),
    balanceCents: remaining,
    balanceLabel: formatCents(remaining),
    overspent,
    overspentLabel: overspent
      ? `No vermelho: o consumo passou a renda em ${formatCents(-remaining)}.`
      : null,
    ariaLabel,
    isEmpty: income <= 0,
    emptyMessage: INCOME_ALLOCATION_EMPTY_MESSAGE,
    emptyCtaLabel: INCOME_ALLOCATION_EMPTY_CTA_LABEL,
    emptyCtaHref: INCOME_ALLOCATION_EMPTY_CTA_HREF,
  };
}
