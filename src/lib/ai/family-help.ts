/**
 * Ajuda à família via IA (opcional) com fallback local determinístico.
 *
 * A DeepSeek recebe **apenas números anônimos** — nunca rótulos de categoria,
 * descrições ou qualquer texto do usuário (suposição 7 da história #258). O
 * `user` do prompt é o `JSON.stringify` de {@link FamilyHelpData}; sem chave ou
 * em falha, o card cai no texto local de {@link localFamilyHelp}.
 */

import { usualDailySpendCents } from "../cycle";
import {
  categoryAlerts,
  comparableMonths,
  type FamilyCategoryAmount,
  type FamilyInsightInput,
  type FamilyInsightSnapshot,
} from "../family-insights";
import { computeFinanceStatus } from "../finance";
import type { ChatMessage } from "./deepseek";

/** Agregado numérico anônimo completo do ciclo enviado à IA. */
export interface FamilyHelpData {
  monthlyIncomeCents: number;
  fixedIncomeCents: number;
  variableIncomeCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  consumedCents: number;
  consumedPercent: number;
  projectedCents: number;
  projectedPercent: number;
  daysInWindow: number;
  elapsedDays: number;
  remainingDays: number;
  freeBudgetCents: number;
  dailyCents: number;
  /** `1` quando as contas fixas cobrem/ultrapassam a renda; `0` caso contrário. */
  overCommitted: number;
  /** Nº de meses **válidos** da janela (entrada e saída). */
  windowSnapshotCount: number;
  todayVariableSpendCents: number;
  dailyReferenceCents: number;
  /** `hoje ÷ referência` arredondado; `0` sem referência. */
  dailyVariationFactor: number;
  /** Desvios percentuais anônimos das categorias (sem rótulos). */
  categoryDeviationPercents: number[];
}

/** Input do motor de insights + agregados do ciclo usados pela IA de ajuda. */
export interface FamilyHelpInput extends FamilyInsightInput {
  fixedIncomeCents: number;
  variableIncomeCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  consumedCents: number;
  consumedPercent: number;
  projectedCents: number;
  projectedPercent: number;
  daysInWindow: number;
  elapsedDays: number;
  remainingDays: number;
  freeBudgetCents: number;
  dailyCents: number;
}

/** Dados do dashboard necessários para montar o input da ajuda à família. */
export interface FamilyHelpSource {
  referenceMonthKey: string;
  isCurrentCycle: boolean;
  data: {
    monthlyIncomeCents: number;
    fixedIncomeCents: number;
    variableIncomeCents: number;
    fixedExpensesCents: number;
    variableExpensesCents: number;
    cardExpensesCents: number;
    categoryBreakdown: { items: FamilyCategoryAmount[] };
    snapshots: FamilyInsightSnapshot[];
    series: {
      daysInMonth: number;
      elapsedDay: number;
      variableDailyCents: number[];
    };
    consumption: { dailyByMonthCents: number };
    referenceDate?: Date;
    periodDays?: number;
    elapsedDays?: number;
    cardExpensesVariable?: boolean;
  };
}

/**
 * Construtor único do input da ajuda à família, usado pela página e pela rota
 * `/api/ai/family-help`. Assim a referência diária e o gasto de hoje vêm da
 * mesma janela do ciclo (antes a rota usava a média do orçamento e a página o
 * ritmo recente).
 */
export function buildFamilyInsightInput(
  source: FamilyHelpSource,
): FamilyHelpInput {
  const data = source.data;
  const status = computeFinanceStatus(data);
  const variableExpenses = Math.max(data.variableExpensesCents, 0);
  const cardExpenses = Math.max(data.cardExpensesCents, 0);
  const variableConsumedCents = variableExpenses + cardExpenses;
  const elapsedDays = data.series.elapsedDay;
  const daysInWindow = data.series.daysInMonth;

  const todayVariableSpendCents =
    source.isCurrentCycle && elapsedDays > 0
      ? (data.series.variableDailyCents[elapsedDays - 1] ?? 0)
      : null;
  const dailyReferenceCents = source.isCurrentCycle
    ? (usualDailySpendCents({
        variableSpentCents: variableConsumedCents,
        cardExpensesCents: 0,
        elapsedDays,
      }) ?? data.consumption.dailyByMonthCents)
    : null;

  const variableBudgetCents = Math.max(
    data.monthlyIncomeCents - data.fixedExpensesCents,
    0,
  );
  const freeBudgetCents = Math.max(
    variableBudgetCents - variableConsumedCents,
    0,
  );
  const remainingDays = Math.max(daysInWindow - elapsedDays, 0);
  const dailyCents =
    remainingDays > 0
      ? Math.round(freeBudgetCents / remainingDays)
      : Math.round(freeBudgetCents);

  return {
    referenceMonthKey: source.referenceMonthKey,
    currentCategories: data.categoryBreakdown.items,
    windowSnapshots: data.snapshots,
    monthlyIncomeCents: data.monthlyIncomeCents,
    fixedExpensesCents: data.fixedExpensesCents,
    todayVariableSpendCents,
    dailyReferenceCents,
    fixedIncomeCents: data.fixedIncomeCents,
    variableIncomeCents: data.variableIncomeCents,
    variableExpensesCents: data.variableExpensesCents,
    cardExpensesCents: data.cardExpensesCents,
    consumedCents: status.consumedCents,
    consumedPercent: Math.round(status.consumedPercent * 100) / 100,
    projectedCents: status.projectedCents,
    projectedPercent: Math.round(status.projectedPercent * 100) / 100,
    daysInWindow,
    elapsedDays,
    remainingDays,
    freeBudgetCents,
    dailyCents,
  };
}

