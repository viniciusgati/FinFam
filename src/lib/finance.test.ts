import { describe, expect, it } from "vitest";
import {
  classifyLevel,
  compareWithHistory,
  computeFinanceStatus,
  heatColor,
  monthKey,
  previousMonthKeys,
} from "./finance";

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

  it("informa quando não há histórico", () => {
    expect(compareWithHistory(50, [])).toBe(
      "Ainda não há histórico suficiente.",
    );
  });
});

describe("monthKey", () => {
  it("formata como YYYY-MM", () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe("2026-01");
  });
});

describe("previousMonthKeys", () => {
  it("retorna os 4 meses anteriores, do mais recente ao mais antigo", () => {
    expect(previousMonthKeys(new Date(2026, 9, 6))).toEqual([
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-06",
    ]);
  });

  it("cruza o ano quando a referência está em janeiro", () => {
    expect(previousMonthKeys(new Date(2026, 0, 2))).toEqual([
      "2025-12",
      "2025-11",
      "2025-10",
      "2025-09",
    ]);
  });

  it("sempre devolve 4 chaves contíguas, sem buracos", () => {
    const keys = previousMonthKeys(new Date(2026, 2, 31));
    expect(keys).toHaveLength(4);
    const months = keys.map((key) => {
      const [year, month] = key.split("-").map(Number);
      return year * 12 + month;
    });
    expect(months[0] - months[1]).toBe(1);
    expect(months[1] - months[2]).toBe(1);
    expect(months[2] - months[3]).toBe(1);
  });
});
