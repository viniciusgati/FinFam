import { describe, expect, it } from "vitest";

import { NO_CATEGORY_LABEL } from "./categories";
import {
  buildCategoryComparison,
  buildMonthHistory,
  historyChartView,
  historyView,
  HISTORY_CHART_EMPTY_MESSAGE,
  HISTORY_CHART_SINGLE_MONTH_MESSAGE,
  type MonthHistorySnapshot,
} from "./history";
import { FAMILY_EMPTY_TEXT } from "./family-insights";

function snapshot(
  overrides: Partial<MonthHistorySnapshot> & { monthKey: string },
): MonthHistorySnapshot {
  return {
    incomeCents: 200000,
    consumedCents: 0,
    consumedPercent: 0,
    fixedExpensesCents: 0,
    consumptionAvailableCents: 0,
    dailyAverageCents: 0,
    categories: [],
    ...overrides,
  };
}

describe("buildMonthHistory", () => {
  it("ordena do mais recente para o mais antigo", () => {
    const history = buildMonthHistory([
      snapshot({ monthKey: "2026-08", consumedPercent: 20 }),
      snapshot({ monthKey: "2026-09", consumedPercent: 30 }),
    ]);

    expect(history.map((entry) => entry.monthKey)).toEqual([
      "2026-09",
      "2026-08",
    ]);
  });

  it("rotula, formata o total e classifica o nível do mês", () => {
    const [entry] = buildMonthHistory([
      snapshot({
        monthKey: "2026-09",
        incomeCents: 100000,
        consumedCents: 90000,
        consumedPercent: 90,
      }),
    ]);

    expect(entry.percent).toBe(90);
    expect(entry.totalCents).toBe(90000);
    expect(entry.label).toBe("setembro de 2026");
    expect(entry.level).toBe("lime");
    expect(entry.levelLabel).toBe("Atenção");
  });

  it("arredonda o percentual exibido", () => {
    const [entry] = buildMonthHistory([
      snapshot({ monthKey: "2026-09", consumedPercent: 34.6 }),
    ]);

    expect(entry.percent).toBe(35);
  });

  it("classifica como neutral sem renda, sem dividir por zero", () => {
    const [entry] = buildMonthHistory([
      snapshot({ monthKey: "2026-09", incomeCents: 0, consumedPercent: 0 }),
    ]);

    expect(entry.level).toBe("neutral");
    expect(entry.levelLabel).toBe("Sem renda cadastrada");
  });

  it("expõe consumo disponível, média diária e categorias de cada mês", () => {
    const [entry] = buildMonthHistory([
      snapshot({
        monthKey: "2026-08",
        consumptionAvailableCents: 120000,
        dailyAverageCents: 3871,
        categories: [{ category: "Moradia", amountCents: 120000 }],
      }),
    ]);

    expect(entry.consumptionAvailableCents).toBe(120000);
    expect(entry.dailyAverageCents).toBe(3871);
    expect(entry.categories).toEqual([
      { category: "Moradia", amountCents: 120000 },
    ]);
  });

  it("retorna vazio quando não há snapshots", () => {
    expect(buildMonthHistory([])).toEqual([]);
  });

  it("`/historico` repetia o mesmo % em tela cheia: mantém meses distintos separados", () => {
    // Regressão: a tela antiga colapsava todos os meses no mesmo número. Os
    // dois meses do fixture (income R$ 2.000,00) têm consumo/%/total distintos
    // e cada linha precisa preservar os seus próprios valores.
    const history = buildMonthHistory([
      snapshot({
        monthKey: "2026-08",
        incomeCents: 200000,
        consumedCents: 90000,
        consumedPercent: 45,
        consumptionAvailableCents: 120000,
        dailyAverageCents: 3871,
      }),
      snapshot({
        monthKey: "2026-09",
        incomeCents: 200000,
        consumedCents: 120000,
        consumedPercent: 60,
        consumptionAvailableCents: 100000,
        dailyAverageCents: 3333,
      }),
    ]);

    const [setembro, agosto] = history;
    expect(agosto.percent).toBe(45);
    expect(agosto.totalCents).toBe(90000);
    expect(agosto.consumptionAvailableCents).toBe(120000);
    expect(agosto.dailyAverageCents).toBe(3871);
    expect(setembro.percent).toBe(60);
    expect(setembro.totalCents).toBe(120000);
    expect(setembro.consumptionAvailableCents).toBe(100000);
    expect(setembro.dailyAverageCents).toBe(3333);
    expect(setembro.totalCents).not.toBe(agosto.totalCents);
    expect(setembro.percent).not.toBe(agosto.percent);
  });
});

