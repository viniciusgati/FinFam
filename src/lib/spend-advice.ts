/**
 * Motor puro do alerta de ritmo do dashboard (história #295).
 *
 * Compara o **consumo variável** do ciclo (avulsos + compras do cartão pela
 * data) com o **orçamento variável** (`renda − contas fixas`, nunca negativo) e
 * devolve um único texto acionável. Nenhuma função aqui acessa banco, rede ou
 * `Date.now()` — as datas vêm do chamador (ver spend-advice.test.ts).
 *
 * Fórmulas (SPEC §4.7):
 * - `diaria_variavel = round(orcamento_variavel / dias_da_janela)`;
 * - `esperado_ate_hoje = diaria_variavel × dias_decorridos`;
 * - `delta = consumido_variavel − esperado_ate_hoje`.
 *
 * Precedência: estouro (`consumido > orçamento`) vence os demais estados;
 * depois `delta > 0` ⇒ adiantado, `delta < 0` ⇒ atrasado, `delta = 0` ⇒ no
 * ritmo.
 */

import { formatCents } from "./money";

export type SpendAdviceState = "ahead" | "behind" | "on-pace" | "over-budget";

export type SpendAdviceRole = "status" | "alert";
export type SpendAdviceAriaLive = "polite" | "assertive";

export interface SpendAdvice {
  state: SpendAdviceState;
  /** Texto exato exibido no bloco de recomendação. */
  message: string;
  role: SpendAdviceRole;
  ariaLive: SpendAdviceAriaLive;
  /** Classes Tailwind de fundo/texto para a severidade do estado. */
  colorClass: string;
}

export interface SpendAdviceInput {
  /** Total de dias da janela do ciclo (28–31). */
  windowDays: number;
  /** Dias decorridos da janela, contando hoje. */
  elapsedDays: number;
  /** Renda do ciclo em centavos. */
  incomeCents: number;
  /** Contas fixas que vencem na janela, em centavos. */
  fixedExpensesCents: number;
  /** Consumo variável do ciclo (avulsos + compras do cartão pela data). */
  variableConsumedCents: number;
  /** Só o ciclo corrente tem "hoje" e um ritmo a comparar. */
  isCurrentCycle: boolean;
}

export const SPEND_ADVICE_AHEAD_COLOR = "bg-amber-950 text-amber-100";
export const SPEND_ADVICE_BEHIND_COLOR = "bg-amber-950 text-amber-100";
export const SPEND_ADVICE_ON_PACE_COLOR = "bg-emerald-950 text-emerald-100";
export const SPEND_ADVICE_OVER_BUDGET_COLOR = "bg-red-950 text-red-200";

function daysLabel(days: number): string {
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function remainingDaysLabel(days: number): string {
  return days === 1 ? "pelo dia restante" : `pelos ${days} dias restantes`;
}

/**
 * Monta o alerta de ritmo do ciclo. Devolve `null` fora do ciclo corrente, sem
 * dias decorridos/janela válidos ou quando a diária variável é `0` (sem
 * orçamento variável para comparar).
 */
export function buildSpendAdvice(
  input: SpendAdviceInput,
): SpendAdvice | null {
  if (!input.isCurrentCycle) return null;
  if (input.elapsedDays <= 0 || input.windowDays <= 0) return null;

  const variableBudgetCents = Math.max(
    input.incomeCents - input.fixedExpensesCents,
    0,
  );
  const dailyCents = Math.round(variableBudgetCents / input.windowDays);
  if (dailyCents <= 0) return null;

  const consumed = Math.max(input.variableConsumedCents, 0);

  if (consumed > variableBudgetCents) {
    const remainingDays = Math.max(input.windowDays - input.elapsedDays, 0);
    return {
      state: "over-budget",
      message:
        `Orçamento variável do ciclo estourado em ` +
        `${formatCents(consumed - variableBudgetCents)}. Reduza o consumo ` +
        `${remainingDaysLabel(remainingDays)}.`,
      role: "alert",
      ariaLive: "assertive",
      colorClass: SPEND_ADVICE_OVER_BUDGET_COLOR,
    };
  }

  const expectedCents = dailyCents * input.elapsedDays;
  const delta = consumed - expectedCents;

  if (delta > 0) {
    const aheadDays = Math.ceil(delta / dailyCents);
    return {
      state: "ahead",
      message:
        `Segure o consumo por ${daysLabel(aheadDays)} para se manter dentro ` +
        "do necessário.",
      role: "status",
      ariaLive: "polite",
      colorClass: SPEND_ADVICE_AHEAD_COLOR,
    };
  }

  if (delta < 0) {
    const behindDays = Math.floor(Math.abs(delta) / dailyCents);
    const projectedCents = Math.round(
      (consumed / input.elapsedDays) * input.windowDays,
    );
    const savingsCents = Math.max(variableBudgetCents - projectedCents, 0);
    return {
      state: "behind",
      message:
        `Você está ${daysLabel(behindDays)} atrás do consumo esperado. ` +
        `Continue assim para economizar ${formatCents(savingsCents)} até o ` +
        "fim do ciclo.",
      role: "status",
      ariaLive: "polite",
      colorClass: SPEND_ADVICE_BEHIND_COLOR,
    };
  }

  return {
    state: "on-pace",
    message:
      "No ritmo esperado: continue assim para fechar o ciclo dentro do " +
      "orçamento.",
    role: "status",
    ariaLive: "polite",
    colorClass: SPEND_ADVICE_ON_PACE_COLOR,
  };
}
