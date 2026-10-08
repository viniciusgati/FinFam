/**
 * View model puro da evolução mensal exibida em `/historico`.
 *
 * Nenhuma função aqui acessa banco ou rede — recebe os snapshots mensais já
 * carregados e devolve as linhas já rotuladas/classificadas, o comparativo por
 * categoria e a visão do gráfico, o que as torna testáveis sem DOM (ver
 * history.test.ts).
 */

import {
  categoryKey,
  categoryLabel,
  NO_CATEGORY_LABEL,
} from "./categories";
import {
  classifyLevel,
  levelLabel,
  monthLabel,
  type FinanceLevel,
} from "./finance";
import { buildFamilyInsights, type FamilyInsight } from "./family-insights";
import { formatCents } from "./money";

/** Gasto do mês em uma categoria, como persistido no snapshot. */
export interface MonthHistoryCategory {
  category: string;
  amountCents: number;
}

/** Campos mínimos de um snapshot mensal para montar a linha de histórico. */
export interface MonthHistorySnapshot {
  monthKey: string;
  incomeCents: number;
  consumedCents: number;
  consumedPercent: number;
  /** Contas fixas do mês (base da ajuda à família). */
  fixedExpensesCents: number;
  /** Consumo disponível do mês (`entradas − gastos fixos`). */
  consumptionAvailableCents: number;
  /** Média diária do consumo disponível no mês. */
  dailyAverageCents: number;
  /** Gastos do mês por categoria. */
  categories: MonthHistoryCategory[];
}

export interface MonthHistoryEntry {
  monthKey: string;
  /** Rótulo pt-BR do mês (ex.: "setembro de 2026"). */
  label: string;
  /** Total gasto no mês, em centavos. */
  totalCents: number;
  /** Percentual da renda consumida, arredondado para exibição. */
  percent: number;
  /** Consumo disponível do mês, em centavos. */
  consumptionAvailableCents: number;
  /** Média diária do consumo disponível, em centavos. */
  dailyAverageCents: number;
  /** Gastos do mês por categoria. */
  categories: MonthHistoryCategory[];
  level: FinanceLevel;
  /** Rótulo textual do nível, legível sem depender da cor. */
  levelLabel: string;
}

/**
 * Monta a linha de cada mês fechado, do mais recente para o mais antigo.
 *
 * O nível reutiliza os limiares do dashboard (`classifyLevel`), usando
 * `ratio = consumedPercent / 100` para os meses já fechados.
 */
export function buildMonthHistory(
  snapshots: MonthHistorySnapshot[],
): MonthHistoryEntry[] {
  return [...snapshots]
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .map((snapshot) => {
      const level = classifyLevel(
        snapshot.consumedPercent / 100,
        snapshot.consumedPercent,
        snapshot.incomeCents,
      );
      return {
        monthKey: snapshot.monthKey,
        label: monthLabel(snapshot.monthKey),
        totalCents: snapshot.consumedCents,
        percent: Math.round(snapshot.consumedPercent),
        consumptionAvailableCents: snapshot.consumptionAvailableCents,
        dailyAverageCents: snapshot.dailyAverageCents,
        categories: snapshot.categories,
        level,
        levelLabel: levelLabel(level),
      };
    });
}

/** Direção da variação de uma categoria em relação ao mês anterior. */
export type CategoryTrend = "maior" | "menor" | "igual";

export interface CategoryComparisonMonth {
  monthKey: string;
  label: string;
}

export interface CategoryComparisonValue {
  monthKey: string;
  /** Valor no mês; `null` quando a categoria não teve gasto (exibe "—"). */
  amountCents: number | null;
  /** Valor formatado em R$ ou "—" quando ausente. */
  amountLabel: string;
}

export interface CategoryComparisonRow {
  categoryKey: string;
  /** Rótulo exibido (`NO_CATEGORY_LABEL` para vazio/ausente). */
  category: string;
  /** Valor em cada mês da janela, na ordem cronológica da coluna. */
  values: CategoryComparisonValue[];
  /** Variação do mês mais recente vs. o anterior; `null` sem par de meses. */
  deltaCents: number | null;
  deltaLabel: string;
  trend: CategoryTrend | null;
}

export interface CategoryComparison {
  /** Meses da janela em ordem cronológica (mais antigo → mais recente). */
  months: CategoryComparisonMonth[];
  rows: CategoryComparisonRow[];
  isEmpty: boolean;
  emptyMessage: string;
}

/** Formata a variação com sinal explícito (`+R$ 1,00` / `-R$ 1,00`). */
function formatDelta(cents: number): string {
  const formatted = formatCents(cents);
  return cents > 0 ? `+${formatted}` : formatted;
}

/**
 * Monta o comparativo por categoria ao longo dos meses da janela.
 *
 * Cada linha cobre uma categoria presente em ≥1 mês, com o valor de cada mês
 * (ausente = `—`, entra como `0` no delta) e a variação do mês mais recente em
 * relação ao anterior. Categorias `null`/`""`/só espaços agrupam em
 * `NO_CATEGORY_LABEL`. Sem snapshots, `months`/`rows` ficam vazios e
 * `isEmpty` é `true`.
 */
