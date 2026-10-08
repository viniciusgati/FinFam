import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { categoryBreakdownView } from "./category-breakdown";
import { loadDashboardData } from "./dashboard";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

const referenceDate = new Date(2026, 9, 15); // outubro/2026

describe("loadDashboardData — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("persiste e lê pelo PostgreSQL de teste (TEST_DATABASE_URL), nunca SQLite", async () => {
    const url = requireTestDatabase();
    expect(url).toMatch(/^postgres(ql)?:\/\//);

    const [row] = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version()
    `;
    expect(row.version).toContain("PostgreSQL");
  });

  it("soma entradas e saídas fixas vigentes e ignora inativas/fora de vigência", async () => {
    await prisma.income.createMany({
      data: [
        { name: "Salário", amountCents: 500000, startMonth: "2026-10" },
        { name: "Antiga", amountCents: 100000, active: false },
        { name: "Futura", amountCents: 200000, startMonth: "2026-11" },
        { name: "Encerrada", amountCents: 300000, endMonth: "2026-09" },
      ],
    });

    await prisma.fixedExpense.createMany({
      data: [
        { name: "Aluguel", amountCents: 120000 },
        { name: "Inativa", amountCents: 80000, active: false },
        { name: "Futura", amountCents: 50000, startMonth: "2026-11" },
      ],
    });

    const data = await loadDashboardData(referenceDate);

    expect(data.monthlyIncomeCents).toBe(500000);
    expect(data.fixedExpensesCents).toBe(120000);
  });

  it("soma entradas avulsas do mês à renda e ignora as de outros meses", async () => {
    await prisma.variableIncome.createMany({
      data: [
        {
          description: "Vendi a bicicleta",
          amountCents: 35000,
          date: new Date(2026, 9, 3),
        },
        {
          description: "Saldo de setembro",
          amountCents: 9999,
          date: new Date(2026, 8, 30),
        },
      ],
    });

    const data = await loadDashboardData(referenceDate);

    expect(data.monthlyIncomeCents).toBe(35000);
  });

  it("conta gastos avulsos CASH/DEBIT/PIX do mês e ignora CREDIT e fora do mês", async () => {
    await prisma.variableExpense.createMany({
      data: [
        { description: "Mercado", amountCents: 1000, date: new Date(2026, 9, 5), paymentMethod: "CASH" },
        { description: "Farmácia", amountCents: 2000, date: new Date(2026, 9, 10), paymentMethod: "PIX" },
        { description: "Padaria", amountCents: 3000, date: new Date(2026, 9, 20), paymentMethod: "DEBIT" },
        { description: "Cartão", amountCents: 9000, date: new Date(2026, 9, 15), paymentMethod: "CREDIT" },
        { description: "Mês passado", amountCents: 5000, date: new Date(2026, 8, 30), paymentMethod: "CASH" },
      ],
    });

    const data = await loadDashboardData(referenceDate);

    expect(data.variableExpensesCents).toBe(6000);
  });

  it("soma a parcela de cartão cuja competência cai no mês de referência", async () => {
    const card = await prisma.creditCard.create({
      data: { name: "Nubank", closingDay: 20, dueDay: 5 },
    });

    await prisma.cardPurchase.createMany({
      data: [
        // Compra em 10/09/2026 → ciclo 2026-09, vence em 2026-10: entra no mês.
        {
          cardId: card.id,
          description: "Móveis",
          amountCents: 60000,
          purchaseDate: new Date(2026, 8, 10),
          installmentsTotal: 1,
        },
        // Parcelada a partir de 11/2026: não entra em outubro/2026.
        {
          cardId: card.id,
          description: "Notebook",
          amountCents: 300000,
          purchaseDate: new Date(2026, 10, 15),
          installmentsTotal: 3,
        },
      ],
    });

    const data = await loadDashboardData(referenceDate);

    expect(data.cardExpensesCents).toBe(60000);
  });

  it("expõe categoryBreakdown cuja soma das fatias fecha com o total consumido", async () => {
    await prisma.fixedExpense.createMany({
      data: [
        { name: "Aluguel", amountCents: 120000, category: "Moradia" },
        { name: "Internet", amountCents: 10000, category: "Moradia" },
      ],
    });

    await prisma.variableExpense.createMany({
      data: [
        { description: "Mercado", amountCents: 5000, date: new Date(2026, 9, 5), paymentMethod: "CASH", category: "Mercado" },
        { description: "Farmácia", amountCents: 2000, date: new Date(2026, 9, 10), paymentMethod: "PIX", category: "Saúde" },
        { description: "Diversos", amountCents: 3000, date: new Date(2026, 9, 6), paymentMethod: "CASH", category: null },
        { description: "Cartão", amountCents: 9999, date: new Date(2026, 9, 15), paymentMethod: "CREDIT", category: "Lazer" },
      ],
    });

    const card = await prisma.creditCard.create({
      data: { name: "Nubank", closingDay: 20, dueDay: 5 },
    });

    await prisma.cardPurchase.createMany({
      data: [
        // Compra parcelada em 3x em 10/09/2026 → 1ª parcela vence em 2026-10:
        // o mês recebe apenas a parcela (resto na 1ª), nunca o valor integral.
        {
          cardId: card.id,
          description: "Móveis",
          amountCents: 90000,
          purchaseDate: new Date(2026, 8, 10),
          installmentsTotal: 3,
          category: "Casa",
        },
        // Parcelada a partir de 11/2026: não entra em outubro/2026.
        {
          cardId: card.id,
          description: "Notebook",
          amountCents: 300000,
          purchaseDate: new Date(2026, 10, 15),
          installmentsTotal: 3,
          category: "Eletrônicos",
        },
      ],
    });

    const data = await loadDashboardData(referenceDate);
    const fatiasCents = data.categoryBreakdown.items.reduce(
      (total, item) => total + item.amountCents,
      0,
    );

    expect(fatiasCents).toBe(data.categoryBreakdown.totalCents);
    expect(data.categoryBreakdown.totalCents).toBe(
      data.fixedExpensesCents +
        data.variableExpensesCents +
        data.cardExpensesCents,
    );
    // Uma parcela de R$ 300,00 (não o total de R$ 900,00) entra em outubro.
    expect(data.cardExpensesCents).toBe(30000);
    // Avulso CREDIT não entra em nenhuma fatia (SPEC §3.3).
    expect(
      data.categoryBreakdown.items.some((item) => item.category === "Lazer"),
    ).toBe(false);

    // A view do gráfico soma as fatias == total == consumo do mês e fecha 100%.
    const view = categoryBreakdownView(data.categoryBreakdown);
    expect(
      view.slices.reduce((total, slice) => total + slice.amountCents, 0),
    ).toBe(data.categoryBreakdown.totalCents);
    expect(
      view.slices.reduce((total, slice) => total + slice.percent, 0),
    ).toBe(100);
    // Vazio/ausente vira uma única fatia "Sem categoria".
    expect(view.slices.some((slice) => slice.category === "Sem categoria")).toBe(
      true,
    );
  });

  it("carrega os percentuais dos meses anteriores a partir dos snapshots", async () => {
    await prisma.monthlySnapshot.createMany({
      data: [
        { monthKey: "2026-08", incomeCents: 1, fixedExpensesCents: 0, variableExpensesCents: 0, cardExpensesCents: 0, consumedCents: 0, consumedPercent: 20 },
        { monthKey: "2026-09", incomeCents: 1, fixedExpensesCents: 0, variableExpensesCents: 0, cardExpensesCents: 0, consumedCents: 0, consumedPercent: 30 },
      ],
    });

    const data = await loadDashboardData(referenceDate);

    expect(data.previousPercents).toEqual([20, 30]);
  });
});
