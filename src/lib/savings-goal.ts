/**
 * Meta de economia por ciclo (história #366).
 *
 * Funções puras usadas pela prévia em Configurações e pelo card de progresso
 * do dashboard. Nenhuma função aqui acessa banco, rede ou `Date.now()` — a
 * janela do ciclo e os dias restantes vêm do chamador.
 *
 * Definições (SPEC):
 * - a meta é por ciclo financeiro e `null`/`0` significam "sem meta";
 * - o guardado é **estimado** pelo orçamento variável não consumido do ciclo,
 *   nunca um valor efetivamente transferido;
 * - a prévia diária usa `round(meta / dias_da_janela)`;
 * - o "por dia restante" usa `ceil(restante / dias_restantes)`, e com zero
 *   dias restantes mostra o restante integral.
 */

import { formatCents } from "./money";

export interface SavingsGoalProgressInput {
  /** Meta do ciclo em centavos; `null`/`0` desligam o acompanhamento. */
  goalCents: number | null;
  /** Guardado estimado do ciclo em centavos. */
  savedCents: number;
  /** Dias restantes da janela do ciclo (0 = último dia). */
  remainingDays: number;
}

export interface SavingsGoalProgress {
  goalCents: number;
  savedCents: number;
  /** Falta para atingir a meta, nunca negativo. */
  remainingCents: number;
  /** Quanto ainda precisa guardar por dia restante, nunca `Infinity`/`NaN`. */
  dailyRemainingCents: number;
  /** Progresso de 0 a 100. */
  percent: number;
  achieved: boolean;
}

/**
 * Texto da prévia em Configurações: `Sua meta equivale a R$ X por dia.`
 * `windowDays` é a janela do ciclo corrente (ou os dias do mês calendário).
 */
export function savingsGoalPreview(goalCents: number, windowDays: number): string {
  const days = windowDays > 0 ? windowDays : 1;
  const dailyCents = Math.round(goalCents / days);
  return `Sua meta equivale a ${formatCents(dailyCents)} por dia.`;
}

/**
 * Progresso da meta do ciclo. Retorna `null` quando não há meta (`null` ou
 * `0`), para o card não ser renderizado.
 */
export function savingsGoalProgress({
  goalCents,
  savedCents,
  remainingDays,
}: SavingsGoalProgressInput): SavingsGoalProgress | null {
  if (goalCents === null || goalCents <= 0) return null;

  const saved = Math.max(savedCents, 0);
  const remainingCents = Math.max(goalCents - saved, 0);
  const dailyRemainingCents =
    remainingDays > 0 ? Math.ceil(remainingCents / remainingDays) : remainingCents;
  const percent = Math.min(100, Math.max(0, Math.round((saved / goalCents) * 100)));
  const achieved = saved >= goalCents;

  return {
    goalCents,
    savedCents: saved,
    remainingCents,
    dailyRemainingCents,
    percent,
    achieved,
  };
}
