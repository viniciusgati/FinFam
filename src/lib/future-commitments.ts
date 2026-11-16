/**
 * Projeção pura das parcelas de cartão nos próximos meses.
 *
 * Reutiliza `allocateInstallments` (competência/vencimento e rateio exato) e
 * `shiftMonthKey` para recortar a janela de meses seguintes ao mês-base. Não
 * acessa banco nem rede; o "hoje" vem de quem chama, via `referenceMonthKey`.
 */

import { shiftMonthKey } from "./finance";
import { allocateInstallments, type CardPurchaseRecord } from "./invoices";

/** Número padrão (e máximo) de meses projetados à frente do mês-base. */
export const FUTURE_COMMITMENT_MONTHS = 3;

/** Total de parcelas de um cartão em um mês da projeção. */
export interface FutureCommitmentCardTotal {
  cardId: string;
  cardName: string;
  amountCents: number;
}

/** Parcelas de todos os cartões em um mês da projeção. */
export interface FutureCommitmentMonth {
  /** Mês de competência (YYYY-MM), sempre após o mês-base. */
  monthKey: string;
  totalCents: number;
  /** Só cartões com valor > 0, ordenados por nome. */
  cards: FutureCommitmentCardTotal[];
}

/**
 * Recorta `months` em 1..`FUTURE_COMMITMENT_MONTHS`: `0` (ou menos) vira 1 e
 * `99` vira 3. Valores fracionários são truncados.
 */
function clampMonths(months: number): number {
  if (!Number.isFinite(months)) return FUTURE_COMMITMENT_MONTHS;
  return Math.min(Math.max(Math.trunc(months), 1), FUTURE_COMMITMENT_MONTHS);
}

/**
 * Projeta as parcelas dos `months` meses **estritamente seguintes** a
 * `referenceMonthKey` (mês-base), somando por mês e por cartão.
 *
 * Cada parcela entra no mês de competência (vencimento) e um mês sem parcelas
 * aparece com `totalCents: 0` e `cards: []`, para a UI exibir `R$ 0,00`.
 * Parcelas fora da janela (inclusive além do 3º mês) são descartadas.
 */
export function buildFutureCommitments(
  purchases: CardPurchaseRecord[],
  referenceMonthKey: string,
  months: number = FUTURE_COMMITMENT_MONTHS,
): FutureCommitmentMonth[] {
  const monthKeys = Array.from({ length: clampMonths(months) }, (_, index) =>
    shiftMonthKey(referenceMonthKey, index + 1),
  );
  const monthSet = new Set(monthKeys);
  const buckets = new Map<string, Map<string, FutureCommitmentCardTotal>>();
  for (const key of monthKeys) buckets.set(key, new Map());

  for (const purchase of purchases) {
    for (const installment of allocateInstallments(
      purchase,
      purchase.card.closingDay,
      purchase.card.dueDay,
    )) {
      if (!monthSet.has(installment.monthKey)) continue;

      const cards = buckets.get(installment.monthKey)!;
      const existing = cards.get(purchase.card.id);
      if (existing) {
        existing.amountCents += installment.amountCents;
      } else {
        cards.set(purchase.card.id, {
          cardId: purchase.card.id,
          cardName: purchase.card.name,
          amountCents: installment.amountCents,
        });
      }
    }
  }

  return monthKeys.map((monthKey) => {
    const cards = [...buckets.get(monthKey)!.values()]
      .filter((card) => card.amountCents > 0)
      .sort((a, b) => a.cardName.localeCompare(b.cardName, "pt-BR"));

    return {
      monthKey,
      totalCents: cards.reduce((total, card) => total + card.amountCents, 0),
      cards,
    };
  });
}
