/**
 * Narrativa por IA do diagnóstico de período.
 *
 * O motor determinístico (`period-analysis.ts`) calcula tudo; este módulo só
 * monta o **fact sheet** enviado à DeepSeek, valida a resposta JSON e oferece
 * um fallback local. Privacidade: o fact sheet **não** carrega nomes de
 * estabelecimentos, descrições, nomes de contas fixas ou metas — apenas
 * números, rótulos de categoria (mesma exceção da classificação de fatura) e
 * identificadores opacos (`lever-0`, `anomaly-1`, `category-...`).
 */

import { z } from "zod";
import { categoryKey } from "../categories";
import {
  type PeriodAnalysis,
  type PeriodCategoryAnalysis,
  type PeriodAnomalyKind,
  type PeriodAnomalySeverity,
  type PeriodSavingsLeverKind,
} from "../period-analysis";
import { periodAnalysisView } from "../period-analysis-view";
import type { ChatMessage } from "./deepseek";

export interface PeriodAiCategoryFact {
  id: string;
  label: string;
  currentCents: number;
  averageCents: number;
  deltaCents: number;
  deltaPercent: number | null;
  shareOfConsumedPercent: number;
}

export interface PeriodAiAnomalyFact {
  id: string;
  kind: PeriodAnomalyKind;
  severity: PeriodAnomalySeverity;
  amountCents?: number;
  deltaPercent?: number;
  monthKey?: string;
}

export interface PeriodAiLeverFact {
  id: string;
  kind: PeriodSavingsLeverKind;
  category?: string;
  monthlySavingsCents: number;
  currentMonthlyCount?: number;
  currentAverageTicketCents?: number;
  proposedReduction?: number;
}

export interface PeriodAiFacts {
  period: {
    from: string;
    to: string;
    monthsCount: number;
    closedMonthsCount: number;
    confidence: "low" | "medium" | "high";
  };
  flow: {
    averageIncomeCents: number;
    averageConsumedCents: number;
    averageSurplusCents: number;
    medianSurplusCents: number;
    savingsRatePercent: number;
    positiveMonths: number;
    negativeMonths: number;
    trend: string;
    trendDeltaCents: number;
  };
  pace: {
    elapsedDay: number;
    daysInPeriod: number;
    currentVariableSpendCents: number;
    typicalVariableSpendAtSameDayCents: number;
    deltaCents: number;
    deltaPercent: number | null;
    projectedConsumedPercent: number;
  } | null;
  composition: {
    fixedSharePercent: number;
    variableSharePercent: number;
    cardSharePercent: number;
    fixedCostRatioPercent: number;
    uncategorizedSharePercent: number;
    categories: PeriodAiCategoryFact[];
  };
  commitments: {
    fixedExpensesTotalCents: number;
    fixedExpenseCount: number;
    fixedCostRatioPercent: number;
    dueDayBuckets: { label: string; count: number; amountCents: number }[];
    firstIncomeDay: number | null;
    fixedBeforeFirstIncomeCents: number;
    futureInstallmentsPeak: {
      monthKey: string;
      amountCents: number;
    } | null;
    futureInstallmentsTotalCents: number;
    installmentPurchasesSharePercent: number;
    cards: {
      id: string;
      futureCents: number;
      limitUsagePercent: number | null;
    }[];
  };
  anomalies: PeriodAiAnomalyFact[];
  levers: PeriodAiLeverFact[];
  dataQuality: {
    confidence: "low" | "medium" | "high";
    uncategorizedSharePercent: number;
    creditExpensesWithoutCardCount: number;
  };
  reserve: {
    confirmedCents: number;
    emergencyTargetCents: number;
    coverageMonths: number | null;
    gapCents: number | null;
    monthsToTarget: number | null;
    targetMonths: number;
  } | null;
}

export interface PeriodAiFactSheet {
  facts: PeriodAiFacts;
  factIds: string[];
}

export interface PeriodAiAction {
  factId: string;
  text: string;
}

export interface PeriodAiNarrative {
  summary: string;
  actions: PeriodAiAction[];
}

const responseSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  actions: z
    .array(
      z.object({
        factId: z.string().trim().min(1),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .max(3)
    .default([]),
});

function uniqueCategoryFacts(
  analysis: PeriodAnalysis,
): PeriodCategoryAnalysis[] {
  const byKey = new Map<string, PeriodCategoryAnalysis>();
  for (const category of [
    ...analysis.composition.topCategories,
    ...analysis.composition.topMovers,
  ]) {
    byKey.set(categoryKey(category.category), category);
  }
  return [...byKey.values()].slice(0, 8);
}

/**
 * Monta o fact sheet anônimo. Nenhum nome de merchant/conta/meta entra aqui;
 * categorias são rótulos definidos pela família (exceção de privacidade
 * documentada na SPEC §7).
 */
export function buildPeriodAiFactSheet(
  analysis: PeriodAnalysis,
): PeriodAiFactSheet {
  const categories: PeriodAiCategoryFact[] = uniqueCategoryFacts(analysis).map(
    (category) => ({
      id: `category-${categoryKey(category.category)}`,
      label: category.category,
      currentCents: category.currentCents,
      averageCents: category.averageCents,
      deltaCents: category.deltaCents,
      deltaPercent: category.deltaPercent,
      shareOfConsumedPercent: category.shareOfConsumedPercent,
    }),
  );

  const anomalies: PeriodAiAnomalyFact[] = analysis.anomalies.map(
    (anomaly, index) => ({
      id: `anomaly-${index}`,
      kind: anomaly.kind,
      severity: anomaly.severity,
      amountCents: anomaly.amountCents,
      deltaPercent: anomaly.deltaPercent,
      monthKey: anomaly.monthKey,
    }),
  );

  const levers: PeriodAiLeverFact[] = analysis.levers.map((lever, index) => ({
    id: `lever-${index}`,
    kind: lever.kind,
    category: lever.category,
    monthlySavingsCents: lever.monthlySavingsCents,
    currentMonthlyCount: lever.currentMonthlyCount,
    currentAverageTicketCents: lever.currentAverageTicketCents,
    proposedReduction: lever.proposedReduction,
  }));

  const facts: PeriodAiFacts = {
    period: {
      from: analysis.period.from,
      to: analysis.period.to,
      monthsCount: analysis.period.monthsCount,
      closedMonthsCount: analysis.period.closedMonthsCount,
      confidence: analysis.period.confidence,
    },
    flow: {
      averageIncomeCents: analysis.flow.averageIncomeCents,
      averageConsumedCents: analysis.flow.averageConsumedCents,
      averageSurplusCents: analysis.flow.averageSurplusCents,
      medianSurplusCents: analysis.flow.medianSurplusCents,
      savingsRatePercent: analysis.flow.savingsRatePercent,
      positiveMonths: analysis.flow.positiveMonths,
      negativeMonths: analysis.flow.negativeMonths,
      trend: analysis.flow.trend,
      trendDeltaCents: analysis.flow.trendDeltaCents,
    },
    pace:
      analysis.pace === null
        ? null
        : {
            elapsedDay: analysis.pace.elapsedDay,
            daysInPeriod: analysis.pace.daysInPeriod,
            currentVariableSpendCents:
              analysis.pace.currentVariableSpendCents,
            typicalVariableSpendAtSameDayCents:
              analysis.pace.typicalVariableSpendAtSameDayCents,
            deltaCents: analysis.pace.deltaCents,
            deltaPercent: analysis.pace.deltaPercent,
            projectedConsumedPercent:
              analysis.pace.projectedConsumedPercent,
          },
    composition: {
      fixedSharePercent: analysis.composition.fixedSharePercent,
      variableSharePercent: analysis.composition.variableSharePercent,
      cardSharePercent: analysis.composition.cardSharePercent,
      fixedCostRatioPercent: analysis.composition.fixedCostRatioPercent,
      uncategorizedSharePercent:
        analysis.composition.uncategorizedSharePercent,
      categories,
    },
    commitments: {
      fixedExpensesTotalCents: analysis.commitments.fixedExpensesTotalCents,
      fixedExpenseCount: analysis.commitments.fixedExpenseCount,
      fixedCostRatioPercent: analysis.commitments.fixedCostRatioPercent,
      dueDayBuckets: analysis.commitments.dueDayBuckets.map((bucket) => ({
        label: bucket.label,
        count: bucket.count,
        amountCents: bucket.amountCents,
      })),
      firstIncomeDay: analysis.commitments.firstIncomeDay,
      fixedBeforeFirstIncomeCents:
        analysis.commitments.fixedBeforeFirstIncomeCents,
      futureInstallmentsPeak:
        analysis.commitments.futureInstallmentsPeak === null
          ? null
          : {
              monthKey:
                analysis.commitments.futureInstallmentsPeak.monthKey,
              amountCents:
                analysis.commitments.futureInstallmentsPeak.amountCents,
            },
      futureInstallmentsTotalCents:
        analysis.commitments.futureInstallmentsTotalCents,
      installmentPurchasesSharePercent:
        analysis.commitments.installmentPurchasesSharePercent,
      cards: analysis.commitments.cards.map((card, index) => ({
        id: `card-${index}`,
        futureCents: card.futureCents,
        limitUsagePercent: card.limitUsagePercent,
      })),
    },
    anomalies,
    levers,
    dataQuality: {
      confidence: analysis.dataQuality.confidence,
      uncategorizedSharePercent:
        analysis.dataQuality.uncategorizedSharePercent,
      creditExpensesWithoutCardCount:
        analysis.dataQuality.creditExpensesWithoutCardCount,
    },
    reserve:
      analysis.reserve.confirmedCents === null
        ? null
        : {
            confirmedCents: analysis.reserve.confirmedCents,
            emergencyTargetCents:
              analysis.reserve.emergencyTargetCents,
            coverageMonths: analysis.reserve.coverageMonths,
            gapCents: analysis.reserve.gapCents,
            monthsToTarget: analysis.reserve.monthsToTarget,
            targetMonths: analysis.reserve.targetMonths,
          },
  };

  const factIds: string[] = [
    "period",
    "flow",
    "composition",
    "commitments",
    "data-quality",
    ...(facts.pace === null ? [] : ["pace"]),
    ...(facts.reserve === null ? [] : ["reserve"]),
    ...categories.map((category) => category.id),
    ...anomalies.map((anomaly) => anomaly.id),
    ...levers.map((lever) => lever.id),
  ];

  return { facts, factIds };
}

const SYSTEM_PROMPT =
  "Você é um planejador financeiro familiar. Receba o diagnóstico determinístico " +
  "de um ciclo financeiro (valores em centavos) e escreva em português do Brasil " +
  "um resumo de até 4 frases e até 3 ações priorizadas. Use apenas os fatos e " +
  "factIds fornecidos. Não invente números, nomes, estabelecimentos, categorias " +
  "ou descrições; não recomende produtos financeiros. Se a confiança da base for " +
  "baixa, diga isso. Prioridade: (1) déficit/estouro; (2) ações com maior " +
  "economia mensal; (3) parcelas/compromissos; (4) qualidade dos dados. Cada ação " +
  "deve citar um factId existente e ser específica, com número quando houver. " +
  "Responda somente com um objeto JSON no formato " +
  '{"summary":"string","actions":[{"factId":"string","text":"string"}]}.';

/** Mensagens da DeepSeek: o conteúdo do usuário é apenas o fact sheet anônimo. */
export function buildPeriodAiPrompt(
  factSheet: PeriodAiFactSheet,
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        facts: factSheet.facts,
        factIds: factSheet.factIds,
      }),
    },
  ];
}

