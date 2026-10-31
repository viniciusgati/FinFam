import { describe, expect, it } from "vitest";

import {
  buildFamilyHelpData,
  buildFamilyHelpPrompt,
  buildFamilyInsightInput,
  FAMILY_HELP_BUTTON_LABEL,
  FAMILY_HELP_BUTTON_LOADING_LABEL,
  FAMILY_HELP_ERROR_MESSAGE,
  FAMILY_HELP_INCOME_SHORTFALL_TEXT,
  FAMILY_HELP_LOADING_MESSAGE,
  FAMILY_HELP_UNAVAILABLE_TEXT,
  localFamilyHelp,
  type FamilyHelpInput,
  type FamilyHelpSource,
} from "./family-help";

function input(overrides: Partial<FamilyHelpInput> = {}): FamilyHelpInput {
  return {
    referenceMonthKey: "2026-10",
    currentCategories: [],
    windowSnapshots: [],
    monthlyIncomeCents: 1000000,
    fixedExpensesCents: 0,
    todayVariableSpendCents: null,
    dailyReferenceCents: null,
    fixedIncomeCents: 0,
    variableIncomeCents: 0,
    variableExpensesCents: 0,
    cardExpensesCents: 0,
    consumedCents: 0,
    consumedPercent: 0,
    projectedCents: 0,
    projectedPercent: 0,
    daysInWindow: 30,
    elapsedDays: 0,
    remainingDays: 30,
    freeBudgetCents: 0,
    dailyCents: 0,
    ...overrides,
  };
}

describe("buildFamilyHelpData", () => {
  it("deriva apenas números e desvios anônimos (sem rótulos)", () => {
    const data = buildFamilyHelpData(
      input({
        monthlyIncomeCents: 300000,
        fixedExpensesCents: 300000,
        currentCategories: [{ category: "Mercado", amountCents: 30000 }],
        windowSnapshots: [
          {
            monthKey: "2026-08",
            categories: [{ category: "Mercado", amountCents: 25000 }],
            incomeCents: 500000,
            consumedCents: 300000,
          },
          {
            monthKey: "2026-09",
            categories: [{ category: "Mercado", amountCents: 25000 }],
            incomeCents: 500000,
            consumedCents: 300000,
          },
        ],
        todayVariableSpendCents: 15000,
        dailyReferenceCents: 10000,
      }),
    );

    expect(data.overCommitted).toBe(1);
    expect(data.windowSnapshotCount).toBe(2);
    expect(data.dailyVariationFactor).toBe(1.5);
    expect(data.categoryDeviationPercents).toEqual([20]);
    expect(JSON.stringify(data)).not.toContain("Mercado");
  });

  it("conta apenas meses com entrada e saída (regressão)", () => {
    const data = buildFamilyHelpData(
      input({
        currentCategories: [{ category: "Mercado", amountCents: 90000 }],
        windowSnapshots: [
          {
            monthKey: "2026-08",
            categories: [{ category: "Mercado", amountCents: 25000 }],
            incomeCents: 500000,
            consumedCents: 300000,
          },
          {
            monthKey: "2026-09",
            categories: [{ category: "Mercado", amountCents: 25000 }],
            incomeCents: 500000,
            consumedCents: 0,
          },
        ],
      }),
    );

    expect(data.windowSnapshotCount).toBe(1);
    // Com base insuficiente não há desvio para a IA comentar.
    expect(data.categoryDeviationPercents).toEqual([]);
  });

  it("inclui o agregado completo do ciclo, sempre numérico", () => {
    const data = buildFamilyHelpData(input());

    const requiredKeys = [
      "monthlyIncomeCents",
      "fixedIncomeCents",
      "variableIncomeCents",
      "fixedExpensesCents",
      "variableExpensesCents",
      "cardExpensesCents",
      "consumedCents",
      "consumedPercent",
      "projectedCents",
      "projectedPercent",
      "daysInWindow",
      "elapsedDays",
      "remainingDays",
      "freeBudgetCents",
      "dailyCents",
      "windowSnapshotCount",
      "categoryDeviationPercents",
    ];
    for (const key of requiredKeys) {
      expect(Object.prototype.hasOwnProperty.call(data, key)).toBe(true);
    }

    for (const value of Object.values(data)) {
      if (Array.isArray(value)) {
        expect(value.every((entry) => typeof entry === "number")).toBe(true);
      } else {
        expect(typeof value).toBe("number");
      }
    }
  });
});

