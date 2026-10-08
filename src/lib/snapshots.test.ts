import { describe, expect, it } from "vitest";
import { isActiveInMonth, monthKey } from "./finance";
import { sumCardExpensesForMonth } from "./invoices";
import { buildSnapshot, monthRange, type SnapshotTransactionInput } from "./snapshots";

/** Cartão com fechamento 20 e vencimento 28: competência = mês do ciclo. */
const card = { closingDay: 20, dueDay: 28 };

function input(
  overrides: Partial<SnapshotTransactionInput> = {},
): SnapshotTransactionInput {
  return {
    monthKey: "2026-10",
    incomes: [
      { amountCents: 100000, active: true },
      { amountCents: 50000, active: false },
    ],
    variableIncomes: [
      { amountCents: 25000, date: new Date(Date.UTC(2026, 9, 3, 12)) },
      { amountCents: 99999, date: new Date(Date.UTC(2026, 8, 15, 12)) },
    ],
    fixedExpenses: [
      { amountCents: 20000, active: true },
      { amountCents: 99999, active: false },
    ],
    variableExpenses: [
      {
        amountCents: 10000,
        date: new Date(Date.UTC(2026, 9, 5, 12)),
        paymentMethod: "PIX",
      },
      {
        amountCents: 7000,
        date: new Date(Date.UTC(2026, 9, 6, 12)),
        paymentMethod: "CREDIT",
      },
      {
        amountCents: 8000,
        date: new Date(Date.UTC(2026, 8, 30, 12)),
        paymentMethod: "CASH",
      },
      {
        amountCents: 5000,
        date: new Date(Date.UTC(2026, 10, 1, 12)),
        paymentMethod: "DEBIT",
      },
    ],
    cardPurchases: [
      {
        amountCents: 30000,
        purchaseDate: new Date(Date.UTC(2026, 9, 8, 12)),
        installmentsTotal: 1,
        card,
      },
      {
        amountCents: 40000,
        purchaseDate: new Date(Date.UTC(2026, 8, 20, 12)),
        installmentsTotal: 1,
        card,
      },
    ],
    ...overrides,
  };
}

