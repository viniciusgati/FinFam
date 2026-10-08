import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    income: { findMany: vi.fn() },
    variableIncome: { findMany: vi.fn() },
    fixedExpense: { findMany: vi.fn() },
    variableExpense: { findMany: vi.fn() },
    cardPurchase: { findMany: vi.fn() },
    monthlySnapshot: { findMany: vi.fn() },
    appSettings: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { loadCycleAllowance, loadDashboardData } from "./dashboard";
import { computeFinanceStatus } from "./finance";

const referenceDate = new Date(Date.UTC(2026, 9, 15, 12)); // outubro/2026

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.variableExpense.findMany.mockResolvedValue([]);
  prismaMock.variableIncome.findMany.mockResolvedValue([]);
  prismaMock.cardPurchase.findMany.mockResolvedValue([]);
  prismaMock.monthlySnapshot.findMany.mockResolvedValue([]);
});

describe("loadDashboardData — vigência", () => {
  it("não soma entrada inativa", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 100000, active: false, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    const data = await loadDashboardData(referenceDate);

    expect(data.monthlyIncomeCents).toBe(0);
  });

  it("não soma entrada com startMonth futuro", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 100000, active: true, startMonth: "2027-01", endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    const data = await loadDashboardData(referenceDate);

    expect(data.monthlyIncomeCents).toBe(0);
  });

  it("não soma entrada com endMonth passado", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 100000, active: true, startMonth: null, endMonth: "2026-09" },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    const data = await loadDashboardData(referenceDate);

    expect(data.monthlyIncomeCents).toBe(0);
  });

  it("soma a entrada vigente no mês, inclusive nos limites", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 100000, active: true, startMonth: "2026-10", endMonth: "2026-10" },
      { id: "2", amountCents: 50000, active: true, startMonth: "2026-01", endMonth: null },
      { id: "3", amountCents: 25000, active: true, startMonth: null, endMonth: "2026-12" },
      { id: "4", amountCents: 9900, active: false, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    const data = await loadDashboardData(referenceDate);

    expect(data.monthlyIncomeCents).toBe(175000);
  });

  it("aplica a mesma vigência às saídas fixas", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([
      { id: "a", amountCents: 30000, dueDay: 10, active: true, startMonth: "2026-10", endMonth: null },
      { id: "b", amountCents: 80000, dueDay: 5, active: true, startMonth: "2026-11", endMonth: null },
      { id: "c", amountCents: 10000, dueDay: 1, active: false, startMonth: null, endMonth: null },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.fixedExpensesCents).toBe(30000);
  });

  it("soma entradas avulsas do mês à renda mensal", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 100000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.variableIncome.findMany.mockResolvedValue([
      {
        id: "v1",
        description: "Vendi a bicicleta",
        amountCents: 25000,
        date: new Date(Date.UTC(2026, 9, 3, 12)),
      },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.monthlyIncomeCents).toBe(125000);
    const [args] = prismaMock.variableIncome.findMany.mock.calls[0];
    expect(args.where.date.gte.toISOString()).toBe(
      "2026-10-01T03:00:00.000Z",
    );
    expect(args.where.date.lt.toISOString()).toBe(
      "2026-11-01T03:00:00.000Z",
    );
  });
});

interface Row {
  amountCents: number;
  paymentMethod: string;
  date: Date;
}

describe("loadDashboardData — gastos avulsos", () => {
  it("não conta CREDIT e conta CASH/DEBIT/PIX (SPEC §3.3)", async () => {
    const date = new Date(Date.UTC(2026, 9, 5, 12));
    const rows: Row[] = [
      { amountCents: 5000, paymentMethod: "CREDIT", date },
      { amountCents: 1000, paymentMethod: "PIX", date },
      { amountCents: 200, paymentMethod: "DEBIT", date },
      { amountCents: 50, paymentMethod: "CASH", date },
    ];
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.variableExpense.findMany.mockImplementation(
      async ({ where }: { where?: { paymentMethod?: { in?: string[] } } }) => {
        const allowed = where?.paymentMethod?.in;
        return rows.filter(
          (row) => !allowed || allowed.includes(row.paymentMethod),
        );
      },
    );

    const data = await loadDashboardData(referenceDate);

    expect(data.variableExpensesCents).toBe(1250);
  });

  it("exclui CREDIT do filtro enviado ao banco", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    await loadDashboardData(referenceDate);

    const [args] = prismaMock.variableExpense.findMany.mock.calls[0];
    expect(args.where.paymentMethod.in).toEqual(["CASH", "DEBIT", "PIX"]);
  });
});

