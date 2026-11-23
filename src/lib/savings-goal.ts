/**
 * Meta de economia por ciclo (história #366).
 *
 * Funções puras usadas pela prévia em Configurações e pelo card de progresso
 * do dashboard. Nenhuma função aqui acessa banco, rede ou `Date.now()` — a
 * janela do ciclo e os dias restantes vêm do chamador.
 *
 * Definições (SPEC):
 * - a meta é por ciclo financeiro e `null`/`0` significam "sem meta";
 * - o guardado é **realizado até hoje**: o que sobraria do orçamento variável
 *   proporcional aos dias decorridos, descontado o consumo variável real
 *   (`G = max(0, round(B × dias_decorridos / dias_da_janela) − consumo)` com
 *   `B = max(renda − fixas, 0)`), nunca o orçamento variável inteiro;
 * - a prévia diária usa `round(meta / dias_da_janela)`;
 * - o "por dia restante" usa `ceil(restante / dias_restantes)`, e com zero
 *   dias restantes mostra o restante integral.
 */

import { formatCents, parseAmountToCents } from "./money";

export interface SavingsGoalProgressInput {
  /** Meta do ciclo em centavos; `null`/`0` desligam o acompanhamento. */
  goalCents: number | null;
  /** Guardado **realizado** até hoje em centavos (não o orçamento livre). */
  savedCents: number;
  /** Dias restantes da janela do ciclo (0 = último dia). */
  remainingDays: number;
}

export interface SavingsGoalSavedInput {
  /** Renda do ciclo em centavos. */
  incomeCents: number;
  /** Saídas fixas do ciclo em centavos. */
  fixedExpensesCents: number;
  /** Consumo variável já realizado no ciclo em centavos. */
  variableSpentCents: number;
  /** Dias decorridos da janela (o dia de hoje conta). */
  elapsedDays: number;
  /** Tamanho da janela do ciclo em dias. */
  windowDays: number;
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
 * Converte o texto digitado no campo de meta (reais) para centavos inteiros.
 *
 * - Vazio (ou só espaços) ⇒ `null` ("sem meta").
 * - `0`, `0,00` etc. ⇒ `0` (também "sem meta", aceito pela API).
 * - Valor positivo em pt-BR (`1.234,56`) ⇒ centavos arredondados.
 * - Texto inválido/negativo ⇒ `null`; o formulário distingue "vazio" de
 *   "inválido" olhando o texto original.
 */
export function savingsGoalInputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^0+([.,]0{1,2})?$/.test(trimmed)) return 0;
  return parseAmountToCents(trimmed);
}

/**
 * Guardado **realizado até hoje** no ciclo, em centavos.
 *
 * `G = max(0, round(B × elapsedDays / windowDays) − variableSpentCents)`, onde
 * `B = max(incomeCents − fixedExpensesCents, 0)` é o orçamento variável do ciclo.
 * `elapsedDays` segue a convenção de `elapsedCycleDays` (o dia de hoje conta).
 * `windowDays <= 0` é tratado como `1` para nunca dividir por zero.
 */
export function savingsGoalSavedCents({
  incomeCents,
  fixedExpensesCents,
  variableSpentCents,
  elapsedDays,
  windowDays,
}: SavingsGoalSavedInput): number {
  const budgetCents = Math.max(incomeCents - fixedExpensesCents, 0);
  const days = windowDays > 0 ? windowDays : 1;
  const elapsed = Math.max(elapsedDays, 0);
  const proportionalCents = Math.round((budgetCents * elapsed) / days);
  return Math.max(0, proportionalCents - variableSpentCents);
}

/**
 * Progresso da meta do ciclo. Retorna `null` quando não há meta (`null` ou
 * `0`), para o card não ser renderizado. `savedCents` deve ser o guardado
 * **realizado** (ver `savingsGoalSavedCents`), não o orçamento livre do ciclo.
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
