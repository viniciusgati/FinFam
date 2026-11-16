import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { POST } from "@/app/api/card-purchases/route";
import { invoiceTotalsByCard } from "./card-adjustment";
import { invoiceLinesForMonth, type CardPurchaseRecord } from "./invoices";
import { buildQuickCardPurchasePayload } from "./quick-expense";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

/** Cartão com fechamento 20 e vencimento 5 (competência = ciclo + 1 mês). */
async function createCard(name = "Nubank") {
  return prisma.creditCard.create({
    data: { name, active: true, closingDay: 20, dueDay: 5 },
  });
}

/** Envia o payload do lançamento rápido ao `POST /api/card-purchases` real. */
function postQuickCardPurchase(payload: unknown) {
  return POST(
    new Request("http://localhost/api/card-purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

/** Compras persistidas no formato consumido pelas regras de fatura. */
async function loadRecords(): Promise<CardPurchaseRecord[]> {
  const purchases = await prisma.cardPurchase.findMany({
    include: { card: true },
  });
  return purchases.map((purchase) => ({
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
}

describe("lançamento rápido no cartão — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("compra de R$ 100,00 em 2026-03-10 (fechamento 20/vencimento 5) compete em 2026-04", async () => {
    const card = await createCard();

    const payload = buildQuickCardPurchasePayload({
      target: "card",
      cardId: card.id,
      description: "Mercado",
      amount: "100,00",
      date: "2026-03-10",
    });
    expect(payload).not.toBeNull();

    const response = await postQuickCardPurchase(payload);
    expect(response.status).toBe(201);

    // Compra de cartão nunca cria gasto avulso (sem dupla contagem).
    expect(await prisma.variableExpense.count()).toBe(0);

    const records = await loadRecords();

    // Compra antes do fechamento: ciclo 2026-03 e competência 2026-04.
    expect(invoiceTotalsByCard(records, "2026-04")).toEqual({
      [card.id]: 10000,
    });
    expect(invoiceTotalsByCard(records, "2026-03")).toEqual({});

    const invoice = invoiceLinesForMonth(records, "2026-04");
    expect(invoice.totalCents).toBe(10000);
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({
      cardId: card.id,
      cardName: "Nubank",
      description: "Mercado",
      installmentNumber: 1,
      installmentsTotal: 1,
      amountCents: 10000,
    });
  });

  it("compra de 2026-02-10 compete em 2026-03 e aparece na fatura do ciclo corrente", async () => {
    const card = await createCard();

    const payload = buildQuickCardPurchasePayload({
      target: "card",
      cardId: card.id,
      description: "Feira",
      amount: "120,00",
      date: "2026-02-10",
    });
    expect(payload).not.toBeNull();

    const response = await postQuickCardPurchase(payload);
    expect(response.status).toBe(201);

    expect(await prisma.variableExpense.count()).toBe(0);

    const records = await loadRecords();
    expect(invoiceTotalsByCard(records, "2026-03")).toEqual({
      [card.id]: 12000,
    });
    expect(invoiceTotalsByCard(records, "2026-02")).toEqual({});
  });
});
