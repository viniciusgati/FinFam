/**
 * Reconstrução do mês fechado a partir do snapshot persistido.
 *
 * Função pura: nenhuma consulta a banco/rede. O dashboard de um mês fechado lê
 * tudo daqui — agregados, série diária, consumo disponível e categorias — para
 * que editar/desativar dados hoje **não** mude o passado. O mês corrente segue
 * calculado ao vivo.
 */

import type { CategoryBreakdown } from "./category-breakdown";
import {
  buildConsumptionSummary,
  type ConsumptionSummary,
  type DailySeries,
} from "./dashboard-series";
import type { FinanceInput } from "./finance";
import type { MonthlySnapshotData } from "./snapshots";

/**
 * `true` quando o snapshot tem os campos que só passaram a existir com a série
 * diária (migração `add_snapshot_month_series`). Capturas antigas ou seeds não
 * têm e caem no cálculo ao vivo até um `db:snapshots --force`.
 */
export function isCompleteSnapshot(
  snapshot: Pick<
    MonthlySnapshotData,
    | "incomeCents"
    | "fixedIncomeCents"
    | "variableIncomeCents"
    | "daysInMonth"
    | "variableDailyCents"
    | "obligationDailyCents"
  >,
): boolean {
  if (snapshot.daysInMonth <= 0) return false;
  if (snapshot.variableDailyCents.length !== snapshot.daysInMonth) return false;
  if (snapshot.obligationDailyCents.length !== snapshot.daysInMonth) {
    return false;
  }
  return (
    snapshot.fixedIncomeCents + snapshot.variableIncomeCents ===
    snapshot.incomeCents
  );
}

/** Dados do mês fechado prontos para o dashboard (sem comparação histórica). */
export interface SnapshotMonthData extends FinanceInput {
  fixedIncomeCents: number;
  variableIncomeCents: number;
  hasMovements: boolean;
  series: DailySeries;
  consumption: ConsumptionSummary;
  categoryBreakdown: CategoryBreakdown;
}

/**
 * Monta os dados de exibição de um mês fechado a partir do snapshot imutável.
 *
 * Invariante: a série reconstruída fecha com `consumedCents`; `elapsedDay` é o
 * mês inteiro (mês fechado) e não há janela de ciclo (`cycleDays: null`).
 */
export function buildDashboardDataFromSnapshot(
  snapshot: MonthlySnapshotData,
  referenceDate: Date,
): SnapshotMonthData {
  const dailyExpensesCents = snapshot.variableDailyCents.map(
    (value, index) => value + (snapshot.obligationDailyCents[index] ?? 0),
  );
  const cumulativeExpensesCents: number[] = [];
  let running = 0;
  for (const value of dailyExpensesCents) {
    running += value;
    cumulativeExpensesCents.push(running);
  }

  const series: DailySeries = {
    daysInMonth: snapshot.daysInMonth,
    elapsedDay: snapshot.daysInMonth,
    dailyExpensesCents,
    cumulativeExpensesCents,
    variableDailyCents: snapshot.variableDailyCents,
    obligationDailyCents: snapshot.obligationDailyCents,
    entriesCents: snapshot.incomeCents,
    totalExpensesCents: snapshot.consumedCents,
    dailyBudgetCents:
      snapshot.daysInMonth > 0
        ? Math.round(snapshot.incomeCents / snapshot.daysInMonth)
        : 0,
    projectedMonthEndCents: snapshot.consumedCents,
  };

  const consumption = buildConsumptionSummary({
    incomeCents: snapshot.incomeCents,
    fixedExpensesCents: snapshot.fixedExpensesCents,
    daysInMonth: snapshot.daysInMonth,
    daysElapsed: snapshot.daysInMonth,
    cycleDays: null,
  });

  const items = snapshot.categories
    .filter((item) => item.amountCents > 0)
    .map((item) => ({
      category: item.category,
      amountCents: item.amountCents,
    }))
    .sort(
      (a, b) =>
        b.amountCents - a.amountCents ||
        a.category.localeCompare(b.category, "pt-BR"),
    );

  return {
    monthlyIncomeCents: snapshot.incomeCents,
    fixedIncomeCents: snapshot.fixedIncomeCents,
    variableIncomeCents: snapshot.variableIncomeCents,
    fixedExpensesCents: snapshot.fixedExpensesCents,
    variableExpensesCents: snapshot.variableExpensesCents,
    cardExpensesCents: snapshot.cardExpensesCents,
    hasMovements:
      snapshot.fixedExpensesCents > 0 ||
      snapshot.variableExpensesCents > 0 ||
      snapshot.cardExpensesCents > 0 ||
      snapshot.variableIncomeCents > 0,
    series,
    consumption,
    categoryBreakdown: {
      monthKey: snapshot.monthKey,
      items,
      totalCents: snapshot.consumedCents,
    },
    referenceDate,
  };
}
