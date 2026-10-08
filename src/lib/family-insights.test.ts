import { describe, expect, it } from "vitest";

import {
  buildFamilyInsights,
  CATEGORY_ABOVE_FACTOR,
  CATEGORY_MIN_SURPLUS_CENTS,
  categoryAlerts,
  categoryAverage,
  DAILY_VARIATION_FACTOR,
  FAMILY_EMPTY_TEXT,
  FAMILY_INCOME_SHORTFALL_TEXT,
  FAMILY_POSITIVE_MARKER,
  FAMILY_POSITIVE_TEXT,
  FAMILY_WARNING_MARKER,
  formatFactor,
  MAX_CATEGORY_ALERTS,
  type FamilyInsightInput,
  type FamilyInsightSnapshot,
} from "./family-insights";

const norm = (value: string): string => value.replace(/\u00a0/g, " ");

function month(
  monthKey: string,
  categories: { category: string; amountCents: number }[],
): FamilyInsightSnapshot {
  return { monthKey, categories };
}

function input(overrides: Partial<FamilyInsightInput> = {}): FamilyInsightInput {
  return {
    referenceMonthKey: "2026-10",
    currentCategories: [],
    windowSnapshots: [],
    monthlyIncomeCents: 1000000,
    fixedExpensesCents: 0,
    todayVariableSpendCents: null,
    dailyReferenceCents: null,
    ...overrides,
  };
}

describe("constantes", () => {
  it("fixa os fatores e limites da história", () => {
    expect(DAILY_VARIATION_FACTOR).toBe(1.5);
    expect(CATEGORY_ABOVE_FACTOR).toBe(1.2);
    expect(CATEGORY_MIN_SURPLUS_CENTS).toBe(5000);
    expect(MAX_CATEGORY_ALERTS).toBe(2);
  });
});

describe("categoryAverage", () => {
  it("usa o nº de snapshots como denominador e conta ausência como 0", () => {
    const average = categoryAverage("mercado", [
      month("2026-06", [{ category: "Mercado", amountCents: 50000 }]),
      month("2026-07", []),
    ]);

    expect(average.months).toBe(2);
    expect(average.averageCents).toBe(25000);
  });

  it("agrupa pela categoryKey (case-insensitive)", () => {
    const average = categoryAverage("mercado", [
      month("2026-06", [{ category: "MERCADO", amountCents: 40000 }]),
    ]);

    expect(average.averageCents).toBe(40000);
  });

  it("sem snapshot na janela não há base", () => {
    expect(categoryAverage("mercado", [])).toEqual({
      averageCents: 0,
      months: 0,
    });
  });
});

describe("categoryAlerts — limites", () => {
  const fourMonths = (amountCents: number) => [
    month("2026-06", [{ category: "Mercado", amountCents }]),
    month("2026-07", [{ category: "Mercado", amountCents }]),
    month("2026-08", [{ category: "Mercado", amountCents }]),
    month("2026-09", [{ category: "Mercado", amountCents }]),
  ];

  it("dispara com +20% e +R$ 50,00 exatos", () => {
    const alerts = categoryAlerts(
      [{ category: "Mercado", amountCents: 30000 }],
      fourMonths(25000),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].surplusCents).toBe(5000);
    expect(alerts[0].percentAbove).toBe(20);
    expect(alerts[0].months).toBe(4);
  });

  it("não dispara com +19%", () => {
    const alerts = categoryAlerts(
      [{ category: "Mercado", amountCents: 29750 }],
      fourMonths(25000),
    );

    expect(alerts).toEqual([]);
  });

  it("não dispara com +R$ 49,99 (ratio no limite, excesso abaixo)", () => {
    const alerts = categoryAlerts(
      [{ category: "Mercado", amountCents: 24000 }],
      fourMonths(20000),
    );

    expect(alerts).toEqual([]);
  });

  it("média 0 não gera alerta", () => {
    const alerts = categoryAlerts(
      [{ category: "Mercado", amountCents: 90000 }],
      fourMonths(0),
    );

    expect(alerts).toEqual([]);
  });

  it("limita a 2 alertas por desvio desc, desempate por categoryKey", () => {
    const snapshots = [
      month("2026-06", [
        { category: "A", amountCents: 25000 },
        { category: "B", amountCents: 25000 },
        { category: "C", amountCents: 25000 },
      ]),
    ];

    const alerts = categoryAlerts(
      [
        { category: "C", amountCents: 33000 },
        { category: "A", amountCents: 35000 },
        { category: "B", amountCents: 33000 },
      ],
      snapshots,
    );

    expect(alerts.map((alert) => alert.categoryKey)).toEqual(["a", "b"]);
    expect(alerts[0].surplusCents).toBe(10000);
  });
});

