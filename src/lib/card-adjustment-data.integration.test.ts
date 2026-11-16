import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { loadCardAdjustmentData } from "./card-adjustment-data";
import { shiftMonthKey } from "./finance";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

/** Compra de cartão auxiliar para os casos de competência. */
interface PurchaseSeed {
  cardId: string;
  description: string;
  amountCents: number;
  purchaseDate: Date;
  installmentsTotal: number;
}

async function createCard(
  name: string,
  options: { active?: boolean; closingDay?: number; dueDay?: number } = {},
) {
  return prisma.creditCard.create({
    data: {
      name,
      active: options.active ?? true,
      closingDay: options.closingDay ?? 20,
      dueDay: options.dueDay ?? 5,
    },
  });
}

function purchaseData(seed: PurchaseSeed) {
  return {
    cardId: seed.cardId,
    description: seed.description,
    amountCents: seed.amountCents,
    purchaseDate: seed.purchaseDate,
    installmentNumber: 1,
    installmentsTotal: seed.installmentsTotal,
  };
}

describe("loadCardAdjustmentData — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lista somente cartões ativos, em ordem de nome", async () => {
    await createCard("Nubank");
    await createCard("Amex");
    await createCard("C6", { active: false });
    await createCard("Inter");

    const data = await loadCardAdjustmentData("2026-12", new Date(2026, 11, 15));

    expect(data.monthKey).toBe("2026-12");
    expect(data.cards.map((card) => card.name)).toEqual([
      "Amex",
      "Inter",
      "Nubank",
    ]);
    expect(data.cards.some((card) => card.name === "C6")).toBe(false);
  });

  it("total por cartão usa a competência do mês-alvo", async () => {
    const nubank = await createCard("Nubank");
    const inter = await createCard("Inter", { closingDay: 10, dueDay: 20 });

    await prisma.cardPurchase.createMany({
      data: [
        // 3 parcelas de 100,00: competem em nov/2026, dez/2026 e jan/2027.
        purchaseData({
          cardId: nubank.id,
          description: "Notebook",
          amountCents: 30000,
          purchaseDate: new Date(2026, 9, 15, 12),
          installmentsTotal: 3,
        }),
        // Compra depois do fechamento: compete em jan/2027, não em dez/2026.
        purchaseData({
          cardId: nubank.id,
          description: "Tênis",
          amountCents: 7000,
          purchaseDate: new Date(2026, 10, 25, 12),
          installmentsTotal: 1,
        }),
        // Fechamento 10/vencimento 20: a compra de dez/2026 compete no próprio mês.
        purchaseData({
          cardId: inter.id,
          description: "Mercado",
          amountCents: 4500,
          purchaseDate: new Date(2026, 11, 5, 12),
          installmentsTotal: 1,
        }),
      ],
    });

    const data = await loadCardAdjustmentData("2026-12", new Date(2026, 11, 15));

    // Só a 2ª parcela do Notebook (100,00) e a compra do Inter (45,00).
    expect(data.totalsByCard[nubank.id]).toBe(10000);
    expect(data.totalsByCard[inter.id]).toBe(4500);
  });

  it("cartão ativo sem compras aparece em cards com total zero", async () => {
    const semCompras = await createCard("Sem compras");
    const comCompra = await createCard("Com compra");

    await prisma.cardPurchase.create({
      data: purchaseData({
        cardId: comCompra.id,
        description: "Livro",
        amountCents: 2000,
        purchaseDate: new Date(2026, 10, 10, 12),
        installmentsTotal: 1,
      }),
    });

    const data = await loadCardAdjustmentData("2026-12", new Date(2026, 11, 15));

    expect(data.cards.map((card) => card.name)).toEqual([
      "Com compra",
      "Sem compras",
    ]);
    expect(data.totalsByCard[semCompras.id]).toBe(0);
    expect(data.totalsByCard[comCompra.id]).toBe(2000);
  });

  it("compra fora da janela de lookback não entra no total", async () => {
    const card = await createCard("Nubank");
    const targetMonthKey = "2026-12";
    // 130 meses antes de dez/2026 (fev/2016), fora do lookback de 121 meses.
    // Com 130 parcelas, a última competiria exatamente em dez/2026 se a compra
    // fosse lida; a janela da consulta precisa descartá-la.
    const purchaseMonth = shiftMonthKey(targetMonthKey, -130);
    const [year, month] = purchaseMonth.split("-").map(Number);

    await prisma.cardPurchase.create({
      data: purchaseData({
        cardId: card.id,
        description: "Compra antiga",
        amountCents: 13000,
        purchaseDate: new Date(year, month - 1, 1, 12),
        installmentsTotal: 130,
      }),
    });

    const data = await loadCardAdjustmentData(
      targetMonthKey,
      new Date(2026, 11, 15),
    );

    expect(data.totalsByCard[card.id]).toBe(0);
  });
});
