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
  /**
   * Orçamento diário livre de obrigações (`max(renda − saídas fixas − faturas,
   * 0) / dias no mês`), em centavos.
   */
  dailyFreeBudgetCents: number;
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
 * Sem renda cadastrada não há como avaliar: `neutral`. Com renda, mas sem
 * orçamento livre (obrigações consumiram tudo), o dia é `red` ("Crítico"),
 * alinhado a `computeFinanceStatus`. Dentro do orçamento livre do dia →
 * `green` ("Ok"). Acima, escala por `classifyLevel`.
 */
export function rateDay(input: RateDayInput): DayRating {
  if (input.incomeCents <= 0) {
    return { level: "neutral", label: levelLabel("neutral") };
  }

  if (input.dailyFreeBudgetCents <= 0) {
    return { level: "red", label: levelLabel("red") };
  }

  const ratio = input.todayExpensesCents / input.dailyFreeBudgetCents;
  const level: FinanceLevel =
    ratio <= 1 ? "green" : classifyLevel(ratio, 0, input.incomeCents);

  return { level, label: levelLabel(level) };
}
