import { describe, expect, it } from "vitest";
import { isActiveInMonth, monthKey } from "./finance";
import { sumCardExpensesForMonth } from "./invoices";
import {
  buildSnapshot,
  hasSnapshotData,
  missingMonthKeys,
  monthRange,
  type SnapshotTransactionInput,
} from "./snapshots";

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
      { amountCents: 20000, active: true, category: "Moradia", dueDay: 10 },
      { amountCents: 99999, active: false, dueDay: 5 },
    ],
    variableExpenses: [
      {
        amountCents: 10000,
        date: new Date(Date.UTC(2026, 9, 5, 12)),
        paymentMethod: "PIX",
        category: "Mercado",
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
        category: "Casa",
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

describe("missingMonthKeys", () => {
  it("devolve só os ausentes, preservando a ordem cronológica", () => {
    expect(
      missingMonthKeys(
        ["2026-07", "2026-09"],
        ["2026-06", "2026-07", "2026-08", "2026-09"],
      ),
    ).toEqual(["2026-06", "2026-08"]);
  });

  it("devolve [] quando todos os meses já existem", () => {
    expect(
      missingMonthKeys(["2026-08", "2026-09"], ["2026-08", "2026-09"]),
    ).toEqual([]);
  });

  it("devolve todos quando não há nenhum existente", () => {
    expect(missingMonthKeys([], ["2026-08", "2026-09"])).toEqual([
      "2026-08",
      "2026-09",
    ]);
  });
});

describe("hasSnapshotData", () => {
  it("considera com dados quando há renda ou consumo", () => {
    expect(hasSnapshotData({ incomeCents: 0, consumedCents: 0 })).toBe(false);
    expect(hasSnapshotData({ incomeCents: 100000, consumedCents: 0 })).toBe(
      true,
    );
    expect(hasSnapshotData({ incomeCents: 0, consumedCents: 5000 })).toBe(true);
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

  it("separa renda fixa/avulsa e monta a série diária do mês", () => {
    const snapshot = buildSnapshot(input());

    expect(snapshot.fixedIncomeCents).toBe(100000);
    expect(snapshot.variableIncomeCents).toBe(25000);
    expect(snapshot.incomeCents).toBe(
      snapshot.fixedIncomeCents + snapshot.variableIncomeCents,
    );

    // Outubro/2026 tem 31 dias; a série cobre o mês inteiro.
    expect(snapshot.variableDailyCents).toHaveLength(31);
    expect(snapshot.obligationDailyCents).toHaveLength(31);

    // Avulso PIX de 05/10 e compra de cartão do próprio mês (08/10) no dia 8.
    expect(snapshot.variableDailyCents[4]).toBe(10000);
    expect(snapshot.variableDailyCents[7]).toBe(30000);
    // Saída fixa de 20 000 vence no dia 10 (índice 9).
    expect(snapshot.obligationDailyCents[9]).toBe(20000);

    // Invariante: série + obrigações fecham com o consumido.
    const total = snapshot.variableDailyCents.reduce(
      (sum, value, index) => sum + value + snapshot.obligationDailyCents[index],
      0,
    );
    expect(total).toBe(snapshot.consumedCents);
  });

  it("calcula o consumo disponível e a média diária do mês", () => {
    const snapshot = buildSnapshot(input());

    // outubro/2026 tem 31 dias: (125000 − 20000) / 31 = 3387,09… → 3387.
    expect(snapshot.consumptionAvailableCents).toBe(105000);
    expect(snapshot.daysInMonth).toBe(31);
    expect(snapshot.dailyAverageCents).toBe(3387);
  });

  it("zera consumo disponível e média diária sem renda (sem NaN)", () => {
    const snapshot = buildSnapshot(input({ incomes: [], variableIncomes: [] }));

    expect(snapshot.consumptionAvailableCents).toBe(0);
    expect(snapshot.dailyAverageCents).toBe(0);
    expect(Number.isNaN(snapshot.dailyAverageCents)).toBe(false);
  });

  it("soma as categorias exatamente igual ao consumedCents", () => {
    const snapshot = buildSnapshot(input());
    const totalCategorias = snapshot.categories.reduce(
      (total, categoria) => total + categoria.amountCents,
      0,
    );

    expect(totalCategorias).toBe(snapshot.consumedCents);
    expect(snapshot.categories.map((item) => item.category)).toEqual(
      expect.arrayContaining(["Moradia", "Mercado", "Casa"]),
    );
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
          { amountCents: 20000, active: true, dueDay: 10 },
          { amountCents: 5000, active: true, endMonth: "2026-08", dueDay: 10 },
          { amountCents: 6000, active: true, startMonth: "2026-10", dueDay: 10 },
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
