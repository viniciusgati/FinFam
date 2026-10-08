import { describe, expect, it } from "vitest";
import {
  buildConsumptionChartView,
  buildIncomeAllocationView,
  typicalDailySpend,
} from "./dashboard-charts";

function plain(text: string): string {
  return text.replace(/\u00a0/g, " ");
}

describe("typicalDailySpend", () => {
  it("usa a moda quando há um único valor repetido", () => {
    expect(typicalDailySpend([1000, 2000, 1000, 5000])).toEqual({
      metric: "mode",
      label: "Moda",
      cents: 1000,
    });
  });

  it("ignora dias sem consumo", () => {
    expect(typicalDailySpend([0, 0, 500, 500, 0])).toEqual({
      metric: "mode",
      label: "Moda",
      cents: 500,
    });
  });

  it("cai na mediana quando nenhum valor se repete", () => {
    expect(typicalDailySpend([100, 300])).toEqual({
      metric: "median",
      label: "Mediana",
      cents: 200,
    });
  });

  it("cai na mediana quando a moda empata", () => {
    expect(typicalDailySpend([100, 100, 300, 300, 500])).toEqual({
      metric: "median",
      label: "Mediana",
      cents: 300,
    });
  });

  it("mediana ímpar pega o valor do meio", () => {
    expect(typicalDailySpend([300, 100, 200])).toEqual({
      metric: "median",
      label: "Mediana",
      cents: 200,
    });
  });

  it("sem nenhum dia com consumo retorna null", () => {
    expect(typicalDailySpend([0, 0, 0])).toBeNull();
    expect(typicalDailySpend([])).toBeNull();
  });
});

describe("buildConsumptionChartView", () => {
  const input = {
    variableDailyCents: [0, 0, 5000, 0, 2000],
    obligationDailyCents: [0, 0, 0, 0, 10000],
    elapsedDay: 4,
    highlightDay: 3,
  };

  it("expõe dias, escala, dia típico e resumo", () => {
    const view = buildConsumptionChartView(input);

    expect(view.title).toBe("Consumo por dia");
    expect(view.days).toHaveLength(5);
    expect(view.maxVariableCents).toBe(5000);
    // 5000 e 2000 não se repetem → mediana = 3500.
    expect(view.typical).toEqual({
      metric: "median",
      label: "Mediana",
      cents: 3500,
    });
    expect(view.typicalPercent).toBe(70);
    expect(view.todayCents).toBe(5000);
    expect(view.aboveTypicalCount).toBe(1);
    expect(plain(view.summaryLabel)).toContain("Hoje: R$ 50,00");
    expect(plain(view.summaryLabel)).toContain("Dia típico (Mediana): R$ 35,00");
    expect(plain(view.summaryLabel)).toContain("1 dia acima");
    expect(view.isEmpty).toBe(false);
  });

  it("em mês fechado (sem highlightDay) não mostra Hoje", () => {
    const view = buildConsumptionChartView({
      ...input,
      highlightDay: undefined,
    });

    expect(view.todayCents).toBeNull();
    expect(view.summaryLabel).not.toContain("Hoje");
  });

  it("fica vazio sem consumo nem obrigações", () => {
    const view = buildConsumptionChartView({
      variableDailyCents: [0, 0],
      obligationDailyCents: [0, 0],
      elapsedDay: 2,
    });

    expect(view.isEmpty).toBe(true);
    expect(view.emptyMessage).toBe("Sem consumo variável neste mês");
    expect(view.typical).toBeNull();
  });

  it("mostra marcadores mesmo sem consumo variável", () => {
    const view = buildConsumptionChartView({
      variableDailyCents: [0, 0],
      obligationDailyCents: [0, 7000],
      elapsedDay: 2,
    });

    expect(view.isEmpty).toBe(false);
    expect(view.days[1].obligationCents).toBe(7000);
    expect(view.ariaLabel).toContain(
      "1 dia com vencimento de contas fixas ou fatura",
    );
  });
});

describe("buildIncomeAllocationView", () => {
  it("decompõe a renda em fixas, fatura, avulsos e disponível", () => {
    const view = buildIncomeAllocationView({
      incomeCents: 1200000,
      fixedExpensesCents: 300000,
      cardExpensesCents: 600000,
      variableExpensesCents: 40000,
    });

    expect(view.title).toBe("Para onde vai a renda");
    expect(plain(view.incomeLabel)).toBe("R$ 12.000,00");
    const byKey = Object.fromEntries(view.rows.map((row) => [row.key, row]));
    expect(byKey.fixed.amountCents).toBe(300000);
    expect(byKey.fixed.percent).toBe(25);
    expect(byKey.card.percent).toBe(50);
    expect(byKey.variable.percent).toBe(3);
    expect(byKey.remaining.amountCents).toBe(260000);
    expect(byKey.remaining.percent).toBe(22);
    expect(view.rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
    expect(view.overspent).toBe(false);
    expect(view.overspentLabel).toBeNull();
    expect(view.isEmpty).toBe(false);
  });

  it("marca estouro quando o consumo passa da renda, sem linha de disponível", () => {
    const view = buildIncomeAllocationView({
      incomeCents: 100000,
      fixedExpensesCents: 60000,
      cardExpensesCents: 50000,
      variableExpensesCents: 10000,
    });

    expect(view.overspent).toBe(true);
    expect(view.rows.some((row) => row.key === "remaining")).toBe(false);
    expect(plain(view.overspentLabel ?? "")).toContain(
      "o consumo passou a renda em R$ 200,00",
    );
    expect(view.rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
  });

  it("fica vazio sem renda cadastrada", () => {
    const view = buildIncomeAllocationView({
      incomeCents: 0,
      fixedExpensesCents: 0,
      cardExpensesCents: 0,
      variableExpensesCents: 0,
    });

    expect(view.isEmpty).toBe(true);
    expect(view.emptyMessage).toBe("Sem renda cadastrada neste mês");
  });
});
