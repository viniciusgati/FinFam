import { describe, expect, it } from "vitest";
import { buildSnapshot, monthRange, type SnapshotTransactionInput } from "./snapshots";

function input(
  overrides: Partial<SnapshotTransactionInput> = {},
): SnapshotTransactionInput {
  return {
    monthKey: "2026-10",
    incomes: [
      { amountCents: 100000, active: true },
      { amountCents: 50000, active: false },
    ],
    fixedExpenses: [
      { amountCents: 20000, active: true },
      { amountCents: 99999, active: false },
    ],
    variableExpenses: [
      {
        amountCents: 10000,
        date: new Date(2026, 9, 5),
        paymentMethod: "PIX",
      },
      {
        amountCents: 7000,
        date: new Date(2026, 9, 6),
        paymentMethod: "CREDIT",
      },
      {
        amountCents: 8000,
        date: new Date(2026, 8, 30),
        paymentMethod: "CASH",
      },
      {
        amountCents: 5000,
        date: new Date(2026, 10, 1),
        paymentMethod: "DEBIT",
      },
    ],
    cardPurchases: [
      { amountCents: 30000, purchaseDate: new Date(2026, 9, 8) },
      { amountCents: 40000, purchaseDate: new Date(2026, 8, 20) },
    ],
    ...overrides,
  };
}

describe("monthRange", () => {
  it("retorna os últimos N meses estritamente anteriores ao corrente", () => {
    expect(monthRange(new Date(2026, 9, 10), 4)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("nunca inclui o mês corrente", () => {
    expect(monthRange(new Date(2026, 9, 10), 4)).not.toContain("2026-10");
  });

  it("atravessa a virada de ano", () => {
    expect(monthRange(new Date(2026, 0, 15), 2)).toEqual(["2025-11", "2025-12"]);
  });
});

describe("buildSnapshot", () => {
  it("soma as quatro categorias e ignora itens inativos", () => {
    const snapshot = buildSnapshot(input());

    expect(snapshot.incomeCents).toBe(100000);
    expect(snapshot.fixedExpensesCents).toBe(20000);
    expect(snapshot.variableExpensesCents).toBe(10000);
    expect(snapshot.cardExpensesCents).toBe(30000);
    expect(snapshot.consumedCents).toBe(60000);
    expect(snapshot.consumedPercent).toBeCloseTo(60);
  });

  it("respeita os limites do mês e exclui gastos no crédito", () => {
    const snapshot = buildSnapshot(input());

    expect(snapshot.variableExpensesCents).toBe(10000);
    expect(snapshot.cardExpensesCents).toBe(30000);
  });

  it("zera o percentual quando não há renda", () => {
    const snapshot = buildSnapshot(input({ incomes: [] }));

    expect(snapshot.incomeCents).toBe(0);
    expect(snapshot.consumedPercent).toBe(0);
  });

  it("é idempotente: o mesmo input produz o mesmo output", () => {
    const data = input();

    expect(buildSnapshot(data)).toEqual(buildSnapshot(data));
  });
});
