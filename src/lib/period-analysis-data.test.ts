import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    variableExpense: { findMany: vi.fn() },
    cardPurchase: { findMany: vi.fn() },
    fixedExpense: { findMany: vi.fn() },
    income: { findMany: vi.fn() },
    creditCard: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import type { CycleReference, DashboardData, DashboardSnapshot } from "./dashboard";
import { loadPeriodAnalysis } from "./period-analysis-data";
import { resolveTimeZone, zonedTimeToUtc } from "./time";

const TIME_ZONE = resolveTimeZone();

function at(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function monthStart(year: number, month: number): Date {
  return zonedTimeToUtc(year, month, 1, TIME_ZONE);
}

function makeSnapshot(monthKey: string): DashboardSnapshot {
  return {
    monthKey,
    incomeCents: 100000,
    consumedCents: 80000,
    consumedPercent: 80,
    categories: [
      { category: "Mercado", amountCents: 30000 },
      { category: "Casa", amountCents: 50000 },
    ],
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 0,
    variableDailyCents: Array.from({ length: 30 }, (_, index) =>
      index === 9 ? 30000 : 0,
    ),
    obligationDailyCents: Array.from({ length: 30 }, (_, index) =>
      index === 9 ? 50000 : 0,
    ),
    daysInMonth: 30,
  };
}

function makeData(now: Date): DashboardData {
  const snapshots = ["2026-01", "2026-02", "2026-03", "2026-04"].map(
    makeSnapshot,
  );
  return {
    monthlyIncomeCents: 100000,
    fixedIncomeCents: 100000,
    variableIncomeCents: 0,
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 10000,
    cardExpensesVariable: true,
    hasMovements: true,
    previousPercents: snapshots.map((snapshot) => snapshot.consumedPercent),
    previousMonthsCents: snapshots.map((snapshot) => snapshot.consumedCents),
    snapshots,
    series: {
      daysInMonth: 31,
      elapsedDay: 15,
      dailyExpensesCents: new Array<number>(31).fill(0),
      cumulativeExpensesCents: [],
      variableDailyCents: Array.from({ length: 31 }, (_, index) =>
        index === 9 ? 30000 : 0,
      ),
      obligationDailyCents: Array.from({ length: 31 }, (_, index) =>
        index === 9 ? 50000 : 0,
      ),
      entriesCents: 100000,
      totalExpensesCents: 90000,
      dailyBudgetCents: 3226,
      projectedMonthEndCents: 90000,
    },
    consumption: {
      availableCents: 50000,
      overCommitted: false,
      dailyByMonthCents: 1613,
      dailyByElapsedCents: 3333,
      dailyByCycleCents: 1613,
      daysInMonth: 31,
      daysElapsed: 15,
      cycleDays: 31,
    },
    categoryBreakdown: {
      monthKey: "2026-05",
      items: [
        { category: "Mercado", amountCents: 40000 },
        { category: "Casa", amountCents: 50000 },
      ],
      totalCents: 90000,
    },
    referenceDate: now,
    periodDays: 31,
    elapsedDays: 15,
  };
}

function makeReference(now: Date): CycleReference {
  return {
    cycleKey: "2026-05",
    window: {
      cycleKey: "2026-05",
      start: monthStart(2026, 5),
      end: zonedTimeToUtc(2026, 5, 31, TIME_ZONE),
      nextStart: monthStart(2026, 6),
      startDay: 1,
    },
    asOf: now,
    isCurrent: true,
    isFuture: false,
  };
}

function iFoodTransactions(): {
  description: string;
  amountCents: number;
  date: Date;
  category: string;
  paymentMethod: string;
  creditCardId: string | null;
}[] {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  return months.flatMap((monthKey) =>
    (monthKey === "2026-05" ? [1, 5, 10, 15] : [5, 10, 15, 20]).map(
      (day) => ({
        description: "iFood",
        amountCents: 5500,
        date: at(`${monthKey}-${String(day).padStart(2, "0")}`),
        category: "Alimentação",
        paymentMethod: "PIX",
        creditCardId: null,
      }),
    ),
  );
}

describe("loadPeriodAnalysis", () => {
  const now = new Date("2026-05-15T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.variableExpense.findMany.mockResolvedValue([]);
    prismaMock.cardPurchase.findMany.mockResolvedValue([]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([]);
    prismaMock.income.findMany.mockResolvedValue([]);
    prismaMock.creditCard.findMany.mockResolvedValue([]);
  });

  it("monta a análise a partir do dashboard e dos lançamentos crus", async () => {
    prismaMock.variableExpense.findMany.mockResolvedValue([
      ...iFoodTransactions(),
      {
        description: "Crédito solto",
        amountCents: 20000,
        date: at("2026-05-12"),
        category: "Casa",
        paymentMethod: "CREDIT",
        creditCardId: "card-1",
      },
      {
        description: "Mercado",
        amountCents: 40000,
        date: at("2026-05-05"),
        category: "Alimentação",
        paymentMethod: "PIX",
        creditCardId: null,
      },
    ]);
    prismaMock.cardPurchase.findMany.mockResolvedValue([
      {
        description: "Notebook",
        amountCents: 90000,
        purchaseDate: at("2026-05-10"),
        category: "Casa",
        cardId: "card-1",
        installmentsTotal: 3,
        installmentNumber: 1,
        card: {
          id: "card-1",
          name: "Cartão principal",
          closingDay: 20,
          dueDay: 5,
        },
      },
    ]);
    prismaMock.fixedExpense.findMany.mockResolvedValue([
      {
        name: "Aluguel",
        amountCents: 50000,
        dueDay: 10,
        category: "Moradia",
        active: true,
      },
      {
        name: "Internet",
        amountCents: 10000,
        dueDay: 20,
        category: "Casa",
        active: true,
      },
    ]);
    prismaMock.income.findMany.mockResolvedValue([
      {
        name: "Salário",
        amountCents: 100000,
        receiveDay: 5,
        active: true,
      },
    ]);
    prismaMock.creditCard.findMany.mockResolvedValue([
      {
        id: "card-1",
        name: "Cartão principal",
        closingDay: 20,
        dueDay: 5,
        limitCents: 500000,
        active: true,
      },
    ]);

    const analysis = await loadPeriodAnalysis({
      data: makeData(now),
      reference: makeReference(now),
      now,
    });

    expect(analysis.period).toMatchObject({
      from: "2026-01",
      to: "2026-05",
      monthsCount: 5,
      closedMonthsCount: 4,
      includesCurrent: true,
    });
    expect(analysis.flow.averageSurplusCents).toBe(20000);
    expect(analysis.dataQuality.creditExpensesWithoutCardCount).toBe(1);
    expect(
      analysis.behavior.merchants.some(
        (merchant) => merchant.merchantKey === "ifood",
      ),
    ).toBe(true);
    expect(
      analysis.levers.some((lever) => lever.id === "frequency-ifood"),
    ).toBe(true);
    expect(analysis.commitments.futureInstallments).toEqual([
      { monthKey: "2026-06", amountCents: 30000, purchaseCount: 1 },
      { monthKey: "2026-07", amountCents: 30000, purchaseCount: 1 },
      { monthKey: "2026-08", amountCents: 30000, purchaseCount: 1 },
    ]);
    expect(analysis.commitments.cards[0]).toMatchObject({
      cardId: "card-1",
      limitCents: 500000,
      futureCents: 90000,
    });

    const [variableArgs] = prismaMock.variableExpense.findMany.mock.calls[0];
    expect(variableArgs.where.date.gte).toEqual(monthStart(2026, 1));
    expect(variableArgs.where.date.lt).toEqual(
      zonedTimeToUtc(2026, 5, 16, TIME_ZONE),
    );
    const [purchaseArgs] = prismaMock.cardPurchase.findMany.mock.calls[0];
    expect(purchaseArgs.where.purchaseDate.gte).toEqual(monthStart(2026, 1));
    expect(purchaseArgs.where.purchaseDate.lt).toEqual(
      zonedTimeToUtc(2026, 5, 16, TIME_ZONE),
    );

    expect(prismaMock.fixedExpense.findMany).toHaveBeenCalledWith({
      where: { active: true },
    });
    expect(prismaMock.income.findMany).toHaveBeenCalledWith({
      where: { active: true },
    });
    expect(prismaMock.creditCard.findMany).toHaveBeenCalledWith({
      where: { active: true },
    });
  });

  it("recorta o fim da janela no próximo ciclo", async () => {
    const lastDay = new Date("2026-05-31T12:00:00.000Z");

    await loadPeriodAnalysis({
      data: makeData(lastDay),
      reference: makeReference(lastDay),
      now: lastDay,
    });

    const [args] = prismaMock.variableExpense.findMany.mock.calls[0];
    expect(args.where.date.lt).toEqual(monthStart(2026, 6));
  });

  it("sem snapshots começa no início do ciclo e sinaliza base curta", async () => {
    const data = makeData(now);
    data.snapshots = [];

    const analysis = await loadPeriodAnalysis({
      data,
      reference: makeReference(now),
      now,
    });

    expect(analysis.period.from).toBe("2026-05");
    expect(analysis.period.closedMonthsCount).toBe(0);
    expect(
      analysis.anomalies.some((anomaly) => anomaly.kind === "short-history"),
    ).toBe(true);

    const [args] = prismaMock.variableExpense.findMany.mock.calls[0];
    expect(args.where.date.gte).toEqual(monthStart(2026, 5));
  });
});
