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
import { savingsGoalProgress, type SavingsGoalProgress } from "../savings-goal";
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
  /**
   * Ritmo recente de consumo por dia (avulsos do ciclo + fatura do mês).
   * Sem base de medida → ausente/0.
   */
  usualDailySpendCents?: number | null;
  purchaseCents: number;
  /**
   * Em quantas parcelas a compra será paga. Ausente/inválido normaliza para `1`
   * (à vista); a 1ª parcela é a única que pesa no orçamento do ciclo.
   */
  installmentsTotal?: number | null;
  /** Meta de economia do ciclo em centavos; `null`/`0` = sem meta. */
  savingsGoalCents?: number | null;
  /** Guardado estimado do ciclo; default `0`. */
  savingsGoalSavedCents?: number | null;
}

export interface PurchaseSimulation {
  verdict: PurchaseVerdict;
  label: string;
  summary: string;
  /** Impacto determinístico no poder de compra (sempre exibido na UI). */
  impactLabel: string;
  installmentsTotal: number;
  /** Valor da 1ª parcela (a única que pesa no orçamento do ciclo). */
  installmentCents: number;
  /** Soma das parcelas futuras (sem veredito para ciclos futuros). */
  futureCommitmentCents: number;
  /** Texto do parcelamento (à vista ou 1ª parcela + compromisso futuro). */
  installmentLabel: string;
  /** Texto do estado da meta de economia (sem meta/atingida/restante). */
  goalLabel: string;
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
  installmentsTotal: number;
  installmentCents: number;
  futureCommitmentCents: number;
  goal: SavingsGoalProgress | null;
  impactPerDayCents: number;
  newFreeBudgetCents: number;
  newDailyCents: number;
}

/**
 * Normaliza o número de parcelas do núcleo: ausente, `null`, `0`, negativo ou
 * não inteiro vira `1` (à vista). A rota é quem rejeita entradas inválidas.
 */
function normalizeInstallmentsTotal(value: number | null | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : 1;
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

  // Mesmo rateio de `allocateInstallments`: base = floor(valor/N) e o resto na
  // 1ª parcela.
  const installmentsTotal = normalizeInstallmentsTotal(input.installmentsTotal);
  const baseInstallmentCents = Math.floor(
    purchaseCents / installmentsTotal,
  );
  const remainderCents =
    purchaseCents - baseInstallmentCents * installmentsTotal;
  const installmentCents = baseInstallmentCents + remainderCents;
  const futureCommitmentCents = purchaseCents - installmentCents;

  const goal = savingsGoalProgress({
    goalCents: input.savingsGoalCents ?? null,
    savedCents: input.savingsGoalSavedCents ?? 0,
    remainingDays,
  });

  return {
    freeBudgetCents,
    dailyCents: input.dailyCents,
    remainingDays,
    usualDailySpendCents,
    purchaseCents,
    installmentsTotal,
    installmentCents,
    futureCommitmentCents,
    goal,
    impactPerDayCents: Math.round(installmentCents / remainingDays),
    newFreeBudgetCents: freeBudgetCents - installmentCents,
    newDailyCents: Math.round(
      (freeBudgetCents - installmentCents) / remainingDays,
    ),
  };
}

function installmentLabel(impact: PurchaseImpact): string {
  if (impact.installmentsTotal === 1) {
    return "Compra à vista: sem parcelas futuras.";
  }
  const remaining = impact.installmentsTotal - 1;
  return (
    `Parcela de ${formatCents(impact.installmentCents)} em ` +
    `${impact.installmentsTotal} vezes; ${remaining} ` +
    `${remaining === 1 ? "parcela restante" : "parcelas restantes"} ` +
    `somam ${formatCents(impact.futureCommitmentCents)} de compromisso futuro.`
  );
}

