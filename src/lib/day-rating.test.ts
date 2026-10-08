import { describe, expect, it } from "vitest";
import { rateDay } from "./day-rating";

describe("rateDay", () => {
  it("sem renda retorna neutral / Sem renda cadastrada", () => {
    expect(
      rateDay({
        dailyFreeBudgetCents: 0,
        todayExpensesCents: 100,
        incomeCents: 0,
      }),
    ).toEqual({ level: "neutral", label: "Sem renda cadastrada" });
  });

  it("com renda mas orçamento livre zerado retorna red / Crítico", () => {
    expect(
      rateDay({
        dailyFreeBudgetCents: 0,
        todayExpensesCents: 100,
        incomeCents: 310000,
      }),
    ).toEqual({ level: "red", label: "Crítico" });
  });

  it("dentro do orçamento livre diário retorna green / Ok", () => {
    expect(
      rateDay({
        dailyFreeBudgetCents: 10000,
        todayExpensesCents: 10000,
        incomeCents: 310000,
      }),
    ).toEqual({ level: "green", label: "Ok" });
  });

  it("acima do orçamento livre retorna no mínimo yellow / Cuidado", () => {
    const rating = rateDay({
      dailyFreeBudgetCents: 10000,
      todayExpensesCents: 10001,
      incomeCents: 310000,
    });

    expect(rating.level).toBe("yellow");
    expect(rating.label).toBe("Cuidado");
  });

  it("escala até red quando o gasto é muito acima do orçamento livre", () => {
    const rating = rateDay({
      dailyFreeBudgetCents: 10000,
      todayExpensesCents: 50000,
      incomeCents: 310000,
    });

    expect(rating.level).toBe("red");
    expect(rating.label).toBe("Crítico");
  });

  it("orçamento livre apertado torna o dia vermelho", () => {
    expect(
      rateDay({
        dailyFreeBudgetCents: 968,
        todayExpensesCents: 3000,
        incomeCents: 100000,
      }),
    ).toEqual({ level: "red", label: "Crítico" });
  });
});
