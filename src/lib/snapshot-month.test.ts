import { describe, expect, it } from "vitest";
import {
  buildDashboardDataFromSnapshot,
  isCompleteSnapshot,
} from "./snapshot-month";
import type { MonthlySnapshotData } from "./snapshots";

const DAYS = 30;

function completeSnapshot(
  overrides: Partial<MonthlySnapshotData> = {},
): MonthlySnapshotData {
  return {
    monthKey: "2026-09",
    incomeCents: 500000,
    fixedIncomeCents: 480000,
    variableIncomeCents: 20000,
    fixedExpensesCents: 120000,
    variableExpensesCents: 30000,
    cardExpensesCents: 10000,
    consumedCents: 160000,
    consumedPercent: 32,
    consumptionAvailableCents: 380000,
    dailyAverageCents: 12667,
    daysInMonth: DAYS,
    variableDailyCents: Array.from({ length: DAYS }, (_, index) =>
      index === 4 ? 40000 : 0,
    ),
    obligationDailyCents: Array.from({ length: DAYS }, (_, index) =>
      index === 9 ? 120000 : 0,
    ),
    categories: [
      { category: "Mercado", amountCents: 30000 },
      { category: "Moradia", amountCents: 120000 },
    ],
    ...overrides,
  };
}

describe("isCompleteSnapshot", () => {
  it("aceita o snapshot com série diária e split de renda consistentes", () => {
    expect(isCompleteSnapshot(completeSnapshot())).toBe(true);
  });

  it("rejeita captura antiga sem série diária (arrays vazios)", () => {
    expect(
      isCompleteSnapshot(
        completeSnapshot({
          variableDailyCents: [],
          obligationDailyCents: [],
        }),
      ),
    ).toBe(false);
  });

  it("rejeita série com tamanho diferente dos dias do mês", () => {
    expect(
      isCompleteSnapshot(
        completeSnapshot({ variableDailyCents: [1, 2, 3] }),
      ),
    ).toBe(false);
  });

  it("rejeita split de renda que não fecha com o total", () => {
    expect(
      isCompleteSnapshot(completeSnapshot({ fixedIncomeCents: 0 })),
    ).toBe(false);
  });

  it("rejeita snapshot sem dias do mês", () => {
    expect(isCompleteSnapshot(completeSnapshot({ daysInMonth: 0 }))).toBe(
      false,
    );
  });
});

describe("buildDashboardDataFromSnapshot", () => {
  const referenceDate = new Date(Date.UTC(2026, 8, 15, 12));

  it("reconstrói a série diária fechando com o consumido", () => {
    const data = buildDashboardDataFromSnapshot(
      completeSnapshot(),
      referenceDate,
    );

    expect(data.series.daysInMonth).toBe(DAYS);
    expect(data.series.elapsedDay).toBe(DAYS);
    expect(data.series.variableDailyCents[4]).toBe(40000);
    expect(data.series.obligationDailyCents[9]).toBe(120000);
    expect(data.series.dailyExpensesCents[9]).toBe(120000);
    // Prefixo acumulado até o dia 10 (índice 9) = 40 000 + 120 000.
    expect(data.series.cumulativeExpensesCents[9]).toBe(160000);
    expect(data.series.totalExpensesCents).toBe(160000);
    expect(data.series.dailyBudgetCents).toBe(Math.round(500000 / DAYS));
    expect(data.series.projectedMonthEndCents).toBe(160000);
  });

  it("reconstrói o consumo disponível do mês fechado", () => {
    const data = buildDashboardDataFromSnapshot(
      completeSnapshot(),
      referenceDate,
    );

    expect(data.consumption.availableCents).toBe(380000);
    expect(data.consumption.dailyByMonthCents).toBe(12667);
    expect(data.consumption.dailyByElapsedCents).toBe(12667);
    expect(data.consumption.dailyByCycleCents).toBeNull();
    expect(data.consumption.overCommitted).toBe(false);
  });

  it("ordena as categorias por valor desc e usa o consumido como total", () => {
    const data = buildDashboardDataFromSnapshot(
      completeSnapshot(),
      referenceDate,
    );

    expect(data.categoryBreakdown).toEqual({
      monthKey: "2026-09",
      items: [
        { category: "Moradia", amountCents: 120000 },
        { category: "Mercado", amountCents: 30000 },
      ],
      totalCents: 160000,
    });
  });

  it("propaga renda, gastos e movimentação do snapshot", () => {
    const data = buildDashboardDataFromSnapshot(
      completeSnapshot(),
      referenceDate,
    );

    expect(data.monthlyIncomeCents).toBe(500000);
    expect(data.fixedIncomeCents).toBe(480000);
    expect(data.variableIncomeCents).toBe(20000);
    expect(data.fixedExpensesCents).toBe(120000);
    expect(data.variableExpensesCents).toBe(30000);
    expect(data.cardExpensesCents).toBe(10000);
    expect(data.hasMovements).toBe(true);
    expect(data.referenceDate).toBe(referenceDate);
  });

  it("sem consumo nem entradas avulsas não marca movimentação", () => {
    const data = buildDashboardDataFromSnapshot(
      completeSnapshot({
        fixedExpensesCents: 0,
        variableExpensesCents: 0,
        cardExpensesCents: 0,
        variableIncomeCents: 0,
        fixedIncomeCents: 500000,
      }),
      referenceDate,
    );

    expect(data.hasMovements).toBe(false);
  });
});
