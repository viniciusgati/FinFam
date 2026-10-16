import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { categoryBreakdownView } from "./category-breakdown";
import {
  loadCycleDashboardData,
  loadDashboardData,
  resolveCycleReference,
} from "./dashboard";
import { computeFinanceStatus } from "./finance";

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

  it("carrega só os meses anteriores válidos (entrada e saída) dos snapshots", async () => {
    await prisma.monthlySnapshot.createMany({
      data: [
        // Válido: entra na base de comparação.
        { monthKey: "2026-06", incomeCents: 100000, fixedExpensesCents: 0, variableExpensesCents: 60000, cardExpensesCents: 0, consumedCents: 60000, consumedPercent: 60 },
        // Sem saída registrada: não é base de comparação.
        { monthKey: "2026-07", incomeCents: 100000, fixedExpensesCents: 0, variableExpensesCents: 0, cardExpensesCents: 0, consumedCents: 0, consumedPercent: 0 },
        // Sem entrada registrada: não é base de comparação.
        { monthKey: "2026-08", incomeCents: 0, fixedExpensesCents: 0, variableExpensesCents: 60000, cardExpensesCents: 0, consumedCents: 60000, consumedPercent: 0 },
        // Válido: entra na base de comparação.
        { monthKey: "2026-09", incomeCents: 100000, fixedExpensesCents: 0, variableExpensesCents: 90000, cardExpensesCents: 0, consumedCents: 90000, consumedPercent: 90 },
      ],
    });

    const data = await loadDashboardData(referenceDate);

    expect(data.previousPercents).toEqual([60, 90]);
    expect(data.previousMonthsCents).toEqual([60000, 90000]);
    expect(data.snapshots.map((snapshot) => snapshot.monthKey)).toEqual([
      "2026-06",
      "2026-09",
    ]);
  });
});

describe("loadCycleDashboardData — integração com PostgreSQL (moldura do ciclo)", () => {
  // 16/10/2026 12:00 BRT: dia 2 do ciclo 15/10–14/11 (cycleStartDay = 15).
  const now = new Date(Date.UTC(2026, 9, 16, 15));

  beforeEach(async () => {
    await resetDatabase();
    await prisma.appSettings.create({
      data: { id: "singleton", cycleStartDay: 15 },
    });
  });

  it("conta fixas, entradas e avulsos pela ocorrência na janela do ciclo", async () => {
    const reference = resolveCycleReference(undefined, now, 15);

    await prisma.income.createMany({
      data: [
        // Recebimento 5 → 05/11 ∈ janela; recebimento 20 → 20/10 ∈ janela.
        { name: "Salário 1", amountCents: 528000, receiveDay: 5 },
        { name: "Salário 2", amountCents: 450000, receiveDay: 20 },
        // Vigência encerrada em setembro: a ocorrência de 10/11 fica fora.
        { name: "Antiga", amountCents: 100000, receiveDay: 10, endMonth: "2026-09" },
      ],
    });

    await prisma.fixedExpense.createMany({
      data: [
        // Vencimento 21 → 21/10 ∈ janela; vencimento 9 → 09/11 ∈ janela.
        { name: "Água", amountCents: 25000, dueDay: 21 },
        { name: "Carro", amountCents: 135000, dueDay: 9 },
        // A ocorrência de 15/10 cai em outubro/2026, depois do endMonth.
        { name: "Encerrada", amountCents: 9999, dueDay: 15, endMonth: "2026-09" },
      ],
    });

    await prisma.variableExpense.createMany({
      data: [
        // Antes do início do ciclo: fora.
        { description: "Mercado", amountCents: 70000, date: new Date(2026, 9, 10), paymentMethod: "PIX" },
        // Dentro do ciclo: entra.
        { description: "Badminton", amountCents: 15000, date: new Date(2026, 9, 15), paymentMethod: "PIX" },
      ],
    });

    const data = await loadCycleDashboardData(reference, now);

    expect(data.fixedIncomeCents).toBe(978000);
    expect(data.variableIncomeCents).toBe(0);
    expect(data.monthlyIncomeCents).toBe(978000);
    expect(data.fixedExpensesCents).toBe(160000);
    expect(data.variableExpensesCents).toBe(15000);
    expect(data.hasMovements).toBe(true);
    expect(data.periodDays).toBe(31);
    expect(data.elapsedDays).toBe(2);
    expect(data.series.totalExpensesCents).toBe(175000);
    expect(data.categoryBreakdown.totalCents).toBe(175000);
    expect(data.referenceDate).toBe(reference.asOf);

    const status = computeFinanceStatus(data);
    expect(status.consumedCents).toBe(175000);
    expect(status.daysElapsed).toBe(2);
    expect(status.daysInMonth).toBe(31);
  });

  it("conta a compra do cartão pela data e mostra a fatura antiga só na linha informativa", async () => {
    const reference = resolveCycleReference("2026-10", now, 15);
    const card = await prisma.creditCard.create({
      data: { name: "Itau", closingDay: 15, dueDay: 21 },
    });

    await prisma.cardPurchase.createMany({
      data: [
        // Compra 20/09: a fatura dela vence 21/10 (é paga no ciclo), mas a
        // compra é do ciclo anterior — fica só na linha informativa.
        {
          cardId: card.id,
          description: "Compra do ciclo passado",
          amountCents: 30000,
          purchaseDate: new Date(2026, 8, 20),
          installmentsTotal: 1,
        },
        // Compra 20/10: dentro da janela (15/10–14/11).
        {
          cardId: card.id,
          description: "Compra do ciclo",
          amountCents: 20000,
          purchaseDate: new Date(2026, 9, 20),
          installmentsTotal: 1,
        },
        // Compra 16/11: já é do ciclo seguinte.
        {
          cardId: card.id,
          description: "Compra futura",
          amountCents: 40000,
          purchaseDate: new Date(2026, 10, 16),
          installmentsTotal: 1,
        },
      ],
    });

    const data = await loadCycleDashboardData(reference, now);

    expect(data.cardExpensesCents).toBe(20000);
    expect(data.invoicePaymentCents).toBe(30000);
    expect(data.hasMovements).toBe(true);
    expect(data.series.totalExpensesCents).toBe(20000);
    expect(data.categoryBreakdown.totalCents).toBe(20000);
  });

  it("a diária do ciclo usa a mesma janela do card principal (invariante #231)", async () => {
    const reference = resolveCycleReference(undefined, now, 15);

    await prisma.income.create({
      data: { name: "Salário", amountCents: 978000, receiveDay: 20 },
    });
    await prisma.fixedExpense.create({
      data: { name: "Fixas", amountCents: 160000, dueDay: 21 },
    });
    const card = await prisma.creditCard.create({
      data: { name: "Itau", closingDay: 15, dueDay: 21 },
    });
    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Compra do ciclo",
        amountCents: 100000,
        purchaseDate: new Date(2026, 9, 20),
        installmentsTotal: 1,
      },
    });
    await prisma.variableExpense.create({
      data: {
        description: "Avulso no ciclo",
        amountCents: 18000,
        date: new Date(2026, 9, 15),
        paymentMethod: "PIX",
      },
    });

    const data = await loadCycleDashboardData(reference, now);
    const status = computeFinanceStatus(data);

    // Consumido do card = fixas + compras do cartão + avulsos da mesma janela.
    expect(status.consumedCents).toBe(160000 + 100000 + 18000);
    expect(data.fixedExpensesCents + data.cardExpensesCents + data.variableExpensesCents).toBe(
      status.consumedCents,
    );
  });
});
