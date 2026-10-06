import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import {
  invoiceLinesForMonth,
  sumCardExpensesForMonth,
  type CardPurchaseForMonth,
  type CardPurchaseRecord,
} from "./invoices";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

/** Cartão com fechamento 20 e vencimento 5 (competência = ciclo + 1 mês). */
async function createCard(name = "Nubank") {
  return prisma.creditCard.create({
    data: { name, closingDay: 20, dueDay: 5 },
  });
}

describe("fatura/parcelas — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("usa o PostgreSQL de teste (TEST_DATABASE_URL), nunca SQLite", async () => {
    const url = requireTestDatabase();
    expect(url).toMatch(/^postgres(ql)?:\/\//);
    expect(url.startsWith("file:")).toBe(false);

    const [row] = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version()
    `;
    expect(row.version).toContain("PostgreSQL");
  });

  it("aloca uma compra parcelada ao mês de competência correto", async () => {
    const card = await createCard();
    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Notebook",
        amountCents: 300000,
        purchaseDate: new Date(2026, 10, 15), // 15/11/2026, antes do fechamento
        installmentsTotal: 3,
        installmentNumber: 1,
      },
    });

    const persisted = await prisma.cardPurchase.findMany({
      include: { card: true },
    });
    const purchases: CardPurchaseForMonth[] = persisted.map((purchase) => ({
      purchaseDate: purchase.purchaseDate,
      amountCents: purchase.amountCents,
      installmentsTotal: purchase.installmentsTotal,
      card: {
        closingDay: purchase.card.closingDay,
        dueDay: purchase.card.dueDay,
      },
    }));

    // Ciclo 2026-11; com vencimento 5 após fechamento 20, a 1ª parcela vence em
    // 2026-12 e as seguintes em jan/2027 e fev/2027. O mês da compra não recebe
    // parcela alguma.
    expect(sumCardExpensesForMonth(purchases, "2026-11")).toBe(0);
    expect(sumCardExpensesForMonth(purchases, "2026-12")).toBe(100000);
    expect(sumCardExpensesForMonth(purchases, "2027-01")).toBe(100000);
    expect(sumCardExpensesForMonth(purchases, "2027-02")).toBe(100000);
  });

  it("soma das parcelas persistidas é igual a amountCents", async () => {
    const card = await createCard();
    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Geladeira",
        amountCents: 10000,
        purchaseDate: new Date(2026, 10, 15),
        installmentsTotal: 3,
      },
    });

    const persisted = await prisma.cardPurchase.findMany({
      include: { card: true },
    });
    const records: CardPurchaseRecord[] = persisted.map((purchase) => ({
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

    const total = ["2026-12", "2027-01", "2027-02"].reduce(
      (sum, monthKey) => sum + invoiceLinesForMonth(records, monthKey).totalCents,
      0,
    );

    expect(total).toBe(10000);
    expect(records[0].amountCents).toBe(10000);
  });

  it("monta a fatura de um mês com os metadados da compra persistida", async () => {
    const card = await createCard("Visa");
    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Passagem",
        category: "Viagem",
        amountCents: 300000,
        purchaseDate: new Date(2026, 10, 15),
        installmentsTotal: 3,
      },
    });

    const persisted = await prisma.cardPurchase.findMany({
      include: { card: true },
    });
    const records: CardPurchaseRecord[] = persisted.map((purchase) => ({
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

    const invoice = invoiceLinesForMonth(records, "2027-01");

    expect(invoice.totalCents).toBe(100000);
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({
      description: "Passagem",
      category: "Viagem",
      cardName: "Visa",
      installmentNumber: 2,
      installmentsTotal: 3,
      amountCents: 100000,
    });
  });

  it("empurra para o mês seguinte a compra feita após o fechamento", async () => {
    const card = await createCard();
    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Tênis",
        amountCents: 50000,
        purchaseDate: new Date(2026, 2, 25), // 25/03/2026, depois do fechamento 20
        installmentsTotal: 1,
      },
    });

    const persisted = await prisma.cardPurchase.findMany({
      include: { card: true },
    });
    const purchases: CardPurchaseForMonth[] = persisted.map((purchase) => ({
      purchaseDate: purchase.purchaseDate,
      amountCents: purchase.amountCents,
      installmentsTotal: purchase.installmentsTotal,
      card: {
        closingDay: purchase.card.closingDay,
        dueDay: purchase.card.dueDay,
      },
    }));

    // Ciclo 2026-04 e vencimento 2026-05.
    expect(sumCardExpensesForMonth(purchases, "2026-04")).toBe(0);
    expect(sumCardExpensesForMonth(purchases, "2026-05")).toBe(50000);
  });
});
