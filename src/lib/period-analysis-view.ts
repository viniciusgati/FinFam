/**
 * View model do card "Diagnóstico do período".
 *
 * Função pura: transforma o `PeriodAnalysis` em textos exatos e listas já
 * prontas para a apresentação. O componente não monta frase com número — os
 * testes de contrato ficam aqui, sem DOM (mesmo padrão de `historyView` e
 * `categoryBreakdownView`).
 */

import { monthLabel } from "./finance";
import { formatCents } from "./money";
import {
  periodConfidenceLabel,
  surplusTrendLabel,
  type PeriodAnalysis,
  type PeriodAnomalySeverity,
  type PeriodConfidence,
  type PeriodSavingsLeverKind,
} from "./period-analysis";

export type PeriodAnalysisTone = "positive" | "warning" | "neutral";

export interface PeriodMoverView {
  category: string;
  detail: string;
}

export interface PeriodAnomalyView {
  id: string;
  title: string;
  detail: string;
  severity: PeriodAnomalySeverity;
}

export interface PeriodLeverView {
  id: string;
  label: string;
  detail: string;
}

export interface PeriodAnalysisView {
  title: string;
  confidenceLabel: string;
  confidenceTone: PeriodAnalysisTone;
  summaryLabel: string;
  paceLabel: string | null;
  commitmentLabel: string | null;
  categoryMovers: PeriodMoverView[];
  anomalies: PeriodAnomalyView[];
  levers: PeriodLeverView[];
  totalSavingsLabel: string | null;
  dataQualityLabel: string | null;
  isEmpty: boolean;
  emptyMessage: string;
}

export const PERIOD_ANALYSIS_TITLE = "Diagnóstico do período";
export const PERIOD_ANALYSIS_EMPTY_MESSAGE =
  "Ainda não há dados suficientes para o diagnóstico do período.";

const LEVER_LABELS: Record<PeriodSavingsLeverKind, string> = {
  frequency: "Reduzir frequência",
  ticket: "Segurar o ticket",
  subscription: "Revisar assinatura",
  category: "Voltar à base",
};

function confidenceTone(confidence: PeriodConfidence): PeriodAnalysisTone {
  if (confidence === "high") return "positive";
  if (confidence === "medium") return "warning";
  return "neutral";
}

function signedPercent(value: number | null): string {
  if (value === null) return "";
  const sign = value > 0 ? "+" : "";
  return ` (${sign}${value}%)`;
}

function summaryLabel(analysis: PeriodAnalysis): string {
  const months = analysis.flow.closedMonthsCount;
  if (months === 0) {
    return "Ainda não há meses fechados para comparar.";
  }

  const monthWord = months === 1 ? "mês fechado" : "meses fechados";
  const trend = surplusTrendLabel(analysis.flow.trend);
  if (analysis.flow.averageSurplusCents < 0) {
    return (
      `Déficit médio de ${formatCents(
        -analysis.flow.averageSurplusCents,
      )} nos últimos ${months} ${monthWord} · ${trend}.`
    );
  }
  return (
    `Sobra média de ${formatCents(
      analysis.flow.averageSurplusCents,
    )} nos últimos ${months} ${monthWord} · ${trend}.`
  );
}

function paceLabel(analysis: PeriodAnalysis): string | null {
  const pace = analysis.pace;
  if (pace === null) return null;
  if (pace.typicalVariableSpendAtSameDayCents <= 0) {
    return (
      `No dia ${pace.elapsedDay}, o consumo variável foi ` +
      `${formatCents(pace.currentVariableSpendCents)}.`
    );
  }

  if (pace.deltaCents === 0) {
    return (
      `No dia ${pace.elapsedDay}, o consumo variável foi ` +
      `${formatCents(pace.currentVariableSpendCents)}, no ritmo habitual.`
    );
  }

  const direction = pace.deltaCents > 0 ? "acima" : "abaixo";
  const percent = Math.abs(pace.deltaPercent ?? 0);
  return (
    `No dia ${pace.elapsedDay}, o consumo variável foi ` +
    `${formatCents(pace.currentVariableSpendCents)}; ` +
    `${formatCents(Math.abs(pace.deltaCents))} ${direction} do habitual ` +
    `(${percent}%).`
  );
}