describe("formatFactor", () => {
  it("usa 1 casa decimal com vírgula", () => {
    expect(formatFactor(1.5)).toBe("1,5");
    expect(formatFactor(2)).toBe("2,0");
  });
});

describe("buildFamilyInsights — renda insuficiente", () => {
  it("vem primeiro, com o texto exato, sem suprimir os demais", () => {
    const insights = buildFamilyInsights(
      input({
        monthlyIncomeCents: 300000,
        fixedExpensesCents: 300000,
        currentCategories: [{ category: "Mercado", amountCents: 30000 }],
        windowSnapshots: [
          month("2026-09", [{ category: "Mercado", amountCents: 25000 }]),
        ],
        todayVariableSpendCents: 15000,
        dailyReferenceCents: 10000,
      }),
    );

    expect(insights[0]).toEqual({
      id: "income-shortfall",
      tone: "warning",
      marker: FAMILY_WARNING_MARKER,
      text: FAMILY_INCOME_SHORTFALL_TEXT,
    });
    expect(insights).toHaveLength(3);
    expect(insights.some((insight) => insight.id.startsWith("category-"))).toBe(
      true,
    );
    expect(insights.some((insight) => insight.id === "daily-variation")).toBe(
      true,
    );
  });
});

describe("buildFamilyInsights — variação diária", () => {
  const withReference = input({
    todayVariableSpendCents: 15000,
    dailyReferenceCents: 10000,
  });

  it("dispara exatamente em 1,5× com o texto e o múltiplo em pt-BR", () => {
    const insights = buildFamilyInsights(withReference);
    const daily = insights.find((insight) => insight.id === "daily-variation");

    expect(daily?.tone).toBe("warning");
    expect(norm(daily?.text ?? "")).toBe(
      "Hoje você gastou R$ 150,00; é 1,5× a sua média diária de R$ 100,00.",
    );
  });

  it("não dispara em 1,49×", () => {
    const insights = buildFamilyInsights(
      input({ todayVariableSpendCents: 14900, dailyReferenceCents: 10000 }),
    );

    expect(insights.some((insight) => insight.id === "daily-variation")).toBe(
      false,
    );
  });

  it("suprime com referência 0, referência null ou hoje null", () => {
    for (const value of [
      input({ todayVariableSpendCents: 15000, dailyReferenceCents: 0 }),
      input({ todayVariableSpendCents: 15000, dailyReferenceCents: null }),
      input({ todayVariableSpendCents: null, dailyReferenceCents: 10000 }),
    ]) {
      expect(
        buildFamilyInsights(value).some(
          (insight) => insight.id === "daily-variation",
        ),
      ).toBe(false);
    }
  });
});

describe("buildFamilyInsights — categoria", () => {
  it("usa o N real de meses com snapshot no texto", () => {
    const insights = buildFamilyInsights(
      input({
        currentCategories: [{ category: "Mercado", amountCents: 30000 }],
        windowSnapshots: [
          month("2026-08", [{ category: "Mercado", amountCents: 50000 }]),
          month("2026-09", []),
        ],
      }),
    );

    expect(insights).toHaveLength(1);
    expect(insights[0].text).toBe(
      "A categoria Mercado ficou 20% acima da média dos últimos 2 meses.",
    );
  });
});

describe("buildFamilyInsights — positivo e neutro", () => {
  it("com snapshot na janela e nenhum warning retorna o positivo exato", () => {
    const insights = buildFamilyInsights(
      input({
        windowSnapshots: [
          month("2026-09", [{ category: "Mercado", amountCents: 25000 }]),
        ],
      }),
    );

    expect(insights).toEqual([
      {
        id: "positive",
        tone: "positive",
        marker: FAMILY_POSITIVE_MARKER,
        text: FAMILY_POSITIVE_TEXT,
      },
    ]);
  });

  it("sem snapshot na janela retorna o neutro exato e sem marcador", () => {
    const insights = buildFamilyInsights(input());

    expect(insights).toEqual([
      {
        id: "neutral",
        tone: "neutral",
        marker: null,
        text: FAMILY_EMPTY_TEXT,
      },
    ]);
  });
});
