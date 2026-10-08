/**
 * Ajuda à família via IA (opcional) com fallback local determinístico.
 *
 * A DeepSeek recebe **apenas números anônimos** — nunca rótulos de categoria,
 * descrições ou qualquer texto do usuário (suposição 7 da história #258). O
 * `user` do prompt é o `JSON.stringify` de {@link FamilyHelpData}; sem chave ou
 * em falha, o card cai no texto local de {@link localFamilyHelp}.
 */

import {
  categoryAlerts,
  comparableMonths,
  type FamilyInsightInput,
} from "../family-insights";
import type { ChatMessage } from "./deepseek";

/** Agregado numérico anônimo enviado à IA. */
export interface FamilyHelpData {
  monthlyIncomeCents: number;
  fixedExpensesCents: number;
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

/** Deriva o agregado anônimo do mesmo input do motor puro de insights. */
export function buildFamilyHelpData(
  input: FamilyInsightInput,
): FamilyHelpData {
  const reference = input.dailyReferenceCents ?? 0;
  const today = input.todayVariableSpendCents ?? 0;

  return {
    monthlyIncomeCents: input.monthlyIncomeCents,
    fixedExpensesCents: input.fixedExpensesCents,
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
