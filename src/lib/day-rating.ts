/**
 * Avaliação determinística do dia (heurística, sem LLM).
 *
 * Reutiliza `classifyLevel`/`levelLabel` para manter o mesmo vocabulário do
 * dashboard. Nenhuma função aqui acessa banco ou rede.
 */

import {
  classifyLevel,
  levelLabel,
  type FinanceLevel,
} from "./finance";

export interface RateDayInput {
  /** Orçamento diário disponível (`renda / dias no mês`), em centavos. */
  dailyBudgetCents: number;
  /** Gasto de hoje, em centavos. */
  todayExpensesCents: number;
  /** Renda mensal, em centavos. */
  incomeCents: number;
}

export interface DayRating {
  level: FinanceLevel;
  label: string;
}

/**
 * Classifica o dia.
 *
 * Sem renda (ou orçamento diário não positivo) não há como avaliar: `neutral`.
 * Dentro do orçamento do dia → `green` ("Ok"). Acima, escala por
 * `classifyLevel`, garantindo no mínimo `yellow` ("Cuidado").
 */
export function rateDay(input: RateDayInput): DayRating {
  if (input.incomeCents <= 0 || input.dailyBudgetCents <= 0) {
    return { level: "neutral", label: levelLabel("neutral") };
  }

  const ratio = input.todayExpensesCents / input.dailyBudgetCents;
  const level: FinanceLevel =
    ratio <= 1 ? "green" : classifyLevel(ratio, 0, input.incomeCents);

  return { level, label: levelLabel(level) };
}
