import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    income: { findMany: vi.fn() },
    fixedExpense: { findMany: vi.fn() },
    variableExpense: { findMany: vi.fn() },
    cardPurchase: { findMany: vi.fn() },
    monthlySnapshot: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { loadDashboardData } from "./dashboard";

const referenceDate = new Date(Date.UTC(2026, 9, 15, 12)); // outubro/2026

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.variableExpense.findMany.mockResolvedValue([]);
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
      { id: "a", amountCents: 30000, active: true, startMonth: "2026-10", endMonth: null },
      { id: "b", amountCents: 80000, active: true, startMonth: "2026-11", endMonth: null },
      { id: "c", amountCents: 10000, active: false, startMonth: null, endMonth: null },
    ]);

    const data = await loadDashboardData(referenceDate);

    expect(data.fixedExpensesCents).toBe(30000);
  });
});

interface Row {
  amountCents: number;
  paymentMethod: string;
}

describe("loadDashboardData — gastos avulsos", () => {
  it("não conta CREDIT e conta CASH/DEBIT/PIX (SPEC §3.3)", async () => {
    const rows: Row[] = [
      { amountCents: 5000, paymentMethod: "CREDIT" },
      { amountCents: 1000, paymentMethod: "PIX" },
      { amountCents: 200, paymentMethod: "DEBIT" },
      { amountCents: 50, paymentMethod: "CASH" },
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
