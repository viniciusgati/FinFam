import { describe, expect, it } from "vitest";
import {
  classifyLevel,
  compareWithHistory,
  computeFinanceStatus,
  dashboardView,
  heatColor,
  isActiveInMonth,
  monthKey,
  monthLabel,
  resolveDashboardState,
  shiftMonthKey,
} from "./finance";
import {
  fixedExpenseCreateSchema,
  fixedExpenseUpdateSchema,
  incomeCreateSchema,
  incomeUpdateSchema,
  isPeriodValid,
} from "./validation";
import { formatCents, parseAmountToCents } from "./money";

describe("computeFinanceStatus", () => {
  it("calcula o percentual consumido e os dias restantes", () => {
    const status = computeFinanceStatus({
      monthlyIncomeCents: 100000,
      fixedExpensesCents: 40000,
      variableExpensesCents: 20000,
      cardExpensesCents: 20000,
      referenceDate: new Date(2026, 9, 10), // 10/out/2026, mês com 31 dias
    });

    expect(status.monthKey).toBe("2026-10");
    expect(status.daysInMonth).toBe(31);
    expect(status.daysRemaining).toBe(21);
    expect(status.consumedCents).toBe(80000);
    expect(status.consumedPercent).toBeCloseTo(80);
    expect(status.projectedPercent).toBeCloseTo(248);
  });

  it("retorna nível neutro quando não há renda cadastrada", () => {
    const status = computeFinanceStatus({
      monthlyIncomeCents: 0,
      fixedExpensesCents: 5000,
      variableExpensesCents: 0,
      cardExpensesCents: 0,
      referenceDate: new Date(2026, 9, 10),
    });

    expect(status.level).toBe("neutral");
    expect(status.consumedPercent).toBe(0);
    expect(status.projectedPercent).toBe(0);
  });

  it("marca crítico quando o consumo alcança 100% da renda", () => {
    const status = computeFinanceStatus({
      monthlyIncomeCents: 100000,
      fixedExpensesCents: 100000,
      variableExpensesCents: 0,
      cardExpensesCents: 0,
      referenceDate: new Date(2026, 9, 1),
    });

    expect(status.level).toBe("red");
  });
});

describe("classifyLevel", () => {
  it("respeita as faixas de ritmo", () => {
    expect(classifyLevel(0.5, 10, 100000)).toBe("green");
    expect(classifyLevel(0.9, 30, 100000)).toBe("lime");
    expect(classifyLevel(1.1, 40, 100000)).toBe("yellow");
    expect(classifyLevel(1.4, 50, 100000)).toBe("orange");
    expect(classifyLevel(2.0, 60, 100000)).toBe("red");
  });
});

describe("heatColor", () => {
  it("vai do verde ao vermelho", () => {
    expect(heatColor(0)).toBe("hsl(120 65% 42%)");
    expect(heatColor(2)).toBe("hsl(0 65% 42%)");
  });
});

describe("compareWithHistory", () => {
  it("detecta melhora em relação a todos os meses", () => {
    expect(compareWithHistory(50, [60, 70, 80, 90])).toBe(
      "Estão melhores que os últimos 4 meses.",
    );
  });

  it("detecta piora em relação a todos os meses", () => {
    expect(compareWithHistory(95, [60, 70, 80, 90])).toBe(
      "Estão piores que os últimos 4 meses.",
    );
  });

  it("informa melhora parcial", () => {
    expect(compareWithHistory(65, [60, 70, 80, 90])).toBe(
      "Estão melhores que 3 dos últimos 4 meses.",
    );
  });

  it("informa quando não há histórico", () => {
    expect(compareWithHistory(50, [])).toBe(
      "Ainda não há histórico suficiente.",
    );
  });

  it("trata empate como favorável, nunca como piora", () => {
    const message = compareWithHistory(50, [50, 60, 70, 80]);

    expect(message).toBe("Estão melhores que os últimos 4 meses.");
    expect(message).not.toContain("piores");
  });
});

