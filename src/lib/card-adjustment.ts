/**
 * Lógica pura do bloco "Ajuste rápido do cartão" do dashboard (história #374).
 *
 * Nenhuma função aqui acessa banco de dados, rede ou `Date`: apenas reutiliza as
 * regras de competência de `invoices.ts` e a conversão pt-BR de `money.ts`.
 *
 * O ajuste reaproveita a semântica de `POST /api/card-invoices/set-total`
 * (história #231): o valor informado é o **total-alvo** da fatura do mês de
 * competência exibido no dashboard e só aumenta o total.
 */

import { shiftMonthKey } from "./finance";
import {
  invoiceLinesForMonth,
  type CardPurchaseRecord,
} from "./invoices";
import { formatCents, parseAmountToCents } from "./money";

export const CARD_SELECTION_ERROR = "Selecione um cartão";
export const CARD_AMOUNT_ERROR = "Informe um valor maior que zero";
export const CARD_NETWORK_ERROR =
  "Não foi possível ajustar a fatura. Tente novamente.";

/**
 * Mês de fatura exibido no dashboard a partir do mês do ciclo corrente.
 *
 * É o mesmo deslocamento aplicado pelo seletor de mês (`queryMonthShift`):
 * com início do ciclo no dia 1 o mês de fatura é o próprio mês do ciclo; nos
 * demais casos a fatura exibida é a do mês seguinte.
 */
export function invoiceMonthKeyForCycle(
  cycleKey: string,
  cycleStartDay: number,
): string {
  return shiftMonthKey(cycleKey, cycleStartDay === 1 ? 0 : 1);
}

/**
 * Total de competência já lançado por cartão no mês-alvo.
 *
 * Agrupa as parcelas de `invoiceLinesForMonth` por `cardId`. Cartões sem
 * lançamentos no mês simplesmente não aparecem no mapa — o consumidor deve
 * tratar o ausente como `0` (exibido como `R$ 0,00`).
 */
export function invoiceTotalsByCard(
  purchases: CardPurchaseRecord[],
  monthKey: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of invoiceLinesForMonth(purchases, monthKey).lines) {
    totals[line.cardId] = (totals[line.cardId] ?? 0) + line.amountCents;
  }
  return totals;
}

export interface CardAdjustmentInput {
  cardId: string;
  amount: string;
  monthKey: string;
}

export interface CardAdjustmentValidation {
  cardId: string | null;
  totalCents: number | null;
  error: string | null;
}

/** Payload aceito por `POST /api/card-invoices/set-total`. */
export interface CardAdjustmentPayload {
  cardId: string;
  monthKey: string;
  totalCents: number;
}

/**
 * Valida os campos do bloco antes de qualquer requisição: cartão selecionado e
 * valor pt-BR positivo (`parseAmountToCents`). `error === null` indica válido.
 */
export function validateCardAdjustment(
  input: Pick<CardAdjustmentInput, "cardId" | "amount">,
): CardAdjustmentValidation {
  if (!input.cardId) {
    return { cardId: null, totalCents: null, error: CARD_SELECTION_ERROR };
  }

  const totalCents = parseAmountToCents(input.amount);
  if (totalCents === null) {
    return { cardId: input.cardId, totalCents: null, error: CARD_AMOUNT_ERROR };
  }

  return { cardId: input.cardId, totalCents, error: null };
}

/**
 * Monta o payload do `set-total` a partir de uma entrada já validada. Devolve
 * `null` quando a entrada é inválida (defesa contra uso fora de ordem).
 */
export function buildCardAdjustmentPayload(
  input: CardAdjustmentInput,
): CardAdjustmentPayload | null {
  const { cardId, totalCents, error } = validateCardAdjustment(input);
  if (error !== null || cardId === null || totalCents === null) return null;
  return { cardId, monthKey: input.monthKey, totalCents };
}

export type CardAdjustmentOutcome =
  | { status: "created"; diffCents: number; totalCents: number }
  | { status: "no-op"; totalCents: number }
  | { status: "below"; error: string }
  | { status: "network" };

/**
 * Texto exato de feedback do bloco para cada desfecho da API:
 * 201 (`created`), 200 (`no-op`), 400 (`below`, mensagem da API) e falha de
 * rede (`network`).
 */
export function cardAdjustmentFeedback(outcome: CardAdjustmentOutcome): string {
  switch (outcome.status) {
    case "created":
      return `Ajuste criado: ${formatCents(outcome.diffCents)}. Fatura agora soma ${formatCents(outcome.totalCents)}`;
    case "no-op":
      return `A fatura já está no valor informado (${formatCents(outcome.totalCents)})`;
    case "below":
      return outcome.error;
    case "network":
      return CARD_NETWORK_ERROR;
  }
}