describe("monthRange", () => {
  it("retorna os últimos N meses estritamente anteriores ao corrente", () => {
    expect(monthRange(new Date(Date.UTC(2026, 9, 10, 12)), 4)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  it("nunca inclui o mês corrente", () => {
    expect(monthRange(new Date(Date.UTC(2026, 9, 10, 12)), 4)).not.toContain("2026-10");
  });

  it("atravessa a virada de ano", () => {
    expect(monthRange(new Date(Date.UTC(2026, 0, 15, 12)), 2)).toEqual(["2025-11", "2025-12"]);
  });
});

describe("buildSnapshot", () => {
  it("soma as categorias, inclui entradas avulsas do mês e ignora inativas", () => {
    const snapshot = buildSnapshot(input());

    expect(snapshot.incomeCents).toBe(125000);
    expect(snapshot.fixedExpensesCents).toBe(20000);
    expect(snapshot.variableExpensesCents).toBe(10000);
    expect(snapshot.cardExpensesCents).toBe(30000);
    expect(snapshot.consumedCents).toBe(60000);
    expect(snapshot.consumedPercent).toBeCloseTo(48);
  });

  it("respeita os limites do mês e exclui gastos no crédito", () => {
    const snapshot = buildSnapshot(input());

    expect(snapshot.incomeCents).toBe(125000);
    expect(snapshot.variableExpensesCents).toBe(10000);
    expect(snapshot.cardExpensesCents).toBe(30000);
  });

  it("ignora itens fixos fora da vigência (endMonth anterior/startMonth posterior)", () => {
    const snapshot = buildSnapshot(
      input({
        incomes: [
          { amountCents: 100000, active: true },
          { amountCents: 7000, active: true, endMonth: "2026-09" },
          { amountCents: 9000, active: true, startMonth: "2026-11" },
        ],
        fixedExpenses: [
          { amountCents: 20000, active: true },
          { amountCents: 5000, active: true, endMonth: "2026-08" },
          { amountCents: 6000, active: true, startMonth: "2026-10" },
        ],
      }),
    );

    // 100000 (fixa) + 25000 (avulsa de outubro); as fora da vigência não entram.
    expect(snapshot.incomeCents).toBe(125000);
    // 20000 + 6000 (startMonth == mês, vigência inclusiva); endMonth anterior sai.
    expect(snapshot.fixedExpensesCents).toBe(26000);
  });

  it("conta o cartão pela competência, não pelo purchaseDate", () => {
    const data = input();
    const snapshot = buildSnapshot(data);

    // A compra de 30/09 tem competência em setembro, não em outubro.
    expect(snapshot.cardExpensesCents).toBe(30000);
    expect(snapshot.cardExpensesCents).toBe(
      sumCardExpensesForMonth(data.cardPurchases, data.monthKey),
    );
  });

  it("inclui parcela de compra feita antes da janela com competência no mês", () => {
    const cardPurchases = [
      {
        amountCents: 9000,
        // Compra de agosto (2 meses antes de outubro), 3 parcelas:
        // 3000 em ago, 3000 em set e 3000 em out.
        purchaseDate: new Date(Date.UTC(2026, 7, 10, 12)),
        installmentsTotal: 3,
        card,
      },
    ];
    const snapshot = buildSnapshot(input({ cardPurchases }));

    expect(snapshot.cardExpensesCents).toBe(3000);
    expect(snapshot.cardExpensesCents).toBe(
      sumCardExpensesForMonth(cardPurchases, "2026-10"),
    );
  });

  it("tem paridade com o cálculo do dashboard (vigência + competência)", () => {
    const data = input();
    const snapshot = buildSnapshot(data);

    const expectedIncomeCents =
      data.incomes
        .filter((item) => isActiveInMonth(item, data.monthKey))
        .reduce((total, item) => total + item.amountCents, 0) +
      data.variableIncomes
        .filter((item) => monthKey(item.date) === data.monthKey)
        .reduce((total, item) => total + item.amountCents, 0);
    const expectedFixedExpensesCents = data.fixedExpenses
      .filter((item) => isActiveInMonth(item, data.monthKey))
      .reduce((total, item) => total + item.amountCents, 0);
    const expectedVariableExpensesCents = data.variableExpenses
      .filter(
        (item) =>
          monthKey(item.date) === data.monthKey &&
          item.paymentMethod !== "CREDIT",
      )
      .reduce((total, item) => total + item.amountCents, 0);
    const expectedCardExpensesCents = sumCardExpensesForMonth(
      data.cardPurchases,
      data.monthKey,
    );
    const expectedConsumedCents =
      expectedFixedExpensesCents +
      expectedVariableExpensesCents +
      expectedCardExpensesCents;

    expect(snapshot.incomeCents).toBe(expectedIncomeCents);
    expect(snapshot.fixedExpensesCents).toBe(expectedFixedExpensesCents);
    expect(snapshot.variableExpensesCents).toBe(expectedVariableExpensesCents);
    expect(snapshot.cardExpensesCents).toBe(expectedCardExpensesCents);
    expect(snapshot.consumedCents).toBe(expectedConsumedCents);
    expect(snapshot.consumedPercent).toBeCloseTo(
      (expectedConsumedCents / expectedIncomeCents) * 100,
    );
  });

  it("zera o percentual quando não há renda", () => {
    const snapshot = buildSnapshot(input({ incomes: [], variableIncomes: [] }));

    expect(snapshot.incomeCents).toBe(0);
    expect(snapshot.consumedPercent).toBe(0);
  });

  it("é idempotente: o mesmo input produz o mesmo output", () => {
    const data = input();

    expect(buildSnapshot(data)).toEqual(buildSnapshot(data));
  });
});