export function buildCategoryComparison(
  snapshots: MonthHistorySnapshot[],
): CategoryComparison {
  const ordered = [...snapshots].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
  const months: CategoryComparisonMonth[] = ordered.map((snapshot) => ({
    monthKey: snapshot.monthKey,
    label: monthLabel(snapshot.monthKey),
  }));

  interface Accumulator {
    category: string;
    byMonth: Map<string, number>;
  }
  const byKey = new Map<string, Accumulator>();

  for (const snapshot of ordered) {
    for (const item of snapshot.categories) {
      const label = categoryLabel(item.category);
      const key = categoryKey(label);
      const existing = byKey.get(key);
      const accumulator = existing ?? { category: label, byMonth: new Map() };
      if (!existing) byKey.set(key, accumulator);
      accumulator.byMonth.set(
        snapshot.monthKey,
        (accumulator.byMonth.get(snapshot.monthKey) ?? 0) + item.amountCents,
      );
    }
  }

  const rows: CategoryComparisonRow[] = [...byKey.entries()].map(
    ([key, accumulator]) => {
      const values = months.map((month) => {
        const amount = accumulator.byMonth.get(month.monthKey);
        return {
          monthKey: month.monthKey,
          amountCents: amount ?? null,
          amountLabel: amount === undefined ? "—" : formatCents(amount),
        };
      });

      let deltaCents: number | null = null;
      let trend: CategoryTrend | null = null;
      if (months.length >= 2) {
        const last = months[months.length - 1].monthKey;
        const previous = months[months.length - 2].monthKey;
        deltaCents =
          (accumulator.byMonth.get(last) ?? 0) -
          (accumulator.byMonth.get(previous) ?? 0);
        trend = deltaCents > 0 ? "maior" : deltaCents < 0 ? "menor" : "igual";
      }

      return {
        categoryKey: key,
        category: accumulator.category,
        values,
        deltaCents,
        deltaLabel: deltaCents === null ? "—" : formatDelta(deltaCents),
        trend,
      };
    },
  );

  rows.sort((a, b) => {
    const totalA = a.values.reduce(
      (total, value) => total + (value.amountCents ?? 0),
      0,
    );
    const totalB = b.values.reduce(
      (total, value) => total + (value.amountCents ?? 0),
      0,
    );
    return totalB - totalA || a.category.localeCompare(b.category, "pt-BR");
  });

  return {
    months,
    rows,
    isEmpty: rows.length === 0,
    emptyMessage: HISTORY_NO_CATEGORY_MESSAGE,
  };
}

/** Barra do gráfico de evolução: um mês da janela. */
export interface HistoryChartBar {
  monthKey: string;
  label: string;
  valueCents: number;
  amountLabel: string;
  /** Altura relativa (0..100) ao maior valor da série; 0 quando não há dados. */
  heightPercent: number;
}

export interface HistoryChartView {
  bars: HistoryChartBar[];
  ariaLabel: string;
  /** Aviso textual (`<2 meses` / vazio); `null` quando a série é plena. */
  message: string | null;
  /** `true` quando todos os meses estão zerados (sem dados no período). */
  isEmpty: boolean;
}

/**
 * Monta a visão do gráfico de evolução do total gasto na janela.
 *
 * A ordem das barras é cronológica (mais antigo → mais recente). Todos os meses
 * zerados têm precedência e exibem o vazio (sem `NaN`); com apenas 1 mês a
 * série ainda é exibida, acompanhada do aviso de tendência.
 */
export function historyChartView(
  snapshots: { monthKey: string; totalCents: number }[],
): HistoryChartView {
  const ordered = [...snapshots].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
  const total = ordered.reduce((sum, item) => sum + item.totalCents, 0);
  const max = ordered.reduce((peak, item) => Math.max(peak, item.totalCents), 0);
  const isEmpty = ordered.length === 0 || total === 0;

  const bars: HistoryChartBar[] = ordered.map((item) => ({
    monthKey: item.monthKey,
    label: monthLabel(item.monthKey),
    valueCents: item.totalCents,
    amountLabel: formatCents(item.totalCents),
    heightPercent:
      !isEmpty && max > 0 ? Math.round((item.totalCents / max) * 100) : 0,
  }));

  const ariaLabel = isEmpty
    ? `${HISTORY_CHART_TITLE}: sem dados para exibir no período`
    : `${HISTORY_CHART_TITLE}: ${bars
        .map((bar) => `${bar.label} ${bar.amountLabel}`)
        .join(", ")}`;

  return {
    bars,
    ariaLabel,
    message: isEmpty
      ? HISTORY_CHART_EMPTY_MESSAGE
      : ordered.length < 2
        ? HISTORY_CHART_SINGLE_MONTH_MESSAGE
        : null,
    isEmpty,
  };
}

export interface HistoryViewInput {
  dbError: boolean;
  /** Mês de referência posterior ao corrente (sem dados futuros ainda). */
  isFutureMonth: boolean;
  referenceMonthKey: string;
  snapshots: MonthHistorySnapshot[];
}