describe("loadDashboardData — calendário no fuso do Brasil", () => {
  it("consulta outubro quando em Brasília ainda é 31/10 (TZ=UTC)", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    await loadDashboardData(new Date("2026-11-01T02:30:00Z"));

    const [variableArgs] = prismaMock.variableExpense.findMany.mock.calls[0];
    expect(variableArgs.where.date.gte.toISOString()).toBe(
      "2026-10-01T03:00:00.000Z",
    );
    expect(variableArgs.where.date.lt.toISOString()).toBe(
      "2026-11-01T03:00:00.000Z",
    );

    const [snapshotArgs] = prismaMock.monthlySnapshot.findMany.mock.calls[0];
    expect(snapshotArgs.where.monthKey).toEqual({
      gte: "2026-06",
      lt: "2026-10",
    });
  });

  it("vira o mês na meia-noite de Brasília (TZ=UTC)", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    await loadDashboardData(new Date("2026-11-01T03:00:00Z"));

    const [variableArgs] = prismaMock.variableExpense.findMany.mock.calls[0];
    expect(variableArgs.where.date.gte.toISOString()).toBe(
      "2026-11-01T03:00:00.000Z",
    );
    expect(variableArgs.where.date.lt.toISOString()).toBe(
      "2026-12-01T03:00:00.000Z",
    );

    const [snapshotArgs] = prismaMock.monthlySnapshot.findMany.mock.calls[0];
    expect(snapshotArgs.where.monthKey).toEqual({
      gte: "2026-07",
      lt: "2026-11",
    });
  });
});

