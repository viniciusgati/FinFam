/**
 * Carga dos cartões e dos totais de fatura do bloco "Ajuste rápido do cartão"
 * (história #374).
 *
 * A página é só orquestração: esta função consulta o banco e devolve os cartões
 * ativos e o total de competência de cada um no mês-alvo, já no formato que o
 * componente cliente consome. A agregação em si fica em `card-adjustment.ts`
 * (função pura `invoiceTotalsByCard`), testável sem banco.
 */

import { invoiceTotalsByCard } from "./card-adjustment";
import { prisma } from "./db";
import { monthKey as monthKeyOf } from "./finance";
import {
  cardPurchaseLookbackStart,
  cardPurchaseWindowEnd,
  type CardPurchaseRecord,
} from "./invoices";
import { resolveTimeZone } from "./time";

/** Cartão exibível no `select` do bloco. */
export interface CardAdjustmentOption {
  id: string;
  name: string;
}

export interface CardAdjustmentData {
  /** Cartões ativos, ordenados por nome. */
  cards: CardAdjustmentOption[];
  /** Total já lançado (competência) por cartão ativo no mês-alvo. */
  totalsByCard: Record<string, number>;
  /** Mês de fatura usado no cálculo (YYYY-MM). */
  monthKey: string;
}

/**
 * Carrega os cartões ativos e o total de competência de cada um no mês-alvo.
 *
 * A consulta de compras usa a janela de lookback (`cardPurchaseLookbackStart` …
 * `cardPurchaseWindowEnd`) — a mesma leitura segura de `set-total`, que garante
 * enxergar toda parcela capaz de competir no mês sem varrer a tabela inteira.
 * O total por cartão usa `invoiceTotalsByCard`, então compras parceladas e de
 * outros meses só entram pela parcela que compete no mês-alvo. Cartões ativos
 * sem lançamentos devolvem total `0`.
 */
export async function loadCardAdjustmentData(
  targetMonthKey: string,
  now: Date = new Date(),
): Promise<CardAdjustmentData> {
  const month = targetMonthKey || monthKeyOf(now);
  const timeZone = resolveTimeZone();

  const [cards, purchases] = await Promise.all([
    prisma.creditCard.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.cardPurchase.findMany({
      where: {
        purchaseDate: {
          gte: cardPurchaseLookbackStart(month, timeZone),
          lt: cardPurchaseWindowEnd(month, timeZone),
        },
      },
      include: { card: true },
    }),
  ]);

  const records: CardPurchaseRecord[] = purchases.map((purchase) => ({
    id: purchase.id,
    description: purchase.description,
    category: purchase.category,
    purchaseDate: purchase.purchaseDate,
    amountCents: purchase.amountCents,
    installmentsTotal: purchase.installmentsTotal,
    card: {
      id: purchase.card.id,
      name: purchase.card.name,
      closingDay: purchase.card.closingDay,
      dueDay: purchase.card.dueDay,
    },
  }));

  const invoiceTotals = invoiceTotalsByCard(records, month);
  const totalsByCard: Record<string, number> = {};
  for (const card of cards) {
    totalsByCard[card.id] = invoiceTotals[card.id] ?? 0;
  }

  return { cards, totalsByCard, monthKey: month };
}
