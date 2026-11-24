import { describe, expect, it } from "vitest";
import {
  buildConsumptionModeView,
  consumptionModeAriaValueText,
  consumptionModeBudget,
  consumptionModeColorRatio,
  consumptionModeDailyAvailable,
  consumptionModeLevel,
  consumptionModeOverBudgetFeedback,
  consumptionModePause,
  consumptionModePercent,
  consumptionModeWithinBudgetFeedback,
  CONSUMPTION_MODE_NO_BUDGET_MESSAGE,
  type ConsumptionModeView,
} from "./consumption-mode";

/** Normaliza o espaço não separável do `formatCents` antes de comparar. */
function plain(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

function plainStats(view: ConsumptionModeView) {
  return view.stats.map((stat) => ({ ...stat, value: plain(stat.value) }));
}

describe("consumptionModeBudget", () => {
  it("no modo VARIABLE_BUDGET desconta os gastos fixos da renda", () => {
    expect(
      consumptionModeBudget({
        mode: "VARIABLE_BUDGET",
        incomeCents: 200000,
        fixedExpensesCents: 50000,
      }),
    ).toBe(150000);
  });

  it("no modo INCOME devolve a própria renda", () => {
    expect(
      consumptionModeBudget({
        mode: "INCOME",
        incomeCents: 200000,
        fixedExpensesCents: 50000,
      }),
    ).toBe(200000);
  });

  it("nunca fica negativo quando os fixos superam a renda", () => {
    expect(
      consumptionModeBudget({
        mode: "VARIABLE_BUDGET",
        incomeCents: 100000,
        fixedExpensesCents: 150000,
      }),
    ).toBe(0);
  });
});

describe("consumptionModePercent", () => {
  it("arredonda o consumo variável sobre o orçamento", () => {
    expect(consumptionModePercent(90000, 150000)).toBe(60);
    expect(consumptionModePercent(180000, 150000)).toBe(120);
  });

  it("devolve 0 sem orçamento, sem NaN/Infinity", () => {
    expect(consumptionModePercent(50000, 0)).toBe(0);
    expect(consumptionModePercent(0, 0)).toBe(0);
    expect(Number.isNaN(consumptionModePercent(50000, 0))).toBe(false);
    expect(Number.isFinite(consumptionModePercent(50000, 0))).toBe(true);
  });
});

describe("consumptionModePause", () => {
  it("calcula o excesso e a pausa por dia para 10 dias restantes", () => {
    expect(
      consumptionModePause({
        consumedCents: 180000,
        budgetCents: 150000,
        remainingDays: 10,
      }),
    ).toEqual({ excessCents: 30000, pausePerDayCents: 3000 });
  });

  it("sem excesso devolve pausa 0", () => {
    expect(
      consumptionModePause({
        consumedCents: 90000,
        budgetCents: 150000,
        remainingDays: 10,
      }),
    ).toEqual({ excessCents: 0, pausePerDayCents: 0 });
  });

  it("usa max(dias, 1) no denominador", () => {
    expect(
      consumptionModePause({
        consumedCents: 150001,
        budgetCents: 150000,
        remainingDays: 0,
      }),
    ).toEqual({ excessCents: 1, pausePerDayCents: 1 });
  });
});

describe("consumptionModeDailyAvailable", () => {
  it("divide o disponível pelos dias com Math.floor", () => {
    expect(consumptionModeDailyAvailable(60000, 10)).toBe(6000);
    expect(consumptionModeDailyAvailable(60001, 10)).toBe(6000);
  });

  it("usa max(dias, 1) e nunca fica negativo", () => {
    expect(consumptionModeDailyAvailable(60000, 0)).toBe(60000);
    expect(consumptionModeDailyAvailable(-100, 10)).toBe(0);
  });
});

describe("consumptionModeLevel", () => {
  it("percent >= 100 é crítico (red)", () => {
    expect(
      consumptionModeLevel({ percent: 100, budgetCents: 150000, consumedCents: 150000 }),
    ).toBe("red");
    expect(
      consumptionModeLevel({ percent: 120, budgetCents: 150000, consumedCents: 180000 }),
    ).toBe("red");
  });

  it("segue as faixas de classifyLevel abaixo de 100%", () => {
    expect(
      consumptionModeLevel({ percent: 60, budgetCents: 150000, consumedCents: 90000 }),
    ).toBe("green");
    expect(
      consumptionModeLevel({ percent: 90, budgetCents: 150000, consumedCents: 135000 }),
    ).toBe("lime");
  });

  it("com orçamento 0 é red com consumo e green sem consumo", () => {
    expect(
      consumptionModeLevel({ percent: 0, budgetCents: 0, consumedCents: 50000 }),
    ).toBe("red");
    expect(
      consumptionModeLevel({ percent: 0, budgetCents: 0, consumedCents: 0 }),
    ).toBe("green");
  });
});

describe("consumptionModeColorRatio", () => {
  it("usa percent/100 no caso geral", () => {
    expect(
      consumptionModeColorRatio({ percent: 60, budgetCents: 150000, consumedCents: 90000 }),
    ).toBeCloseTo(0.6);
  });

  it("sem orçamento usa 2 com consumo e 0 sem consumo", () => {
    expect(
      consumptionModeColorRatio({ percent: 0, budgetCents: 0, consumedCents: 50000 }),
    ).toBe(2);
    expect(
      consumptionModeColorRatio({ percent: 0, budgetCents: 0, consumedCents: 0 }),
    ).toBe(0);
  });
});

describe("textos do modo variável", () => {
  it("monta o feedback de folga no plural e no singular", () => {
    expect(plain(consumptionModeWithinBudgetFeedback(6000, 10))).toBe(
      "Dentro do orçamento variável, ainda dá para gastar R$ 60,00 por dia nos 10 dias restantes.",
    );
    expect(plain(consumptionModeWithinBudgetFeedback(6000, 1))).toBe(
      "Dentro do orçamento variável, ainda dá para gastar R$ 60,00 por dia no dia restante.",
    );
  });

  it("monta o feedback de estouro no plural e no singular", () => {
    expect(plain(consumptionModeOverBudgetFeedback(30000, 3000, 10))).toBe(
      "Estourado em R$ 300,00. Pausa por dia R$ 30,00 por 10 dias restantes.",
    );
    expect(plain(consumptionModeOverBudgetFeedback(30000, 3000, 1))).toBe(
      "Estourado em R$ 300,00. Pausa por dia R$ 30,00 pelo dia restante.",
    );
  });

  it("descreve o aria-valuetext do modo", () => {
    expect(consumptionModeAriaValueText(60)).toBe(
      "60% do orçamento variável consumido",
    );
    expect(consumptionModeAriaValueText(120)).toBe(
      "120% do orçamento variável consumido",
    );
  });
});

describe("buildConsumptionModeView", () => {
  it("devolve null no modo INCOME para preservar o comportamento atual", () => {
    expect(
      buildConsumptionModeView({
        mode: "INCOME",
        incomeCents: 200000,
        fixedExpensesCents: 50000,
        variableConsumedCents: 90000,
        projectedCents: 160000,
        remainingDays: 10,
      }),
    ).toBeNull();
  });

  it("monta o cenário dentro do orçamento (60%)", () => {
    const view = buildConsumptionModeView({
      mode: "VARIABLE_BUDGET",
      incomeCents: 200000,
      fixedExpensesCents: 50000,
      variableConsumedCents: 90000,
      projectedCents: 160000,
      remainingDays: 10,
    });

    expect(view).not.toBeNull();
    if (!view) return;

    expect(view.title).toBe("Orçamento variável consumido");
    expect(view.percent).toBe(60);
    expect(view.ariaValueText).toBe("60% do orçamento variável consumido");
    expect(plainStats(view)).toEqual([
      {
        key: "budget",
        label: "Orçamento variável",
        value: "R$ 1.500,00",
        detail: null,
      },
      {
        key: "variable-consumed",
        label: "Consumo variável",
        value: "R$ 900,00",
        detail: null,
      },
      {
        key: "available",
        label: "Ainda disponível",
        value: "R$ 600,00",
        detail: null,
      },
      {
        key: "projection",
        label: "Projeção até o fim do ciclo",
        value: "R$ 1.600,00",
        detail: null,
      },
    ]);
    expect(plain(view.feedback)).toBe(
      "Dentro do orçamento variável, ainda dá para gastar R$ 60,00 por dia nos 10 dias restantes.",
    );
    expect(view.level).toBe("green");
    expect(view.colorRatio).toBeCloseTo(0.6);
    expect(view.hasVariableBudget).toBe(true);
  });

  it("monta o cenário de estouro (120%)", () => {
    const view = buildConsumptionModeView({
      mode: "VARIABLE_BUDGET",
      incomeCents: 200000,
      fixedExpensesCents: 50000,
      variableConsumedCents: 180000,
      projectedCents: 200000,
      remainingDays: 10,
    });

    expect(view).not.toBeNull();
    if (!view) return;

    expect(view.percent).toBe(120);
    expect(view.ariaValueText).toBe("120% do orçamento variável consumido");
    expect(plainStats(view)[2]).toEqual({
      key: "available",
      label: "Estourado em",
      value: "R$ 300,00",
      detail: null,
    });
    expect(plain(view.feedback)).toBe(
      "Estourado em R$ 300,00. Pausa por dia R$ 30,00 por 10 dias restantes.",
    );
    expect(view.level).toBe("red");
    expect(view.colorRatio).toBeCloseTo(1.2);
    expect(view.excessCents).toBe(30000);
    expect(view.pausePerDayCents).toBe(3000);
  });

  it("com orçamento 0 e sem consumo: 0%, barra vazia e aviso em status", () => {
    const view = buildConsumptionModeView({
      mode: "VARIABLE_BUDGET",
      incomeCents: 100000,
      fixedExpensesCents: 100000,
      variableConsumedCents: 0,
      projectedCents: 100000,
      remainingDays: 10,
    });

    expect(view).not.toBeNull();
    if (!view) return;

    expect(view.percent).toBe(0);
    expect(view.budgetCents).toBe(0);
    expect(view.hasVariableBudget).toBe(false);
    expect(plain(view.feedback)).toBe(CONSUMPTION_MODE_NO_BUDGET_MESSAGE);
    expect(view.level).toBe("green");
    expect(view.colorRatio).toBe(0);
    expect(plainStats(view)[0].value).toBe("R$ 0,00");
    expect(plainStats(view)[1].value).toBe("R$ 0,00");
    expect(plainStats(view)[2]).toEqual({
      key: "available",
      label: "Ainda disponível",
      value: "R$ 0,00",
      detail: null,
    });
    expect(view.ariaValueText).toBe("0% do orçamento variável consumido");
  });

  it("com orçamento 0 e consumo > 0: mantém o consumo, o estouro e a pausa", () => {
    const view = buildConsumptionModeView({
      mode: "VARIABLE_BUDGET",
      incomeCents: 100000,
      fixedExpensesCents: 100000,
      variableConsumedCents: 50000,
      projectedCents: 120000,
      remainingDays: 10,
    });

    expect(view).not.toBeNull();
    if (!view) return;

    expect(view.percent).toBe(0);
    expect(view.excessCents).toBe(50000);
    expect(view.pausePerDayCents).toBe(5000);
    expect(view.level).toBe("red");
    expect(view.colorRatio).toBe(2);
    expect(plainStats(view)[1]).toEqual({
      key: "variable-consumed",
      label: "Consumo variável",
      value: "R$ 500,00",
      detail: null,
    });
    expect(plainStats(view)[2]).toEqual({
      key: "available",
      label: "Estourado em",
      value: "R$ 500,00",
      detail: null,
    });
    expect(plain(view.feedback)).toBe(CONSUMPTION_MODE_NO_BUDGET_MESSAGE);

    const rendered = view.stats.map((stat) => plain(stat.value)).join(" ");
    expect(rendered).not.toContain("NaN");
    expect(rendered).not.toContain("Infinity");
  });
});
