import { describe, expect, it } from "vitest";
import { buildDailySeries } from "../dashboard-series";
import {
  buildMonthReviewData,
  buildMonthReviewPrompt,
  localMonthReview,
  monthReviewSnapshotFrom,
  type MonthReviewSnapshot,
} from "./month-review";

const normalize = (text: string): string => text.replace(/\u00a0/g, " ");

const snapshot: MonthReviewSnapshot = {
  incomeCents: 500000,
  fixedExpensesCents: 100000,
  variableExpensesCents: 50000,
  cardExpensesCents: 20000,
  consumedCents: 170000,
  consumedPercent: 34,
  daysInMonth: 30,
  elapsedDay: 30,
  dailyBudgetCents: 16667,
  projectedMonthEndCents: 170000,
};

describe("buildMonthReviewData", () => {
  it("só contém números e calcula a média dos meses fechados", () => {
    const data = buildMonthReviewData(snapshot, [100000, 200000]);

    for (const value of Object.values(data)) {
      expect(typeof value).toBe("number");
    }
    expect(data.previousMonthsCount).toBe(2);
    expect(data.previousMonthsAverageCents).toBe(150000);
  });

  it("sem histórico usa contagem 0 e média 0", () => {
    const data = buildMonthReviewData(snapshot);
    expect(data.previousMonthsCount).toBe(0);
    expect(data.previousMonthsAverageCents).toBe(0);
  });

  it("expõe os 10 campos numéricos do mês e o histórico", () => {
    const data = buildMonthReviewData(snapshot, [100000, 200000]);

    expect(data).toMatchObject({
      incomeCents: 500000,
      fixedExpensesCents: 100000,
      variableExpensesCents: 50000,
      cardExpensesCents: 20000,
      consumedCents: 170000,
      consumedPercent: 34,
      daysInMonth: 30,
      elapsedDay: 30,
      dailyBudgetCents: 16667,
      projectedMonthEndCents: 170000,
      previousMonthsCount: 2,
      previousMonthsAverageCents: 150000,
    });
  });

  it("não calcula média com apenas 1 mês anterior (regressão)", () => {
    const data = buildMonthReviewData(snapshot, [100000]);

    expect(data.previousMonthsCount).toBe(0);
    expect(data.previousMonthsAverageCents).toBe(0);
    expect(localMonthReview(data)).not.toContain("média");
  });
});

describe("buildMonthReviewPrompt", () => {
  it("deixa apenas números no conteúdo do usuário", () => {
    const messages = buildMonthReviewPrompt(buildMonthReviewData(snapshot));
    const user = messages.find((message) => message.role === "user");
    const parsed = JSON.parse(user?.content ?? "{}") as Record<string, unknown>;

    for (const value of Object.values(parsed)) {
      expect(typeof value).toBe("number");
    }
  });
});

describe("localMonthReview", () => {
  it("cita a média quando há histórico", () => {
    const text = localMonthReview(buildMonthReviewData(snapshot, [100000, 200000]));
    expect(text).toContain("média");
  });

  it("menciona o percentual consumido", () => {
    const text = localMonthReview(buildMonthReviewData(snapshot));
    expect(text).toContain("34%");
  });
});

describe("localMonthReview — projeção da série diária", () => {
  it("não infla a fixa do dia 1 no texto da revisão do mês", () => {
    const series = buildDailySeries({
      referenceDate: new Date(Date.UTC(2026, 9, 1, 12)), // outubro/2026
      now: new Date(Date.UTC(2026, 9, 1, 12)), // 01/10/2026
      incomeCents: 100000,
      fixedExpenses: [{ amountCents: 30000, dueDay: 1 }],
      variableExpenses: [
        {
          amountCents: 5000,
          date: new Date(Date.UTC(2026, 9, 1, 12)),
          paymentMethod: "PIX",
        },
      ],
    });
    const data = buildMonthReviewData(
      monthReviewSnapshotFrom({
        monthlyIncomeCents: 100000,
        fixedExpensesCents: 30000,
        variableExpensesCents: 5000,
        cardExpensesCents: 0,
        series,
      }),
    );

    // 30000 de obrigação + round(5000 / 1 * 31) de variável extrapolado.
    expect(series.projectedMonthEndCents).toBe(185000);
    expect(normalize(localMonthReview(data))).toBe(
      "No mês, 35% da renda foi consumida (R$ 350,00 de R$ 1.000,00). " +
        "No ritmo atual, a projeção de fechamento é R$ 1.850,00.",
    );
  });
});

describe("monthReviewSnapshotFrom", () => {
  it("deriva consumido e percentual a partir dos agregados", () => {
    const result = monthReviewSnapshotFrom({
      monthlyIncomeCents: 200000,
      fixedExpensesCents: 50000,
      variableExpensesCents: 30000,
      cardExpensesCents: 20000,
      series: {
        daysInMonth: 30,
        elapsedDay: 30,
        dailyBudgetCents: 6667,
        projectedMonthEndCents: 100000,
      },
    });

    expect(result.consumedCents).toBe(100000);
    expect(result.consumedPercent).toBe(50);
  });
});