describe("dashboardView", () => {
  it("decide erro de banco sem expor percentual", () => {
    expect(
      dashboardView({
        dbError: true,
        incomeCents: 100000,
        consumedPercent: 80,
        projectedPercent: 248,
        previousPercents: [60, 70, 80, 90],
      }),
    ).toEqual({ state: "error" });
  });

  it("decide estado vazio quando não há renda", () => {
    expect(
      dashboardView({
        dbError: false,
        incomeCents: 0,
        consumedPercent: 0,
        projectedPercent: 0,
        previousPercents: [],
      }),
    ).toEqual({ state: "empty" });
  });

  it("usa a projeção na comparação e mantém o percentual parcial", () => {
    expect(
      dashboardView({
        dbError: false,
        incomeCents: 100000,
        consumedPercent: 80,
        projectedPercent: 248,
        previousPercents: [60, 70, 80, 90],
      }),
    ).toEqual({
      state: "ok",
      percent: 80,
      feedback: "Estão piores que os últimos 4 meses.",
    });
  });
});

describe("resolveDashboardState", () => {
  it("retorna ready quando há renda cadastrada", () => {
    expect(resolveDashboardState({ monthlyIncomeCents: 1 })).toBe("ready");
  });

  it("retorna empty quando a renda é zero", () => {
    expect(resolveDashboardState({ monthlyIncomeCents: 0 })).toBe("empty");
  });

  it("retorna empty quando a renda é negativa", () => {
    expect(resolveDashboardState({ monthlyIncomeCents: -100 })).toBe("empty");
  });
});

describe("monthKey", () => {
  it("formata como YYYY-MM", () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe("2026-01");
  });
});