function stripCodeFences(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/**
 * Valida a resposta da IA. Ações com `factId` fora da lista são descartadas
 * (não invalidam o resumo); JSON inválido, resumo vazio ou mais de 3 ações
 * devolvem `null` para o chamador cair no fallback local.
 */
export function parsePeriodAiNarrative(
  content: string,
  factIds: string[],
): PeriodAiNarrative | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(content));
  } catch {
    return null;
  }

  const result = responseSchema.safeParse(parsed);
  if (!result.success) return null;

  const allowed = new Set(factIds);
  return {
    summary: result.data.summary,
    actions: result.data.actions
      .filter((action) => allowed.has(action.factId))
      .slice(0, 3),
  };
}

/**
 * Fallback determinístico: reaproveita os textos do card e os cortes já
 * calculados. Pode citar merchants porque roda localmente — não vai à IA.
 */
export function localPeriodAiNarrative(
  analysis: PeriodAnalysis,
): PeriodAiNarrative {
  const view = periodAnalysisView(analysis);
  const summary = view.isEmpty
    ? view.emptyMessage
    : [
        view.summaryLabel,
        view.paceLabel,
        view.commitmentLabel,
        view.totalSavingsLabel,
      ]
        .filter((part): part is string => part !== null)
        .join(" ");

  return {
    summary,
    actions: view.levers.map((lever, index) => ({
      factId: `lever-${index}`,
      text: lever.detail,
    })),
  };
}
