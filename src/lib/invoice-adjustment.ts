/**
 * Lógica pura do ajuste de total de fatura (história #231).
 *
 * Nenhuma função aqui acessa banco de dados ou rede — apenas reutiliza as
 * regras de competência/rateio de `invoices.ts` para responder duas perguntas:
 *
 * 1. Qual é o total já lançado (competência) de um cartão num mês?
 * 2. Em que data uma compra à vista deve cair para que a sua parcela única
 *    compita exatamente no mês alvo?
 *
 * O ajuste em si é persistido como um `CardPurchase` comum e à vista
 * (descrição "Ajuste de fatura", categoria "Ajuste"), então nada aqui precisa
 * de schema novo — o `CardPurchase` flui pela fatura e pelo dashboard.
 */
import { shiftMonthKey } from "./finance";
import {
  dueOffset,
  sumCardExpensesForMonth,
  type CardPurchaseRecord,
} from "./invoices";
import { resolveTimeZone, zonedTimeToUtc } from "./time";

/** Resultado do cálculo do ajuste de uma fatura. */
export interface InvoiceAdjustment {
  /** Total já lançado (soma das parcelas cuja competência cai em `monthKey`). */
  currentCents: number;
  /** Total-alvo informado pelo usuário. */
  targetCents: number;
  /** Diferença a criar: `targetCents - currentCents` (negativa = redução). */
  diffCents: number;
}

/**
 * Calcula o total corrente da fatura de `cardId` no mês `monthKey` e a
 * diferença para o `targetCents` informado.
 *
 * O total corrente é a soma das parcelas do cartão cuja competência cai em
 * `monthKey` (mesma regra de `invoiceLinesForMonth`/`sumCardExpensesForMonth`).
 * A fonte de verdade é o servidor, então a diferença é inteira em centavos,
 * sem arredondamento intermediário.
 */
export function computeInvoiceAdjustment(
  purchases: CardPurchaseRecord[],
  cardId: string,
  monthKey: string,
  targetCents: number,
): InvoiceAdjustment {
  const cardPurchases = purchases.filter(
    (purchase) => purchase.card.id === cardId,
  );
  const currentCents = sumCardExpensesForMonth(cardPurchases, monthKey);
  return {
    currentCents,
    targetCents,
    diffCents: targetCents - currentCents,
  };
}

/**
 * Data de compra de uma parcela única (à vista) que, pelas regras de
 * fechamento/vencimento, compete exatamente em `monthKey`.
 *
 * Basta colocar a compra no dia 1 do mês de ciclo cujo vencimento cai em
 * `monthKey`; o ciclo é `monthKey` deslocado por `-dueOffset(closingDay,
 * dueDay)`. Como dia 1 é sempre `<= closingDay`, a compra entra no próprio mês
 * do ciclo e a sua única parcela compete em `monthKey` (verificável via
 * `allocateInstallments`).
 */
export function adjustmentPurchaseDate(
  card: { closingDay: number; dueDay: number },
  monthKey: string,
): Date {
  const purchaseMonthKey = shiftMonthKey(
    monthKey,
    -dueOffset(card.closingDay, card.dueDay),
  );
  const [year, month] = purchaseMonthKey.split("-").map(Number);
  return zonedTimeToUtc(year, month, 1, resolveTimeZone());
}