function goalLabel(goal: SavingsGoalProgress | null): string {
  if (goal === null) return "Sem meta de economia definida.";
  if (goal.achieved) return "Meta de economia atingida.";
  return (
    `Faltam ${formatCents(goal.remainingCents)} para a meta de ` +
    `${formatCents(goal.goalCents)} (${goal.percent}% guardado).`
  );
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

  // A meta de economia só endurece o veredito: nunca melhora.
  if (impact.goal !== null && impact.goal.remainingCents > 0) {
    if (impact.installmentCents >= impact.goal.remainingCents) {
      verdict = "nao";
    } else if (
      impact.installmentCents * 2 >= impact.goal.remainingCents &&
      verdict === "ok"
    ) {
      verdict = "cuidado";
    }
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
        ? `Seu ritmo recente de consumo é de ${formatCents(impact.usualDailySpendCents)} por dia e a compra o mantém.`
        : "A compra cabe sem derrubar o poder de compra do ciclo pela metade.";
  } else if (verdict === "cuidado") {
    summary =
      impact.usualDailySpendCents > 0
        ? `Você vem consumindo cerca de ${formatCents(impact.usualDailySpendCents)} por dia; com a compra, vai precisar gastar menos que isso.`
        : "A compra consome mais da metade do poder de compra que resta no ciclo.";
  } else {
    summary = `Sobraria menos da metade do seu ritmo recente de ${formatCents(impact.usualDailySpendCents)} por dia.`;
  }

  return {
    verdict,
    label: VERDICT_LABELS[verdict],
    summary,
    impactLabel,
    installmentsTotal: impact.installmentsTotal,
    installmentCents: impact.installmentCents,
    futureCommitmentCents: impact.futureCommitmentCents,
    installmentLabel: installmentLabel(impact),
    goalLabel: goalLabel(impact.goal),
  };
}

/** Agregado numérico (apenas números) para a justificativa da IA. */
export function buildPurchaseData(
  input: SimulatePurchaseInput,
): PurchaseData {
  const impact = purchaseImpact(input);
  const goal =
    impact.goal !== null &&
    !impact.goal.achieved &&
    impact.goal.remainingCents > 0
      ? impact.goal
      : null;

  return {
    freeBudgetCents: impact.freeBudgetCents,
    dailyCents: impact.dailyCents,
    remainingDays: impact.remainingDays,
    usualDailySpendCents: impact.usualDailySpendCents,
    purchaseCents: impact.purchaseCents,
    installmentsTotal: impact.installmentsTotal,
    installmentCents: impact.installmentCents,
    futureCommitmentCents: impact.futureCommitmentCents,
    savingsGoalCents: goal?.goalCents ?? 0,
    savingsGoalSavedCents: goal?.savedCents ?? 0,
    goalRemainingCents: goal?.remainingCents ?? 0,
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

const INSTALLMENT_PROMPT =
  "O impacto orçamentário usa apenas a primeira parcela: cite " +
  "installmentCents e installmentsTotal; as demais parcelas " +
  "(futureCommitmentCents) são apenas compromisso futuro, sem veredito.";

const GOAL_PROMPT =
  "Há meta de economia no ciclo (savingsGoalCents, savingsGoalSavedCents e " +
  "goalRemainingCents); mencione-a apenas se ela endurecer o veredito.";

function systemPrompt(
  input: SimulatePurchaseInput,
  verdict: PurchaseVerdict,
): string {
  const data = buildPurchaseData(input);
  const parts = [SYSTEM_PROMPT, INSTALLMENT_PROMPT];
  if (data.savingsGoalCents > 0) parts.push(GOAL_PROMPT);
  parts.push(`Veredito local: ${VERDICT_LABELS[verdict]}.`);
  return parts.join(" ");
}

/** Mensagens para a IA; o conteúdo do usuário contém apenas números. */
export function buildPurchasePrompt(
  input: SimulatePurchaseInput,
  verdict: PurchaseVerdict,
): ChatMessage[] {
  return [
    { role: "system", content: systemPrompt(input, verdict) },
    { role: "user", content: JSON.stringify(buildPurchaseData(input)) },
  ];
}
