import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { loadDashboardData } from "./dashboard";
import { buildSnapshot } from "./snapshots";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

// Setembro/2026 (mês fechado): a competência da fatura cai no mês seguinte.
const referenceDate = new Date(2026, 8, 15);

describe("buildSnapshot — paridade com loadDashboardData", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("iguala os agregados do dashboard e a soma das categorias", async () => {
    await prisma.income.createMany({
      data: [
        { name: "Salário", amountCents: 200000 },
        { name: "Inativa", amountCents: 99999, active: false },
      ],
    });

    await prisma.fixedExpense.createMany({
      data: [
        { name: "Aluguel", amountCents: 80000, category: "Moradia" },
        { name: "Encerrada", amountCents: 50000, endMonth: "2026-08" },
      ],
    });

    await prisma.variableIncome.create({
      data: {
        description: "Vendi a bicicleta",
        amountCents: 5000,
        date: new Date(2026, 8, 3),
      },
    });

    await prisma.variableExpense.createMany({
      data: [
        {
          description: "Mercado",
          amountCents: 10000,
          date: new Date(2026, 8, 5),
          paymentMethod: "PIX",
          category: "Mercado",
        },
        {
          description: "No crédito (fora do orçamento)",
          amountCents: 9999,
          date: new Date(2026, 8, 6),
          paymentMethod: "CREDIT",
          category: "Lazer",
        },
      ],
    });

    const card = await prisma.creditCard.create({
      data: { name: "Nubank", closingDay: 20, dueDay: 5 },
    });

    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Móveis",
        amountCents: 90000,
        purchaseDate: new Date(2026, 7, 10),
        installmentsTotal: 3,
        category: "Casa",
      },
    });

    const data = await loadDashboardData(referenceDate);

    const [incomes, fixedExpenses, variableIncomes, variableExpenses, cardPurchases] =
      await Promise.all([
        prisma.income.findMany({ where: { active: true } }),
        prisma.fixedExpense.findMany({ where: { active: true } }),
        prisma.variableIncome.findMany({
          where: { date: { gte: new Date(2026, 8, 1), lt: new Date(2026, 9, 1) } },
        }),
        prisma.variableExpense.findMany({
          where: { date: { gte: new Date(2026, 8, 1), lt: new Date(2026, 9, 1) } },
        }),
        prisma.cardPurchase.findMany({
          where: { purchaseDate: { lt: new Date(2026, 9, 1) } },
          include: { card: true },
        }),
      ]);

    const snapshot = buildSnapshot({
      monthKey: "2026-09",
      incomes,
      variableIncomes,
      fixedExpenses,
      variableExpenses,
      cardPurchases,
    });

    // Paridade exata de valores com o dashboard (vigência + competência).
    expect(snapshot.incomeCents).toBe(data.monthlyIncomeCents);
    expect(snapshot.fixedExpensesCents).toBe(data.fixedExpensesCents);
    expect(snapshot.variableExpensesCents).toBe(data.variableExpensesCents);
    expect(snapshot.cardExpensesCents).toBe(data.cardExpensesCents);
    expect(snapshot.consumedCents).toBe(
      data.fixedExpensesCents +
        data.variableExpensesCents +
        data.cardExpensesCents,
    );

    // Consumo disponível e média diária alinhados ao dashboard (30 dias).
    expect(snapshot.daysInMonth).toBe(30);
    expect(snapshot.consumptionAvailableCents).toBe(
      data.consumption.availableCents,
    );
    expect(snapshot.dailyAverageCents).toBe(
      data.consumption.dailyByMonthCents,
    );

    // Invariante: a soma das categorias fecha com o total consumido.
    const categoriasCents = snapshot.categories.reduce(
      (total, category) => total + category.amountCents,
      0,
    );
    expect(categoriasCents).toBe(snapshot.consumedCents);
    expect(snapshot.categories.some((item) => item.category === "Lazer")).toBe(
      false,
    );
  });
});
