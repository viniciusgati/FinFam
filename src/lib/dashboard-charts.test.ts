import { describe, expect, it } from "vitest";
import {
  buildConsumptionChartView,
  buildIncomeAllocationView,
  narrowDayLabels,
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

describe("narrowDayLabels", () => {
  it("marca 1, hoje, último e múltiplos de 5 como marcos", () => {
    expect(narrowDayLabels(31, 8)).toEqual([1, 5, 8, 10, 15, 20, 25, 31]);
  });

  it("nunca deixa dois rótulos consecutivos de duas casas (30 colado em 31)", () => {
    // Sem hoje: o último (31) tem prioridade sobre o múltiplo de 5 (30).
    expect(narrowDayLabels(31)).toEqual([1, 5, 10, 15, 20, 25, 31]);
    // Hoje = 30 ganha do último; hoje = 31 já é o último.
    expect(narrowDayLabels(31, 30)).toEqual([1, 5, 10, 15, 20, 25, 30]);
    expect(narrowDayLabels(31, 31)).toEqual([1, 5, 10, 15, 20, 25, 31]);
  });

  it("hoje vizinho de um múltiplo de 5 esconde o múltiplo (10 e 11)", () => {
    expect(narrowDayLabels(31, 11)).toEqual([1, 5, 11, 15, 20, 25, 31]);
  });

  it("mês de 28 dias mantém o último e ignora hoje fora do intervalo", () => {
    expect(narrowDayLabels(28, 15)).toEqual([1, 5, 10, 15, 20, 25, 28]);
    expect(narrowDayLabels(28, 99)).toEqual([1, 5, 10, 15, 20, 25, 28]);
  });

  it("mês curto sem sobreposição devolve todos os marcos", () => {
    expect(narrowDayLabels(7, 3)).toEqual([1, 3, 5, 7]);
    expect(narrowDayLabels(7)).toEqual([1, 5, 7]);
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
    expect(view.emptyCtaLabel).toBe("Registrar gastos");
    expect(view.emptyCtaHref).toBe("/gastos");
    expect(view.typical).toBeNull();
  });

  it("cita consumo, dia típico e vencimentos em R$ no aria-label", () => {
    const aria = plain(buildConsumptionChartView(input).ariaLabel);

    expect(aria).toContain("consumo total R$ 70,00");
    expect(aria).toContain("dia típico R$ 35,00 (Mediana)");
    expect(aria).toContain(
      "1 dia com vencimento de contas fixas ou fatura totalizando R$ 100,00",
    );
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
  const baseInput = {
    incomeCents: 100000,
    fixedIncomeCents: 80000,
    variableIncomeCents: 20000,
    fixedExpensesCents: 30000,
    cardExpensesCents: 20000,
    variableExpensesCents: 10000,
  };

  it("decompõe as entradas e expõe consumo disponível e saldo do mês", () => {
    const view = buildIncomeAllocationView(baseInput);

    expect(view.title).toBe("Para onde vai a renda");
    expect(plain(view.incomeLabel)).toBe("R$ 1.000,00");
    expect(view.totalIncomeCents).toBe(100000);
    expect(view.consumptionCents).toBe(70000);
    expect(plain(view.consumptionLabel)).toBe("R$ 700,00");
    expect(view.balanceCents).toBe(40000);
    expect(plain(view.balanceLabel)).toBe("R$ 400,00");

    const entries = Object.fromEntries(
      view.entriesByType.map((entry) => [entry.key, entry]),
    );
    expect(entries.fixedIncome.label).toBe("Entradas fixas");
    expect(entries.fixedIncome.amountCents).toBe(80000);
    expect(plain(entries.fixedIncome.amountLabel)).toBe("R$ 800,00");
    expect(entries.variableIncome.label).toBe("Entradas variáveis");
    expect(entries.variableIncome.amountCents).toBe(20000);
    expect(plain(entries.variableIncome.amountLabel)).toBe("R$ 200,00");
  });

  it("decompõe a renda em fixas, fatura, avulsos e saldo", () => {
    const view = buildIncomeAllocationView({
      incomeCents: 1200000,
      fixedIncomeCents: 800000,
      variableIncomeCents: 400000,
      fixedExpensesCents: 300000,
      cardExpensesCents: 600000,
      variableExpensesCents: 40000,
    });

    expect(plain(view.incomeLabel)).toBe("R$ 12.000,00");
    const byKey = Object.fromEntries(view.rows.map((row) => [row.key, row]));
    expect(byKey.fixed.amountCents).toBe(300000);
    expect(byKey.fixed.percent).toBe(25);
    expect(byKey.card.percent).toBe(50);
    expect(byKey.variable.percent).toBe(3);
    expect(byKey.remaining.label).toBe("Saldo do mês");
    expect(byKey.remaining.amountCents).toBe(260000);
    expect(byKey.remaining.percent).toBe(22);
    expect(view.rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
    expect(view.consumptionCents).toBe(900000);
    expect(view.balanceCents).toBe(260000);
    expect(view.overspent).toBe(false);
    expect(view.overspentLabel).toBeNull();
    expect(view.isEmpty).toBe(false);
  });

  it("nunca deixa o consumo disponível negativo", () => {
    const view = buildIncomeAllocationView({
      ...baseInput,
      incomeCents: 20000,
      fixedIncomeCents: 20000,
      variableIncomeCents: 0,
      fixedExpensesCents: 30000,
    });

    expect(view.consumptionCents).toBe(0);
    expect(plain(view.consumptionLabel)).toBe("R$ 0,00");
  });

  it("marca estouro quando as saídas passam das entradas, sem linha de saldo", () => {
    const view = buildIncomeAllocationView({
      incomeCents: 100000,
      fixedIncomeCents: 80000,
      variableIncomeCents: 20000,
      fixedExpensesCents: 60000,
      cardExpensesCents: 50000,
      variableExpensesCents: 10000,
    });

    expect(view.overspent).toBe(true);
    expect(view.balanceCents).toBe(-20000);
    expect(plain(view.balanceLabel)).toBe("-R$ 200,00");
    expect(view.rows.some((row) => row.key === "remaining")).toBe(false);
    expect(plain(view.overspentLabel ?? "")).toContain(
      "o consumo passou a renda em R$ 200,00",
    );
    expect(view.rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
  });

  it("inclui os valores em R$ das séries no aria-label", () => {
    const aria = plain(buildIncomeAllocationView(baseInput).ariaLabel);

    expect(aria).toContain("Entradas fixas R$ 800,00");
    expect(aria).toContain("Entradas variáveis R$ 200,00");
    expect(aria).toContain("total de entradas R$ 1.000,00");
    expect(aria).toContain("Contas fixas R$ 300,00");
    expect(aria).toContain("Fatura do cartão R$ 200,00");
    expect(aria).toContain("Gastos avulsos R$ 100,00");
    expect(aria).toContain("consumo disponível R$ 700,00");
    expect(aria).toContain("saldo do mês R$ 400,00");
  });

  it("fica vazio sem renda cadastrada e aponta o CTA para /gastos", () => {
    const view = buildIncomeAllocationView({
      incomeCents: 0,
      fixedIncomeCents: 0,
      variableIncomeCents: 0,
      fixedExpensesCents: 0,
      cardExpensesCents: 0,
      variableExpensesCents: 0,
    });

    expect(view.isEmpty).toBe(true);
    expect(view.emptyMessage).toBe("Sem renda cadastrada neste mês");
    expect(view.emptyCtaLabel).toBe("Registrar gastos");
    expect(view.emptyCtaHref).toBe("/gastos");
  });
});
