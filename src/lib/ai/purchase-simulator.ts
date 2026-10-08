/**
 * Simulador "posso comprar?".
 *
 * O veredito é local e determinístico; a DeepSeek apenas redige a justificativa
 * a partir de agregados numéricos. Sem chave ou em falha da IA, mantém-se o
 * veredito e a justificativa determinística local.
 *
 * Regra: a compra é medida pelo impacto no **poder de compra por dia** do ciclo
 * (o mesmo número do card "Pode gastar por dia"): dividida pelos dias
 * restantes, ela reduz a diária. O veredito compara a diária resultante com o
 * **ritmo recente** de gastos avulsos (avulsos do ciclo ÷ dias decorridos):
 * - não cabe no orçamento do ciclo ou cai abaixo de metade do ritmo → `nao`;
 * - fica abaixo do ritmo → `cuidado`;
 * - mantém o ritmo → `ok`.
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
  /** Orçamento livre restante do ciclo em centavos (nunca negativo). */
  freeBudgetCents: number;
  /** Poder de compra por dia do ciclo em centavos (negativo se estourado). */
  dailyCents: number;
  /** Dias restantes do ciclo, contando hoje. */
  remainingDays: number;
  /** Ritmo recente de gastos avulsos por dia; sem base de medida → ausente/0. */
  usualDailySpendCents?: number | null;
  purchaseCents: number;
}

export interface PurchaseSimulation {
  verdict: PurchaseVerdict;
  label: string;
  summary: string;
  /** Impacto determinístico no poder de compra (sempre exibido na UI). */
  impactLabel: string;
}

/** Dados numéricos anônimos enviados à IA (nunca texto do usuário). */
export type PurchaseData = Record<string, number>;

/** Mantém o ritmo quando a diária cai no máximo 10%; abaixo de metade, `nao`. */
const OK_FLOOR = 0.9;
const CUIDADO_FLOOR = 0.5;

interface PurchaseImpact {
  freeBudgetCents: number;
  dailyCents: number;
  remainingDays: number;
  /** Ritmo recente em centavos/dia; `0` quando não há base. */
  usualDailySpendCents: number;
  purchaseCents: number;
  impactPerDayCents: number;
  newFreeBudgetCents: number;
  newDailyCents: number;
}

function purchaseImpact(input: SimulatePurchaseInput): PurchaseImpact {
  const freeBudgetCents = Math.max(input.freeBudgetCents, 0);
  const remainingDays = Math.max(Math.round(input.remainingDays), 1);
  const purchaseCents = Math.max(input.purchaseCents, 0);
  const usualDailySpendCents =
    input.usualDailySpendCents !== null &&
    input.usualDailySpendCents !== undefined &&
    input.usualDailySpendCents > 0
      ? Math.round(input.usualDailySpendCents)
      : 0;

  return {
    freeBudgetCents,
    dailyCents: input.dailyCents,
    remainingDays,
    usualDailySpendCents,
    purchaseCents,
    impactPerDayCents: Math.round(purchaseCents / remainingDays),
    newFreeBudgetCents: freeBudgetCents - purchaseCents,
    newDailyCents: Math.round((freeBudgetCents - purchaseCents) / remainingDays),
  };
}

export function simulatePurchase(
  input: SimulatePurchaseInput,
): PurchaseSimulation {
  const impact = purchaseImpact(input);
  const overBudget = impact.dailyCents < 0;

  // Referência: o ritmo recente, limitado à diária atual (se já se gasta acima
  // dela, não faz sentido exigir uma diária ainda menor que o próprio ritmo).
  const reference =
    impact.usualDailySpendCents > 0
      ? Math.min(impact.usualDailySpendCents, Math.max(impact.dailyCents, 0))
      : 0;

  let verdict: PurchaseVerdict;
  if (overBudget || impact.newFreeBudgetCents < 0) {
    verdict = "nao";
  } else if (reference > 0) {
    if (impact.newDailyCents >= OK_FLOOR * reference) verdict = "ok";
    else if (impact.newDailyCents >= CUIDADO_FLOOR * reference)
      verdict = "cuidado";
    else verdict = "nao";
  } else if (impact.dailyCents > 0) {
    // Sem ritmo medido: só avisa quando a compra derruba a diária pela metade.
    verdict =
      impact.newDailyCents >= CUIDADO_FLOOR * impact.dailyCents
        ? "ok"
        : "cuidado";
  } else {
    verdict = "cuidado";
  }

  const impactLabel =
    `Poder de compra: de ${formatCents(impact.dailyCents)} para ` +
    `${formatCents(impact.newDailyCents)} por dia nos ${impact.remainingDays} ` +
    `${impact.remainingDays === 1 ? "dia" : "dias"} restantes do ciclo ` +
    `(−${formatCents(impact.impactPerDayCents)} por dia).`;

  let summary: string;
  if (overBudget) {
    summary =
      `O ciclo já está estourado; a compra aumenta o estouro em ` +
      `${formatCents(impact.impactPerDayCents)} por dia.`;
  } else if (impact.newFreeBudgetCents < 0) {
    summary =
      `A compra não cabe: faltam ` +
      `${formatCents(-impact.newFreeBudgetCents)} no orçamento do ciclo.`;
  } else if (verdict === "ok") {
    summary =
      impact.usualDailySpendCents > 0
        ? `Seu ritmo recente é de ${formatCents(impact.usualDailySpendCents)} por dia em gastos avulsos e a compra o mantém.`
        : "A compra cabe sem derrubar o poder de compra do ciclo pela metade.";
  } else if (verdict === "cuidado") {
    summary =
      impact.usualDailySpendCents > 0
        ? `Você vem gastando cerca de ${formatCents(impact.usualDailySpendCents)} por dia; com a compra, vai precisar gastar menos que isso.`
        : "A compra consome mais da metade do poder de compra que resta no ciclo.";
  } else {
    summary = `Sobraria menos da metade do seu ritmo recente de ${formatCents(impact.usualDailySpendCents)} por dia.`;
  }

  return { verdict, label: VERDICT_LABELS[verdict], summary, impactLabel };
}

/** Agregado numérico (apenas números) para a justificativa da IA. */
export function buildPurchaseData(
  input: SimulatePurchaseInput,
): PurchaseData {
  const impact = purchaseImpact(input);
  return {
    freeBudgetCents: impact.freeBudgetCents,
    dailyCents: impact.dailyCents,
    remainingDays: impact.remainingDays,
    usualDailySpendCents: impact.usualDailySpendCents,
    purchaseCents: impact.purchaseCents,
    impactPerDayCents: impact.impactPerDayCents,
    newFreeBudgetCents: impact.newFreeBudgetCents,
    newDailyCents: impact.newDailyCents,
  };
}

const SYSTEM_PROMPT =
  "Você é um assistente financeiro familiar. O veredito já foi decidido " +
  "localmente; escreva em português do Brasil uma justificativa curta (até 2 " +
  "frases) para ele, usando apenas os agregados numéricos fornecidos (em " +
  "centavos), citando a nova diária (newDailyCents) e a redução por dia " +
  "(impactPerDayCents), sem inventar dados nem citar nomes, categorias ou " +
  "descrições.";

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