const norm = (value: string): string => value.replace(/\u00a0/g, " ");

describe("buildCategoryComparison", () => {
  const august = snapshot({
    monthKey: "2026-08",
    categories: [
      { category: "Moradia", amountCents: 30000 },
      { category: "Mercado", amountCents: 10000 },
    ],
  });
  const september = snapshot({
    monthKey: "2026-09",
    categories: [
      { category: "Moradia", amountCents: 40000 },
      { category: "Lazer", amountCents: 5000 },
    ],
  });

  it("casa a categoria nos meses e calcula o delta vs. o mês anterior", () => {
    const comparison = buildCategoryComparison([august, september]);

    expect(comparison.months.map((month) => month.monthKey)).toEqual([
      "2026-08",
      "2026-09",
    ]);

    const moradia = comparison.rows.find((row) => row.category === "Moradia");
    expect(moradia?.values.map((value) => value.amountCents)).toEqual([
      30000, 40000,
    ]);
    expect(moradia?.deltaCents).toBe(10000);
    expect(norm(moradia?.deltaLabel ?? "")).toBe("+R$ 100,00");
    expect(moradia?.trend).toBe("maior");

    const lazer = comparison.rows.find((row) => row.category === "Lazer");
    expect(lazer?.values.map((value) => norm(value.amountLabel))).toEqual([
      "—",
      "R$ 50,00",
    ]);
    expect(lazer?.deltaCents).toBe(5000);
    expect(lazer?.trend).toBe("maior");
  });

  it("marca queda como `menor` e valores iguais como `igual`", () => {
    const maior = snapshot({
      monthKey: "2026-08",
      categories: [{ category: "Mercado", amountCents: 20000 }],
    });
    const menor = snapshot({
      monthKey: "2026-09",
      categories: [{ category: "Mercado", amountCents: 15000 }],
    });

    const [row] = buildCategoryComparison([maior, menor]).rows;
    expect(row.deltaCents).toBe(-5000);
    expect(norm(row.deltaLabel)).toBe("-R$ 50,00");
    expect(row.trend).toBe("menor");

    const igual = snapshot({
      monthKey: "2026-09",
      categories: [{ category: "Mercado", amountCents: 20000 }],
    });
    const [same] = buildCategoryComparison([maior, igual]).rows;
    expect(same.deltaCents).toBe(0);
    expect(norm(same.deltaLabel)).toBe("R$ 0,00");
    expect(same.trend).toBe("igual");
  });

  it("agrupa null, vazio e só espaços em NO_CATEGORY_LABEL", () => {
    const a = snapshot({
      monthKey: "2026-08",
      categories: [{ category: "   ", amountCents: 1000 }],
    });
    const b = snapshot({
      monthKey: "2026-09",
      categories: [{ category: NO_CATEGORY_LABEL, amountCents: 2000 }],
    });

    const comparison = buildCategoryComparison([a, b]);
    expect(comparison.rows).toHaveLength(1);
    expect(comparison.rows[0].category).toBe(NO_CATEGORY_LABEL);
    expect(comparison.rows[0].values.map((value) => value.amountCents)).toEqual([
      1000, 2000,
    ]);
  });

  it("não gera NaN e marca ausência nos dois meses como 0 no delta", () => {
    const only = snapshot({
      monthKey: "2026-09",
      categories: [{ category: "Lazer", amountCents: 5000 }],
    });

    const comparison = buildCategoryComparison([only]);
    const [row] = comparison.rows;
    expect(comparison.months).toHaveLength(1);
    expect(row.deltaCents).toBeNull();
    expect(norm(row.deltaLabel)).toBe("—");
    expect(row.trend).toBeNull();
    expect(JSON.stringify(comparison)).not.toContain("NaN");
  });

  it("expoe o vazio quando não há categorias na janela", () => {
    const comparison = buildCategoryComparison([]);
    expect(comparison.isEmpty).toBe(true);
    expect(comparison.rows).toEqual([]);
    expect(comparison.emptyMessage).toBe("Sem gastos por categoria na janela.");
  });
});

