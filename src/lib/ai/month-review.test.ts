import { describe, expect, it } from "vitest";
import {
  buildMonthReviewData,
  buildMonthReviewPrompt,
  localMonthReview,
  monthReviewSnapshotFrom,
  type MonthReviewSnapshot,
} from "./month-review";

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
