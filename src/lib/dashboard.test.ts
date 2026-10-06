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

const referenceDate = new Date(2026, 9, 15); // outubro/2026

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
