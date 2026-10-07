import { describe, expect, it } from "vitest";
import { rateDay } from "./day-rating";

describe("rateDay", () => {
  it("sem renda retorna neutral / Sem renda cadastrada", () => {
    expect(
      rateDay({ dailyBudgetCents: 0, todayExpensesCents: 100, incomeCents: 0 }),
    ).toEqual({ level: "neutral", label: "Sem renda cadastrada" });
  });

  it("com renda mas orçamento diário não positivo retorna neutral", () => {
    expect(
      rateDay({
        dailyBudgetCents: 0,
        todayExpensesCents: 100,
        incomeCents: 310000,
      }),
    ).toEqual({ level: "neutral", label: "Sem renda cadastrada" });
  });

  it("dentro do orçamento diário retorna green / Ok", () => {
    expect(
      rateDay({
        dailyBudgetCents: 10000,
        todayExpensesCents: 10000,
        incomeCents: 310000,
      }),
    ).toEqual({ level: "green", label: "Ok" });
  });

  it("acima do orçamento diário retorna no mínimo yellow / Cuidado", () => {
    const rating = rateDay({
      dailyBudgetCents: 10000,
      todayExpensesCents: 10001,
      incomeCents: 310000,
    });

    expect(rating.level).toBe("yellow");
    expect(rating.label).toBe("Cuidado");
  });

  it("escala até red quando o gasto é muito acima do orçamento", () => {
    const rating = rateDay({
      dailyBudgetCents: 10000,
      todayExpensesCents: 50000,
      incomeCents: 310000,
    });

    expect(rating.level).toBe("red");
    expect(rating.label).toBe("Crítico");
  });
});
