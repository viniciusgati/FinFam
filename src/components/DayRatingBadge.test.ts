import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FinanceLevel } from "@/lib/finance";
import { levelLabel } from "@/lib/finance";
import { buildDailySeries } from "@/lib/dashboard-series";
import { rateDay } from "@/lib/day-rating";
import DayRatingBadge from "./DayRatingBadge";

const LEVELS: FinanceLevel[] = [
  "green",
  "lime",
  "yellow",
  "orange",
  "red",
  "neutral",
];

function render(level: FinanceLevel, label?: string): string {
  return renderToStaticMarkup(
    createElement(DayRatingBadge, { level, label }),
  );
}

describe("DayRatingBadge (renderização)", () => {
  for (const level of LEVELS) {
    it(`mostra o texto e o aria-label de ${level}`, () => {
      const text = levelLabel(level);
      const html = render(level);

      expect(html).toContain(text);
      expect(html).toContain(`aria-label="Avaliação do dia: ${text}"`);
    });
  }
});

describe("Avaliação do dia — integração série + função + badge", () => {
  // Outubro/2026 é mês fechado (now em novembro): "hoje" é o último dia (31).
  const NOW = new Date(Date.UTC(2026, 10, 5, 12));
  const OCTOBER = new Date(Date.UTC(2026, 9, 1, 12));

  it("badge fica vermelho quando obrigações comprometem o orçamento do dia", () => {
    const series = buildDailySeries({
      referenceDate: OCTOBER,
      now: NOW,
      incomeCents: 100000,
      // Vence no dia 10, então não entra no gasto do dia avaliado (31).
      fixedExpenses: [{ amountCents: 70000, dueDay: 10 }],
      variableExpenses: [
        {
          amountCents: 3000,
          date: new Date(Date.UTC(2026, 9, 31, 12)),
          paymentMethod: "PIX",
        },
      ],
    });

    expect(series.dailyFreeBudgetCents).toBe(968);
    expect(series.todayExpensesCents).toBe(3000);

    const rating = rateDay({
      dailyFreeBudgetCents: series.dailyFreeBudgetCents,
      todayExpensesCents: series.todayExpensesCents,
      incomeCents: series.entriesCents,
    });

    expect(rating).toEqual({ level: "red", label: "Crítico" });
    expect(render(rating.level, rating.label)).toContain("Crítico");
  });
});