describe("loadDashboardData — série diária", () => {
  it("monta a série com um valor por dia e soma igual ao consumido", async () => {
    const date = new Date(Date.UTC(2026, 9, 5, 12));
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 310000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([
      { id: "f", amountCents: 10000, dueDay: 10, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.variableExpense.findMany.mockResolvedValue([
      { amountCents: 5000, paymentMethod: "PIX", date },
    ]);

    const data = await loadDashboardData(new Date(Date.UTC(2026, 9, 15, 12)));

    expect(data.series.dailyExpensesCents).toHaveLength(31);
    expect(data.series.dailyExpensesCents[4]).toBe(5000);
    expect(data.series.dailyExpensesCents[9]).toBe(10000);
    const seriesSum = data.series.dailyExpensesCents.reduce(
      (total, value) => total + value,
      0,
    );
    expect(seriesSum).toBe(computeFinanceStatus(data).consumedCents);
    expect(data.series.totalExpensesCents).toBe(seriesSum);
  });
});

describe("loadDashboardData — hasMovements", () => {
  it("é falso quando só há renda fixa cadastrada", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 100000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);

    const data = await loadDashboardData(referenceDate);

    expect(data.hasMovements).toBe(false);
  });

  it("é verdadeiro com despesa fixa vigente", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([
      { id: "f", amountCents: 10000, dueDay: 5, active: true, startMonth: null, endMonth: null },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.hasMovements).toBe(true);
  });

  it("é verdadeiro com despesa avulsa no mês", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.variableExpense.findMany.mockResolvedValue([
      { amountCents: 5000, paymentMethod: "PIX", date: new Date(Date.UTC(2026, 9, 5, 12)) },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.hasMovements).toBe(true);
  });

  it("é verdadeiro com parcela de cartão no mês", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.cardPurchase.findMany.mockResolvedValue([
      {
        id: "p",
        description: "Compra",
        amountCents: 10000,
        purchaseDate: new Date(Date.UTC(2026, 8, 10, 12)),
        category: null,
        installmentNumber: 1,
        installmentsTotal: 1,
        card: { id: "c1", name: "Nubank", closingDay: 20, dueDay: 5 },
      },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.cardExpensesCents).toBe(10000);
    expect(data.hasMovements).toBe(true);
  });

  it("é verdadeiro com entrada avulsa no mês", async () => {
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.variableIncome.findMany.mockResolvedValue([
      { id: "v", amountCents: 5000, date: new Date(Date.UTC(2026, 9, 3, 12)) },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.hasMovements).toBe(true);
  });
});

describe("loadCycleAllowance — diária restante (regressão #231)", () => {
  const card = { id: "c1", name: "Nubank", closingDay: 20, dueDay: 5 };

  it("não zera a diária quando as obrigações de cartão são do mês calendário, mesmo com ciclo ≠ mês", async () => {
    // cycleStartDay = 20 e hoje 05/03/2026 → o ciclo começou em 20/02
    // (cycleKey "2026-02"), mas o percentual do dashboard é do mês calendário
    // (março). Antes a fatura de fevereiro (R$ 10.000) zerava a diária mesmo
    // com o mês corrente longe de 100%.
    prismaMock.appSettings.findUnique.mockResolvedValue({
      id: "singleton",
      cycleStartDay: 20,
    });
    prismaMock.income.findMany.mockResolvedValue([
      { id: "i", amountCents: 1000000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.variableExpense.findMany.mockResolvedValue([
      { amountCents: 20000, paymentMethod: "PIX", date: new Date("2026-03-03T12:00:00.000Z") },
    ]);
    prismaMock.cardPurchase.findMany.mockResolvedValue([
      {
        id: "p-fev",
        description: "Fatura de fevereiro",
        amountCents: 1000000,
        purchaseDate: new Date("2026-01-10T12:00:00.000Z"),
        category: null,
        installmentNumber: 1,
        installmentsTotal: 1,
        card,
      },
      {
        id: "p-mar",
        description: "Fatura de março",
        amountCents: 220000,
        purchaseDate: new Date("2026-02-10T12:00:00.000Z"),
        category: null,
        installmentNumber: 1,
        installmentsTotal: 1,
        card,
      },
    ]);

    const allowance = await loadCycleAllowance(
      new Date("2026-03-05T15:00:00.000Z"),
    );

    // Obrigações do mês calendário (março): fatura de R$ 2.200,00.
    expect(allowance.freeBudgetCents).toBe(760000);
    expect(allowance.dailyCents).toBeGreaterThan(0);
  });

  it("mantém diária 0 quando o orçamento do ciclo realmente esgota", async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      id: "singleton",
      cycleStartDay: 1,
    });
    prismaMock.income.findMany.mockResolvedValue([
      { id: "i", amountCents: 500000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.variableExpense.findMany.mockResolvedValue([]);
    prismaMock.cardPurchase.findMany.mockResolvedValue([
      {
        id: "p",
        description: "Fatura",
        amountCents: 500000,
        purchaseDate: new Date("2026-02-10T12:00:00.000Z"),
        category: null,
        installmentNumber: 1,
        installmentsTotal: 1,
        card,
      },
    ]);

    const allowance = await loadCycleAllowance(
      new Date("2026-03-25T15:00:00.000Z"),
    );

    expect(allowance.freeBudgetCents).toBe(0);
    expect(allowance.dailyCents).toBe(0);
  });

  it("soma entradas avulsas da janela do ciclo ao orçamento livre", async () => {
    // cycleStartDay = 20 e hoje 25/03 → ciclo 20/03–19/04; a janela superior
    // limita em "amanhã" (26/03), como nos gastos avulsos.
    prismaMock.appSettings.findUnique.mockResolvedValue({
      id: "singleton",
      cycleStartDay: 20,
    });
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.variableExpense.findMany.mockResolvedValue([]);
    prismaMock.cardPurchase.findMany.mockResolvedValue([]);
    prismaMock.variableIncome.findMany.mockResolvedValue([
      { id: "v1", amountCents: 30000, date: new Date("2026-03-21T12:00:00.000Z") },
      { id: "v2", amountCents: 9999, date: new Date("2026-03-25T12:00:00.000Z") },
    ]);

    const allowance = await loadCycleAllowance(
      new Date("2026-03-25T15:00:00.000Z"),
    );

    expect(allowance.freeBudgetCents).toBe(39999);
    expect(allowance.hasData).toBe(true);
    const [args] = prismaMock.variableIncome.findMany.mock.calls[0];
    expect(args.where.date.gte.toISOString()).toBe(
      "2026-03-20T03:00:00.000Z",
    );
    expect(args.where.date.lt.toISOString()).toBe(
      "2026-03-26T03:00:00.000Z",
    );
  });
});

describe("loadDashboardData — gastos por categoria", () => {
  it("expõe categoryBreakdown sem nenhuma consulta adicional", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 500000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([
      { id: "f", amountCents: 120000, category: "Moradia", dueDay: 10, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.variableExpense.findMany.mockResolvedValue([
      { amountCents: 6000, category: "Mercado", paymentMethod: "PIX", date: new Date(Date.UTC(2026, 9, 5, 12)) },
    ]);
    prismaMock.cardPurchase.findMany.mockResolvedValue([
      {
        id: "p",
        description: "Compra",
        amountCents: 60000,
        purchaseDate: new Date(Date.UTC(2026, 8, 10, 12)),
        category: "Lazer",
        installmentsTotal: 1,
        card: { id: "c", name: "Nubank", closingDay: 20, dueDay: 5 },
      },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.categoryBreakdown.monthKey).toBe("2026-10");
    expect(data.categoryBreakdown.totalCents).toBe(186000);
    expect(data.categoryBreakdown.totalCents).toBe(
      computeFinanceStatus(data).consumedCents,
    );

    expect(prismaMock.income.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.fixedExpense.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.variableExpense.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.variableIncome.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.cardPurchase.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.monthlySnapshot.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("loadDashboardData — consumo disponível", () => {
  it("expõe entradas − fixas e a média diária do mês", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 500000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([
      { id: "f", amountCents: 300000, dueDay: 10, active: true, startMonth: null, endMonth: null },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.consumption.availableCents).toBe(200000);
    expect(data.consumption.dailyByMonthCents).toBe(6452);
    expect(data.consumption.overCommitted).toBe(false);
  });

  it("marca overCommitted e zera as médias quando as fixas cobrem a renda", async () => {
    prismaMock.income.findMany.mockResolvedValue([
      { id: "1", amountCents: 300000, active: true, startMonth: null, endMonth: null },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([
      { id: "f", amountCents: 300000, dueDay: 10, active: true, startMonth: null, endMonth: null },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.consumption.availableCents).toBe(0);
    expect(data.consumption.overCommitted).toBe(true);
    expect(data.consumption.dailyByMonthCents).toBe(0);
    expect(data.consumption.dailyByCycleCents ?? 0).toBe(0);
  });
});
