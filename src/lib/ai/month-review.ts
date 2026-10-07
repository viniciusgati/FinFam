/**
 * Avaliação de mês fechado: agregado numérico anônimo + prompt + texto
 * determinístico local (fallback quando a IA está indisponível).
 *
 * Privacidade (suposição 7 da história): apenas números são enviados à DeepSeek
 * — nunca descrições, nomes, categorias ou qualquer texto do usuário.
 */

import { formatCents } from "../money";
import type { ChatMessage } from "./deepseek";

export interface MonthReviewSnapshot {
  incomeCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  consumedCents: number;
  consumedPercent: number;
  daysInMonth: number;
  elapsedDay: number;
  dailyBudgetCents: number;
  projectedMonthEndCents: number;
}

/** Somente números: é isto (e nada mais) que trafega até a DeepSeek. */
export type MonthReviewData = Record<string, number>;

/** Fonte mínima (estrutural) para montar o snapshot a partir do dashboard. */
export interface MonthReviewSource {
  monthlyIncomeCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  series: {
    daysInMonth: number;
    elapsedDay: number;
    dailyBudgetCents: number;
    projectedMonthEndCents: number;
  };
}

/** Deriva o snapshot numérico de mês fechado a partir dos dados carregados. */
export function monthReviewSnapshotFrom(
  source: MonthReviewSource,
): MonthReviewSnapshot {
  const incomeCents = Math.max(source.monthlyIncomeCents, 0);
  const consumedCents =
    Math.max(source.fixedExpensesCents, 0) +
    Math.max(source.variableExpensesCents, 0) +
    Math.max(source.cardExpensesCents, 0);

  return {
    incomeCents,
    fixedExpensesCents: source.fixedExpensesCents,
    variableExpensesCents: source.variableExpensesCents,
    cardExpensesCents: source.cardExpensesCents,
    consumedCents,
    consumedPercent: incomeCents > 0 ? (consumedCents / incomeCents) * 100 : 0,
    daysInMonth: source.series.daysInMonth,
    elapsedDay: source.series.elapsedDay,
    dailyBudgetCents: source.series.dailyBudgetCents,
    projectedMonthEndCents: source.series.projectedMonthEndCents,
  };
}

/**
 * Monta o agregado anônimo do mês + a média dos meses fechados anteriores.
 * Todos os valores são numéricos; nenhum texto entra aqui.
 */
export function buildMonthReviewData(
  snapshot: MonthReviewSnapshot,
  previousMonthsCents: number[] = [],
): MonthReviewData {
  const closed = previousMonthsCents.filter((value) => Number.isFinite(value));
  const averageCents =
    closed.length > 0
      ? Math.round(closed.reduce((sum, value) => sum + value, 0) / closed.length)
      : 0;

  return {
    incomeCents: snapshot.incomeCents,
    fixedExpensesCents: snapshot.fixedExpensesCents,
    variableExpensesCents: snapshot.variableExpensesCents,
    cardExpensesCents: snapshot.cardExpensesCents,
    consumedCents: snapshot.consumedCents,
    consumedPercent: Math.round(snapshot.consumedPercent * 100) / 100,
    daysInMonth: snapshot.daysInMonth,
    elapsedDay: snapshot.elapsedDay,
    dailyBudgetCents: snapshot.dailyBudgetCents,
    projectedMonthEndCents: snapshot.projectedMonthEndCents,
    previousMonthsCount: closed.length,
    previousMonthsAverageCents: averageCents,
  };
}

const SYSTEM_PROMPT =
  "Você é um assistente financeiro familiar. Com base apenas nos agregados " +
  "numéricos fornecidos (em centavos), escreva em português do Brasil um " +
  "parágrafo curto (até 3 frases) avaliando o mês fechado e sugerindo um " +
  "próximo passo prático. Não invente dados nem cite nomes, categorias ou " +
  "descrições.";

/** Mensagens para a DeepSeek: o conteúdo do usuário contém apenas números. */
export function buildMonthReviewPrompt(data: MonthReviewData): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(data) },
  ];
}

/**
 * Avaliação determinística local — usada sem chave, em falha da IA ou erro de
 * rede. Nunca depende da DeepSeek.
 */
export function localMonthReview(data: MonthReviewData): string {
  const percent = Math.round(data.consumedPercent);
  const sentences = [
    `No mês, ${percent}% da renda foi consumida ` +
      `(${formatCents(data.consumedCents)} de ${formatCents(data.incomeCents)}).`,
  ];

  if (data.previousMonthsCount > 0) {
    sentences.push(
      `A média dos últimos ${data.previousMonthsCount} meses fechados foi ` +
        `${formatCents(data.previousMonthsAverageCents)}.`,
    );
  }

  if (data.projectedMonthEndCents > data.consumedCents) {
    sentences.push(
      `No ritmo atual, a projeção de fechamento é ` +
        `${formatCents(data.projectedMonthEndCents)}.`,
    );
  }

  return sentences.join(" ");
}