describe("shiftMonthKey", () => {
  it("volta para o ano anterior na virada de janeiro", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("avança para o ano seguinte na virada de dezembro", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("mantém o mês quando o deslocamento é zero", () => {
    expect(shiftMonthKey("2026-06", 0)).toBe("2026-06");
  });

  it("preserva o zero à esquerda do mês", () => {
    expect(shiftMonthKey("2026-09", 1)).toBe("2026-10");
    expect(shiftMonthKey("2026-10", -1)).toBe("2026-09");
  });
});

describe("monthLabel", () => {
  it("formata o mês em pt-BR", () => {
    expect(monthLabel("2026-08")).toBe("agosto de 2026");
  });

  it("formata os meses de virada de ano", () => {
    expect(monthLabel("2025-12")).toBe("dezembro de 2025");
    expect(monthLabel("2027-01")).toBe("janeiro de 2027");
  });
});

describe("isActiveInMonth", () => {
  it("ignora itens inativos em qualquer mês", () => {
    expect(
      isActiveInMonth({ active: false, startMonth: null, endMonth: null }, "2026-10"),
    ).toBe(false);
  });

  it("trata limites nulos como sem limite", () => {
    expect(isActiveInMonth({ active: true }, "2026-10")).toBe(true);
    expect(
      isActiveInMonth({ active: true, startMonth: null, endMonth: null }, "2026-10"),
    ).toBe(true);
  });

  it("respeita a vigência de forma inclusiva nas duas pontas", () => {
    const item = { active: true, startMonth: "2026-03", endMonth: "2026-06" };
    expect(isActiveInMonth(item, "2026-02")).toBe(false);
    expect(isActiveInMonth(item, "2026-03")).toBe(true);
    expect(isActiveInMonth(item, "2026-05")).toBe(true);
    expect(isActiveInMonth(item, "2026-06")).toBe(true);
    expect(isActiveInMonth(item, "2026-07")).toBe(false);
  });

  it("trata startMonth futuro e endMonth passado como fora da vigência", () => {
    expect(isActiveInMonth({ active: true, startMonth: "2027-01" }, "2026-10")).toBe(
      false,
    );
    expect(isActiveInMonth({ active: true, endMonth: "2026-09" }, "2026-10")).toBe(
      false,
    );
  });
});

describe("validação de períodos", () => {
  it("aceita períodos abertos ou ordenados", () => {
    expect(isPeriodValid(null, null)).toBe(true);
    expect(isPeriodValid("2026-01", null)).toBe(true);
    expect(isPeriodValid(null, "2026-12")).toBe(true);
    expect(isPeriodValid("2026-01", "2026-12")).toBe(true);
    expect(isPeriodValid("2026-01", "2026-01")).toBe(true);
  });

  it("rejeita mês final anterior ao inicial", () => {
    expect(isPeriodValid("2026-05", "2026-03")).toBe(false);
  });
});

const validIncome = {
  name: "Salário",
  amountCents: 100000,
  receiveDay: 5,
};

describe("incomeCreateSchema", () => {
  it("aceita payload válido e aplica active=true por padrão", () => {
    const parsed = incomeCreateSchema.safeParse(validIncome);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.active).toBe(true);
  });

  it("aceita vigência opcional válida", () => {
    const parsed = incomeCreateSchema.safeParse({
      ...validIncome,
      startMonth: "2026-01",
      endMonth: "2026-12",
      active: false,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita nome vazio, valor inválido e dia fora de 1–31", () => {
    expect(incomeCreateSchema.safeParse({ ...validIncome, name: "  " }).success).toBe(
      false,
    );
    expect(
      incomeCreateSchema.safeParse({ ...validIncome, amountCents: -1 }).success,
    ).toBe(false);
    expect(
      incomeCreateSchema.safeParse({ ...validIncome, amountCents: 10.5 }).success,
    ).toBe(false);
    expect(incomeCreateSchema.safeParse({ ...validIncome, receiveDay: 0 }).success).toBe(
      false,
    );
    expect(
      incomeCreateSchema.safeParse({ ...validIncome, receiveDay: 32 }).success,
    ).toBe(false);
  });

  it("rejeita mês malformado e período invertido", () => {
    expect(
      incomeCreateSchema.safeParse({ ...validIncome, startMonth: "2026-13" }).success,
    ).toBe(false);
    expect(
      incomeCreateSchema.safeParse({ ...validIncome, startMonth: "26-01" }).success,
    ).toBe(false);
    expect(
      incomeCreateSchema.safeParse({
        ...validIncome,
        startMonth: "2026-05",
        endMonth: "2026-03",
      }).success,
    ).toBe(false);
  });
});

describe("incomeUpdateSchema", () => {
  it("aceita edição parcial de active", () => {
    const parsed = incomeUpdateSchema.safeParse({ active: false });
    expect(parsed.success).toBe(true);
  });

  it("rejeita valores inválidos e período invertido", () => {
    expect(incomeUpdateSchema.safeParse({ amountCents: 0 }).success).toBe(false);
    expect(incomeUpdateSchema.safeParse({ receiveDay: 40 }).success).toBe(false);
    expect(
      incomeUpdateSchema.safeParse({ startMonth: "2026-05", endMonth: "2026-01" })
        .success,
    ).toBe(false);
  });
});

describe("fixedExpense schemas", () => {
  const validExpense = {
    name: "Aluguel",
    amountCents: 250000,
    dueDay: 10,
  };

  it("aceita categoria opcional e dia válido", () => {
    const parsed = fixedExpenseCreateSchema.safeParse({
      ...validExpense,
      category: "Moradia",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.category).toBe("Moradia");
      expect(parsed.data.active).toBe(true);
    }
  });

  it("rejeita categoria não-string e dueDay fora de 1–31", () => {
    expect(
      fixedExpenseCreateSchema.safeParse({ ...validExpense, category: 123 }).success,
    ).toBe(false);
    expect(fixedExpenseCreateSchema.safeParse({ ...validExpense, dueDay: 0 }).success).toBe(
      false,
    );
    expect(
      fixedExpenseCreateSchema.safeParse({ ...validExpense, dueDay: 32 }).success,
    ).toBe(false);
  });

  it("permite edição parcial", () => {
    expect(fixedExpenseUpdateSchema.safeParse({ active: false }).success).toBe(true);
    expect(fixedExpenseUpdateSchema.safeParse({ category: null }).success).toBe(true);
  });
});

describe("conversão de valores", () => {
  it("converte reais pt-BR para centavos", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123456);
    expect(parseAmountToCents("1000")).toBe(100000);
    expect(parseAmountToCents("R$ 2.500,00")).toBe(null);
    expect(parseAmountToCents("")).toBe(null);
    expect(parseAmountToCents("0")).toBe(null);
    expect(parseAmountToCents("abc")).toBe(null);
  });

  it("formata centavos como moeda brasileira", () => {
    expect(formatCents(123456).replace(/\u00a0/g, " ")).toBe("R$ 1.234,56");
  });
});