describe("buildFamilyInsightInput", () => {
  const source: FamilyHelpSource = {
    referenceMonthKey: "2026-10",
    isCurrentCycle: true,
    data: {
      monthlyIncomeCents: 300000,
      fixedIncomeCents: 240000,
      variableIncomeCents: 60000,
      fixedExpensesCents: 90000,
      variableExpensesCents: 50000,
      cardExpensesCents: 48000,
      categoryBreakdown: { items: [] },
      snapshots: [],
      series: {
        daysInMonth: 30,
        elapsedDay: 10,
        variableDailyCents: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 3000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
      },
      consumption: { dailyByMonthCents: 7000 },
      referenceDate: new Date("2026-10-12T12:00:00.000Z"),
      periodDays: 30,
      elapsedDays: 10,
      cardExpensesVariable: true,
    },
  };

  it("deriva a referência diária e o gasto de hoje da mesma janela", () => {
    const input = buildFamilyInsightInput(source);

    expect(input.todayVariableSpendCents).toBe(3000);
    expect(input.dailyReferenceCents).toBe(9800);
    expect(input.daysInWindow).toBe(30);
    expect(input.elapsedDays).toBe(10);
    expect(input.remainingDays).toBe(20);
    expect(input.freeBudgetCents).toBe(112000);
    expect(input.dailyCents).toBe(5600);
    expect(input.consumedCents).toBe(188000);
    expect(input.consumedPercent).toBe(62.67);
  });

  it("fora do ciclo corrente não envia hoje nem referência diária", () => {
    const input = buildFamilyInsightInput({
      ...source,
      isCurrentCycle: false,
    });

    expect(input.todayVariableSpendCents).toBeNull();
    expect(input.dailyReferenceCents).toBeNull();
  });
});

describe("buildFamilyHelpPrompt", () => {
  it("usa JSON numérico no user, sem nomes de categoria nem texto do usuário", () => {
    const data = buildFamilyHelpData(
      input({
        currentCategories: [{ category: "Alimentação", amountCents: 30000 }],
        windowSnapshots: [
          {
            monthKey: "2026-09",
            categories: [{ category: "Alimentação", amountCents: 25000 }],
            incomeCents: 500000,
            consumedCents: 300000,
          },
        ],
      }),
    );

    const [system, user] = buildFamilyHelpPrompt(data);

    expect(system.role).toBe("system");
    expect(user.role).toBe("user");
    expect(user.content).not.toContain("Alimentação");

    const parsed = JSON.parse(user.content) as Record<string, unknown>;
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) {
        expect(value.every((entry) => typeof entry === "number")).toBe(true);
      } else {
        expect(typeof value).toBe("number");
      }
    }
  });
});

describe("localFamilyHelp", () => {
  it("usa o texto de renda insuficiente quando as fixas cobrem a renda", () => {
    const data = buildFamilyHelpData(
      input({ monthlyIncomeCents: 100000, fixedExpensesCents: 100000 }),
    );

    expect(localFamilyHelp(data)).toBe(FAMILY_HELP_INCOME_SHORTFALL_TEXT);
  });

  it("usa o texto geral quando há renda disponível", () => {
    const data = buildFamilyHelpData(
      input({ monthlyIncomeCents: 100000, fixedExpensesCents: 50000 }),
    );

    expect(localFamilyHelp(data)).toBe(FAMILY_HELP_UNAVAILABLE_TEXT);
  });
});

describe("textos fixados do card", () => {
  it("mantém os rótulos e mensagens exatos", () => {
    expect(FAMILY_HELP_BUTTON_LABEL).toBe("Gerar resumo da IA");
    expect(FAMILY_HELP_BUTTON_LOADING_LABEL).toBe("Gerando resumo…");
    expect(FAMILY_HELP_LOADING_MESSAGE).toBe("Gerando resumo com IA…");
    expect(FAMILY_HELP_ERROR_MESSAGE).toBe(
      "Resumo por IA indisponível no momento",
    );
  });
});