function commitmentLabel(analysis: PeriodAnalysis): string | null {
  const parts: string[] = [];
  const commitments = analysis.commitments;

  if (commitments.fixedExpenseCount > 0) {
    parts.push(
      `Contas fixas: ${formatCents(
        commitments.fixedExpensesTotalCents,
      )} (${commitments.fixedCostRatioPercent}% da renda média).`,
    );
  }

  if (commitments.futureInstallmentsPeak !== null) {
    parts.push(
      `Parcelas: pico de ${formatCents(
        commitments.futureInstallmentsPeak.amountCents,
      )} em ${monthLabel(commitments.futureInstallmentsPeak.monthKey)}.`,
    );
  }

  if (
    commitments.fixedBeforeFirstIncomeCents > 0 &&
    commitments.firstIncomeDay !== null
  ) {
    parts.push(
      `${formatCents(
        commitments.fixedBeforeFirstIncomeCents,
      )} vencem antes do dia ${commitments.firstIncomeDay}.`,
    );
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function categoryMovers(analysis: PeriodAnalysis): PeriodMoverView[] {
  return analysis.composition.topMovers.slice(0, 3).map((mover) => {
    const direction = mover.deltaCents >= 0 ? "acima" : "abaixo";
    return {
      category: mover.category,
      detail:
        `${direction} da média em ${formatCents(
          Math.abs(mover.deltaCents),
        )}${signedPercent(mover.deltaPercent)}`,
    };
  });
}

function anomalies(analysis: PeriodAnalysis): PeriodAnomalyView[] {
  return analysis.anomalies.slice(0, 3).map((anomaly) => ({
    id: anomaly.id,
    title: anomaly.title,
    detail: anomaly.detail,
    severity: anomaly.severity,
  }));
}

function levers(analysis: PeriodAnalysis): PeriodLeverView[] {
  return analysis.levers.slice(0, 3).map((lever) => ({
    id: lever.id,
    label: LEVER_LABELS[lever.kind],
    detail: lever.reason,
  }));
}

function totalSavingsLabel(analysis: PeriodAnalysis): string | null {
  // O card exibe no máximo 3 levers; o total precisa refletir exatamente o
  // que está visível para não prometer economia que o usuário não vê.
  const total = analysis.levers
    .slice(0, 3)
    .reduce((sum, lever) => sum + lever.monthlySavingsCents, 0);
  return total > 0
    ? `Cortes sugeridos: ${formatCents(total)}/mês.`
    : null;
}

function dataQualityLabel(analysis: PeriodAnalysis): string | null {
  const parts = [periodConfidenceLabel(analysis.period.confidence)];
  if (analysis.dataQuality.uncategorizedSharePercent > 0) {
    parts.push(
      `${analysis.dataQuality.uncategorizedSharePercent}% sem categoria`,
    );
  }
  if (analysis.dataQuality.creditExpensesWithoutCardCount > 0) {
    parts.push(
      `${analysis.dataQuality.creditExpensesWithoutCardCount} crédito(s) ` +
        "sem cartão",
    );
  }
  return parts.join(" · ");
}

/** Traduz o diagnóstico em textos/listas prontos para o card. */
export function periodAnalysisView(
  analysis: PeriodAnalysis,
): PeriodAnalysisView {
  const isEmpty = analysis.period.monthsCount === 0;
  return {
    title: PERIOD_ANALYSIS_TITLE,
    confidenceLabel: periodConfidenceLabel(analysis.period.confidence),
    confidenceTone: confidenceTone(analysis.period.confidence),
    summaryLabel: summaryLabel(analysis),
    paceLabel: paceLabel(analysis),
    commitmentLabel: commitmentLabel(analysis),
    categoryMovers: categoryMovers(analysis),
    anomalies: anomalies(analysis),
    levers: levers(analysis),
    totalSavingsLabel: totalSavingsLabel(analysis),
    dataQualityLabel: isEmpty ? null : dataQualityLabel(analysis),
    isEmpty,
    emptyMessage: PERIOD_ANALYSIS_EMPTY_MESSAGE,
  };
}