/** Deriva o agregado anônimo do mesmo input do motor puro de insights. */
export function buildFamilyHelpData(
  input: FamilyHelpInput,
): FamilyHelpData {
  const reference = input.dailyReferenceCents ?? 0;
  const today = input.todayVariableSpendCents ?? 0;

  return {
    monthlyIncomeCents: input.monthlyIncomeCents,
    fixedIncomeCents: input.fixedIncomeCents,
    variableIncomeCents: input.variableIncomeCents,
    fixedExpensesCents: input.fixedExpensesCents,
    variableExpensesCents: input.variableExpensesCents,
    cardExpensesCents: input.cardExpensesCents,
    consumedCents: input.consumedCents,
    consumedPercent: input.consumedPercent,
    projectedCents: input.projectedCents,
    projectedPercent: input.projectedPercent,
    daysInWindow: input.daysInWindow,
    elapsedDays: input.elapsedDays,
    remainingDays: input.remainingDays,
    freeBudgetCents: input.freeBudgetCents,
    dailyCents: input.dailyCents,
    overCommitted:
      input.fixedExpensesCents >= input.monthlyIncomeCents ? 1 : 0,
    windowSnapshotCount: comparableMonths(input.windowSnapshots).length,
    todayVariableSpendCents: today,
    dailyReferenceCents: reference,
    dailyVariationFactor:
      reference > 0 ? Math.round((today / reference) * 100) / 100 : 0,
    categoryDeviationPercents: categoryAlerts(
      input.currentCategories,
      input.windowSnapshots,
    ).map((alert) => alert.percentAbove),
  };
}

const SYSTEM_PROMPT =
  "Você é um assistente financeiro familiar. Com base apenas nos agregados " +
  "numéricos fornecidos (em centavos), escreva em português do Brasil um " +
  "parágrafo curto (até 3 frases) com uma orientação prática para a família. " +
  "Não invente dados nem cite nomes, categorias, descrições ou qualquer texto.";

/** Mensagens para a DeepSeek: o conteúdo do usuário contém apenas números. */
export function buildFamilyHelpPrompt(data: FamilyHelpData): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(data) },
  ];
}

export const FAMILY_HELP_INCOME_SHORTFALL_TEXT =
  "As contas fixas deste mês consomem toda a renda. Reveja as contas fixas ou procure uma entrada extra.";
export const FAMILY_HELP_UNAVAILABLE_TEXT =
  "No momento, a ajuda automática está indisponível. Use os avisos acima para decidir seu próximo passo.";

/** Textos fixados do botão/estados do card. */
export const FAMILY_HELP_BUTTON_LABEL = "Gerar resumo da IA";
export const FAMILY_HELP_BUTTON_LOADING_LABEL = "Gerando resumo…";
export const FAMILY_HELP_LOADING_MESSAGE = "Gerando resumo com IA…";
export const FAMILY_HELP_ERROR_MESSAGE =
  "Resumo por IA indisponível no momento";

/**
 * Texto local determinístico exibido quando a IA está indisponível. Renda
 * insuficiente tem um recado próprio; caso geral, o aviso de indisponibilidade.
 */
export function localFamilyHelp(data: FamilyHelpData): string {
  return data.fixedExpensesCents >= data.monthlyIncomeCents
    ? FAMILY_HELP_INCOME_SHORTFALL_TEXT
    : FAMILY_HELP_UNAVAILABLE_TEXT;
}