describe("historyChartView", () => {
  it("reflete a série e ordena cronologicamente com alturas relativas", () => {
    const view = historyChartView([
      { monthKey: "2026-09", totalCents: 120000 },
      { monthKey: "2026-08", totalCents: 90000 },
    ]);

    expect(view.isEmpty).toBe(false);
    expect(view.message).toBeNull();
    expect(view.bars.map((bar) => bar.monthKey)).toEqual([
      "2026-08",
      "2026-09",
    ]);
    expect(view.bars[0].heightPercent).toBe(75);
    expect(view.bars[1].heightPercent).toBe(100);
    expect(norm(view.ariaLabel)).toContain("agosto de 2026 R$ 900,00");
    expect(norm(view.ariaLabel)).toContain("setembro de 2026 R$ 1.200,00");
  });

  it("exibe o aviso de tendência com 1 mês, mantendo a barra", () => {
    const view = historyChartView([
      { monthKey: "2026-09", totalCents: 120000 },
    ]);

    expect(view.message).toBe(HISTORY_CHART_SINGLE_MONTH_MESSAGE);
    expect(view.bars).toHaveLength(1);
    expect(view.bars[0].heightPercent).toBe(100);
  });

  it("tem precedência do vazio quando todos os meses estão zerados (sem NaN)", () => {
    const view = historyChartView([
      { monthKey: "2026-08", totalCents: 0 },
      { monthKey: "2026-09", totalCents: 0 },
    ]);

    expect(view.isEmpty).toBe(true);
    expect(view.message).toBe(HISTORY_CHART_EMPTY_MESSAGE);
    expect(view.bars.every((bar) => bar.heightPercent === 0)).toBe(true);
    expect(JSON.stringify(view)).not.toContain("NaN");
  });

  it("expoe o vazio sem barras quando não há meses", () => {
    const view = historyChartView([]);
    expect(view.isEmpty).toBe(true);
    expect(view.bars).toEqual([]);
    expect(view.message).toBe(HISTORY_CHART_EMPTY_MESSAGE);
  });
});

describe("historyView — ajuda à família", () => {
  it("gera alerta de categoria com 2 meses válidos na janela", () => {
    const view = historyView({
      dbError: false,
      isFutureMonth: false,
      referenceMonthKey: "2026-10",
      snapshots: [
        snapshot({
          monthKey: "2026-07",
          consumedCents: 90000,
          consumedPercent: 45,
          categories: [{ category: "Mercado", amountCents: 25000 }],
        }),
        snapshot({
          monthKey: "2026-08",
          consumedCents: 90000,
          consumedPercent: 45,
          categories: [{ category: "Mercado", amountCents: 25000 }],
        }),
        snapshot({
          monthKey: "2026-09",
          consumedCents: 90000,
          consumedPercent: 45,
          categories: [{ category: "Mercado", amountCents: 30000 }],
        }),
      ],
    });

    if (view.state !== "ok") throw new Error("estado esperado: ok");
    expect(view.insights.length).toBeGreaterThan(0);
    expect(
      view.insights.some((insight) =>
        insight.text.includes("acima da média dos últimos 2 meses"),
      ),
    ).toBe(true);
  });

  it("com apenas 1 mês anterior válido suprime o alerta e cai no neutro (regressão)", () => {
    const view = historyView({
      dbError: false,
      isFutureMonth: false,
      referenceMonthKey: "2026-10",
      snapshots: [
        snapshot({
          monthKey: "2026-08",
          consumedCents: 90000,
          consumedPercent: 45,
          categories: [{ category: "Mercado", amountCents: 25000 }],
        }),
        snapshot({
          monthKey: "2026-09",
          consumedCents: 90000,
          consumedPercent: 45,
          categories: [{ category: "Mercado", amountCents: 90000 }],
        }),
      ],
    });

    if (view.state !== "ok") throw new Error("estado esperado: ok");
    expect(view.insights).toEqual([
      {
        id: "neutral",
        tone: "neutral",
        marker: null,
        text: FAMILY_EMPTY_TEXT,
      },
    ]);
  });

  it("sem snapshot anterior exibe exatamente o neutro", () => {
    const view = historyView({
      dbError: false,
      isFutureMonth: false,
      referenceMonthKey: "2026-10",
      snapshots: [snapshot({ monthKey: "2026-09" })],
    });

    if (view.state !== "ok") throw new Error("estado esperado: ok");
    expect(view.insights).toEqual([
      {
        id: "neutral",
        tone: "neutral",
        marker: null,
        text: FAMILY_EMPTY_TEXT,
      },
    ]);
  });
});
