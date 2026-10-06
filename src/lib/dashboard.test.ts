import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    income: { findMany: vi.fn(async () => []) },
    fixedExpense: { findMany: vi.fn(async () => []) },
    variableExpense: { findMany: findManyMock },
    cardPurchase: { findMany: vi.fn(async () => []) },
    monthlySnapshot: { findMany: vi.fn(async () => []) },
  },
}));

import { loadDashboardData } from "./dashboard";

const referenceDate = new Date("2026-10-15T12:00:00.000Z");

interface Row {
  amountCents: number;
  paymentMethod: string;
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("loadDashboardData — gastos avulsos", () => {
  it("não conta CREDIT e conta CASH/DEBIT/PIX (SPEC §3.3)", async () => {
    const rows: Row[] = [
      { amountCents: 5000, paymentMethod: "CREDIT" },
      { amountCents: 1000, paymentMethod: "PIX" },
      { amountCents: 200, paymentMethod: "DEBIT" },
      { amountCents: 50, paymentMethod: "CASH" },
    ];
    findManyMock.mockImplementation(
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
    findManyMock.mockResolvedValue([]);

    await loadDashboardData(referenceDate);

    const [args] = findManyMock.mock.calls[0];
    expect(args.where.paymentMethod.in).toEqual(["CASH", "DEBIT", "PIX"]);
  });
});
