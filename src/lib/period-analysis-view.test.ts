import { describe, expect, it } from "vitest";
import { buildPeriodAnalysis, type PeriodMonth } from "./period-analysis";
import {
  periodAnalysisView,
  PERIOD_ANALYSIS_EMPTY_MESSAGE,
  PERIOD_ANALYSIS_TITLE,
} from "./period-analysis-view";

const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04"];

function normalizeMoneyText(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

function at(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function closedMonth(monthKey: string): PeriodMonth {
  return {
    monthKey,
    incomeCents: 100000,
    consumedCents: 80000,
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 0,
    categories: [
      { category: "Alimentação", amountCents: 30000 },
      { category: "Casa", amountCents: 50000 },
    ],
    variableDailyCents: Array.from({ length: 30 }, (_, index) =>
      index === 9 ? 30000 : 0,
    ),
    obligationDailyCents: Array.from({ length: 30 }, (_, index) =>
      index === 9 ? 50000 : 0,
    ),
    daysInMonth: 30,
    elapsedDay: 30,
  };
}

function buildFixtureAnalysis() {
  const months = MONTHS.map(closedMonth);
  const current: PeriodMonth = {
    monthKey: "2026-05",
    incomeCents: 100000,
    consumedCents: 90000,
    fixedExpensesCents: 50000,
    variableExpensesCents: 30000,
    cardExpensesCents: 10000,
    categories: [
      { category: "Alimentação", amountCents: 40000 },
      { category: "Casa", amountCents: 50000 },
    ],
    variableDailyCents: Array.from({ length: 31 }, (_, index) =>
      index === 9 ? 30000 : 0,
    ),
    obligationDailyCents: Array.from({ length: 31 }, (_, index) =>
      index === 9 ? 50000 : 0,
    ),
    daysInMonth: 31,
    elapsedDay: 15,
    isCurrent: true,
  };

  const transactionMonths = [...MONTHS, "2026-05"];
  const transactions = [
    ...transactionMonths.flatMap((monthKey) =>
      (monthKey === "2026-05" ? [1, 5, 10, 15] : [5, 10, 15, 20]).map(
        (day) => ({
          description: "iFood",
          amountCents: 5500,
          date: at(`${monthKey}-${String(day).padStart(2, "0")}`),
          category: "Alimentação",
          source: "variable" as const,
          paymentMethod: "PIX" as const,
        }),
      ),
    ),
    ...transactionMonths.map((monthKey) => ({
      description: "Netflix",
      amountCents: 3990,
      date: at(`${monthKey}-15`),
      category: "Casa",
      source: "card" as const,
      installmentsTotal: 1,
    })),
    {
      description: "Crédito solto",
      amountCents: 20000,
      date: at("2026-05-12"),
      category: "Casa",
      source: "variable" as const,
      paymentMethod: "CREDIT" as const,
    },
  ];

  return buildPeriodAnalysis({
    months,
    current,
    transactions,
    fixedExpenses: [
      {
        name: "Aluguel",
        amountCents: 50000,
        dueDay: 10,
        category: "Moradia",
      },
      {
        name: "Internet",
        amountCents: 10000,
        dueDay: 20,
        category: "Casa",
      },
    ],
    incomes: [
      { name: "Salário", amountCents: 100000, receiveDay: 5 },
    ],
    cards: [
      {
        id: "card-1",
        name: "Cartão principal",
        closingDay: 20,
        dueDay: 5,
        limitCents: 500000,
      },
    ],
    cardPurchases: [
      {
        description: "Notebook",
        amountCents: 90000,
        purchaseDate: at("2026-05-10"),
        category: "Casa",
        cardId: "card-1",
        card: { closingDay: 20, dueDay: 5 },
        installmentsTotal: 3,
      },
    ],
    referenceMonthKey: "2026-05",
  });
}

describe("periodAnalysisView", () => {
  it("monta os textos exatos do diagnóstico", () => {
    const view = periodAnalysisView(buildFixtureAnalysis());

    expect(view.title).toBe(PERIOD_ANALYSIS_TITLE);
    expect(view.isEmpty).toBe(false);
    expect(view.confidenceLabel).toBe("Base curta");
    expect(view.confidenceTone).toBe("neutral");
    expect(normalizeMoneyText(view.summaryLabel)).toBe(
      "Sobra média de R$ 200,00 nos últimos 4 meses fechados · Sobra estável.",
    );
    expect(normalizeMoneyText(view.paceLabel ?? "")).toBe(
      "No dia 15, o consumo variável foi R$ 300,00, no ritmo habitual.",
    );
    expect(normalizeMoneyText(view.commitmentLabel ?? "")).toBe(
      "Contas fixas: R$ 600,00 (60% da renda média). Parcelas: pico de R$ 300,00 em junho de 2026.",
    );
    expect(view.categoryMovers[0].category).toBe("Alimentação");
    expect(normalizeMoneyText(view.categoryMovers[0].detail)).toBe(
      "acima da média em R$ 100,00 (+33.3%)",
    );
    expect(view.levers[0].label).toBe("Reduzir frequência");
    expect(normalizeMoneyText(view.levers[0].detail)).toBe(
      "iFood: 4 compras/mês, ticket médio R$ 55,00. Cortar 1 por mês libera R$ 55,00/mês.",
    );
    expect(view.levers[1].label).toBe("Revisar assinatura");
    expect(normalizeMoneyText(view.levers[1].detail)).toBe(
      "Netflix: possível assinatura de R$ 39,90/mês. Revisar libera R$ 39,90/mês.",
    );
    expect(normalizeMoneyText(view.totalSavingsLabel ?? "")).toBe(
      "Cortes sugeridos: R$ 94,90/mês.",
    );
    expect(view.dataQualityLabel).toBe(
      "Base curta · 1 crédito(s) sem cartão",
    );
    expect(view.anomalies.map((anomaly) => anomaly.title)).toContain(
      "Categoria acima da base",
    );
  });

  it("usa déficit quando a sobra média é negativa", () => {
    const view = periodAnalysisView(
      buildPeriodAnalysis({
        months: [
          {
            monthKey: "2026-01",
            incomeCents: 100000,
            consumedCents: 120000,
            fixedExpensesCents: 50000,
            variableExpensesCents: 70000,
            cardExpensesCents: 0,
            categories: [],
            daysInMonth: 30,
          },
        ],
      }),
    );

    expect(normalizeMoneyText(view.summaryLabel)).toBe(
      "Déficit médio de R$ 200,00 nos últimos 1 mês fechado · Sem tendência.",
    );
  });

  it("usa base confiável com 6 meses fechados sem problemas de qualidade", () => {
    const months: PeriodMonth[] = Array.from({ length: 6 }, (_, index) => ({
      monthKey: `2026-0${index + 1}`,
      incomeCents: 100000,
      consumedCents: 80000,
      fixedExpensesCents: 50000,
      variableExpensesCents: 30000,
      cardExpensesCents: 0,
      categories: [],
      daysInMonth: 30,
    }));

    const view = periodAnalysisView(
      buildPeriodAnalysis({
        months,
        transactions: [],
      }),
    );

    expect(view.confidenceLabel).toBe("Base confiável");
    expect(view.confidenceTone).toBe("positive");
    expect(view.dataQualityLabel).toBe("Base confiável");
  });

  it("devolve vazio explícito sem meses", () => {
    const view = periodAnalysisView(buildPeriodAnalysis({ months: [] }));

    expect(view.isEmpty).toBe(true);
    expect(view.emptyMessage).toBe(PERIOD_ANALYSIS_EMPTY_MESSAGE);
    expect(normalizeMoneyText(view.summaryLabel)).toBe(
      "Ainda não há meses fechados para comparar.",
    );
    expect(view.dataQualityLabel).toBeNull();
    expect(view.categoryMovers).toEqual([]);
    expect(view.levers).toEqual([]);
  });
});