/**
 * Estados visíveis de `/historico`, decididos por uma função pura para poderem
 * ser testados sem DOM. "ok", "empty", "error" e "sem categoria" têm textos
 * distintos e explícitos.
 */
export type HistoryViewState =
  | { state: "error"; message: string; retryLabel: string }
  | { state: "future" }
  | {
      state: "empty";
      message: string;
      ctaLabel: string;
      ctaHref: string;
    }
  | {
      state: "ok";
      title: string;
      /** Nome do mês de referência selecionado (ex.: "setembro de 2026"). */
      selectedMonthLabel: string;
      entries: MonthHistoryEntry[];
      chart: HistoryChartView;
      comparison: CategoryComparison;
      /** Insights acionáveis da janela (mês mais recente como referência). */
      insights: FamilyInsight[];
      noCategoryMessage: string;
      comparisonTitle: string;
      tableHeaders: typeof HISTORY_TABLE_HEADERS;
    };

export function historyView(input: HistoryViewInput): HistoryViewState {
  if (input.dbError) {
    return {
      state: "error",
      message: HISTORY_ERROR_MESSAGE,
      retryLabel: HISTORY_RETRY_LABEL,
    };
  }
  if (input.isFutureMonth) return { state: "future" };
  if (input.snapshots.length === 0) {
    return {
      state: "empty",
      message: HISTORY_EMPTY_MESSAGE,
      ctaLabel: HISTORY_EMPTY_CTA_LABEL,
      ctaHref: HISTORY_EMPTY_CTA_HREF,
    };
  }

  const entries = buildMonthHistory(input.snapshots);
  const comparison = buildCategoryComparison(input.snapshots);

  // Ajuda à família: o snapshot mais recente da janela é a referência e os
  // cronologicamente anteriores são a base de comparação. Mês fechado não tem
  // "hoje" (variação diária suprimida).
  const ordered = [...input.snapshots].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
  const reference = ordered[ordered.length - 1];
  const windowSnapshots = ordered.slice(0, -1);
  const insights = buildFamilyInsights({
    referenceMonthKey: reference.monthKey,
    currentCategories: reference.categories,
    windowSnapshots: windowSnapshots.map((snapshot) => ({
      monthKey: snapshot.monthKey,
      categories: snapshot.categories,
      incomeCents: snapshot.incomeCents,
      consumedCents: snapshot.consumedCents,
    })),
    monthlyIncomeCents: reference.incomeCents,
    fixedExpensesCents: reference.fixedExpensesCents,
    todayVariableSpendCents: null,
    dailyReferenceCents: null,
  });

  return {
    state: "ok",
    title: HISTORY_TITLE,
    selectedMonthLabel: monthLabel(input.referenceMonthKey),
    entries,
    chart: historyChartView(
      entries.map((entry) => ({
        monthKey: entry.monthKey,
        totalCents: entry.totalCents,
      })),
    ),
    comparison,
    insights,
    noCategoryMessage: HISTORY_NO_CATEGORY_MESSAGE,
    comparisonTitle: HISTORY_CATEGORY_COMPARISON_TITLE,
    tableHeaders: HISTORY_TABLE_HEADERS,
  };
}

export const HISTORY_TITLE = "Histórico";

/** Estado vazio da janela: nenhum mês fechado anterior registrado. */
export const HISTORY_EMPTY_MESSAGE =
  "Ainda não há meses anteriores registrados.";
export const HISTORY_EMPTY_CTA_LABEL = "Registrar gastos";
export const HISTORY_EMPTY_CTA_HREF = "/gastos";

/** Comparativo sem nenhuma categoria na janela. */
export const HISTORY_NO_CATEGORY_MESSAGE =
  "Sem gastos por categoria na janela.";

/** Estado de erro e rótulos do retry. */
export const HISTORY_ERROR_MESSAGE =
  "Não foi possível carregar seus dados. Tente novamente.";
export const HISTORY_RETRY_LABEL = "Tentar novamente";
export const HISTORY_RETRY_PENDING_LABEL = "Tentando...";

/** Estado de carregamento (skeleton acessível). */
export const HISTORY_LOADING_MESSAGE = "Carregando histórico…";

/** Gráfico de evolução. */
export const HISTORY_CHART_TITLE = "Evolução dos meses";
export const HISTORY_CHART_SINGLE_MONTH_MESSAGE =
  "Registre ao menos 2 meses para ver a tendência.";
export const HISTORY_CHART_EMPTY_MESSAGE = "Sem dados para exibir no período.";

/** Cabeçalhos da tabela de meses. */
export const HISTORY_TABLE_HEADERS = {
  month: "Mês",
  consumption: "Consumo",
  dailyAverage: "Média diária",
  percent: "%",
  total: "Total",
} as const;

/** Título da seção de comparativo por categoria. */
export const HISTORY_CATEGORY_COMPARISON_TITLE = "Comparativo por categoria";

export { NO_CATEGORY_LABEL };
