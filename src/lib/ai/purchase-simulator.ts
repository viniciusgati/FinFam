/**
 * Simulador "posso comprar?".
 *
 * O veredito é local e determinístico; a DeepSeek apenas redige a justificativa
 * a partir de agregados numéricos. Sem chave ou em falha da IA, mantém-se o
 * veredito e a justificativa determinística local.
 */

import { formatCents } from "../money";
import type { ChatMessage } from "./deepseek";

export type PurchaseVerdict = "ok" | "cuidado" | "nao";

export const VERDICT_LABELS: Record<PurchaseVerdict, string> = {
  ok: "Pode comprar",
  cuidado: "Cuidado",
  nao: "Não recomendado",
};

export interface SimulatePurchaseInput {
  incomeCents: number;
  spentCents: number;
  elapsedDay: number;
  daysInMonth: number;
  purchaseCents: number;
  previousMonthsCents?: number[];
}

export interface PurchaseSimulation {
  verdict: PurchaseVerdict;
  label: string;
  summary: string;
}

/** Dados numéricos anônimos enviados à IA (nunca texto do usuário). */
export type PurchaseData = Record<string, number>;

function averageCents(values: number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

/**
 * Decide o veredito pelas faixas fixadas na história:
 * `saldo = max(renda - gasto, 0)`; `ok` até metade do saldo, `cuidado` até o
 * saldo inteiro e `nao` acima dele.
 */
export function simulatePurchase(
  input: SimulatePurchaseInput,
): PurchaseSimulation {
  const remainingCents = Math.max(input.incomeCents - input.spentCents, 0);
  const purchaseCents = Math.max(input.purchaseCents, 0);

  let verdict: PurchaseVerdict;
  if (purchaseCents <= 0.5 * remainingCents) {
    verdict = "ok";
  } else if (purchaseCents <= remainingCents) {
    verdict = "cuidado";
  } else {
    verdict = "nao";
  }

  const average = averageCents(input.previousMonthsCents ?? []);
  const count = (input.previousMonthsCents ?? []).filter((value) =>
    Number.isFinite(value),
  ).length;

  const reasons: Record<PurchaseVerdict, string> = {
    ok: `Pode comprar: ${formatCents(purchaseCents)} cabe em até metade do saldo restante de ${formatCents(remainingCents)}.`,
    cuidado: `Cuidado: ${formatCents(purchaseCents)} usa mais da metade do saldo restante de ${formatCents(remainingCents)}.`,
    nao: `Não recomendado: ${formatCents(purchaseCents)} excede o saldo restante de ${formatCents(remainingCents)}.`,
  };

  let summary = reasons[verdict];
  if (average !== null) {
    summary += ` A média de gastos nos ${count} meses fechados foi ${formatCents(average)}.`;
  }

  return { verdict, label: VERDICT_LABELS[verdict], summary };
}

/** Agregado numérico (apenas números) para a justificativa da IA. */
export function buildPurchaseData(
  input: SimulatePurchaseInput,
): PurchaseData {
  const remainingCents = Math.max(input.incomeCents - input.spentCents, 0);
  const average = averageCents(input.previousMonthsCents ?? []);
  const count = (input.previousMonthsCents ?? []).filter((value) =>
    Number.isFinite(value),
  ).length;

  return {
    incomeCents: input.incomeCents,
    spentCents: input.spentCents,
    remainingCents,
    elapsedDay: input.elapsedDay,
    daysInMonth: input.daysInMonth,
    purchaseCents: Math.max(input.purchaseCents, 0),
    previousMonthsCount: count,
    previousMonthsAverageCents: average ?? 0,
  };
}

const SYSTEM_PROMPT =
  "Você é um assistente financeiro familiar. O veredito já foi decidido " +
  "localmente; escreva em português do Brasil uma justificativa curta (até 2 " +
  "frases) para ele, usando apenas os agregados numéricos fornecidos (em " +
  "centavos) e sem inventar dados nem citar nomes, categorias ou descrições.";

/** Mensagens para a IA; o conteúdo do usuário contém apenas números. */
export function buildPurchasePrompt(
  input: SimulatePurchaseInput,
  verdict: PurchaseVerdict,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `${SYSTEM_PROMPT} Veredito local: ${VERDICT_LABELS[verdict]}.`,
    },
    { role: "user", content: JSON.stringify(buildPurchaseData(input)) },
  ];
}
