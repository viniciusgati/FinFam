import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  cycleWindow,
  dailyAllowanceCard,
  type DailyAllowance,
} from "@/lib/cycle";
import DailyAllowanceCard from "./DailyAllowanceCard";

const NOW = new Date("2026-03-25T15:00:00.000Z");

function makeAllowance(overrides: Partial<DailyAllowance>): DailyAllowance {
  return {
    dailyCents: 0,
    freeBudgetCents: 0,
    remainingDays: 10,
    hasData: true,
    window: cycleWindow(NOW, 1),
    ...overrides,
  };
}

function render(allowance: DailyAllowance): string {
  return renderToStaticMarkup(
    createElement(DailyAllowanceCard, { card: dailyAllowanceCard(allowance) }),
  ).replace(/\u00a0/g, " ");
}

describe("DailyAllowanceCard (renderização)", () => {
  it("mostra a diária em R$ e os dias restantes no ciclo", () => {
    const html = render(
      makeAllowance({
        dailyCents: 12500,
        freeBudgetCents: 325000,
        remainingDays: 26,
      }),
    );

    expect(html).toContain("R$ 125,00 por dia");
    expect(html).toContain("26 dias restantes no ciclo");
  });

  it("orçamento esgotado mostra R$ 0,00 por dia", () => {
    const html = render(makeAllowance({ freeBudgetCents: 0 }));

    expect(html).toContain("R$ 0,00 por dia");
    expect(html).toContain("Orçamento do ciclo esgotado");
  });

  it("remainingDays = 0 mostra Último dia do ciclo", () => {
    const html = render(
      makeAllowance({ dailyCents: 5000, freeBudgetCents: 5000, remainingDays: 0 }),
    );

    expect(html).toContain("R$ 50,00 por dia");
    expect(html).toContain("Último dia do ciclo");
  });

  it("sem dados do ciclo mostra Sem dados do ciclo", () => {
    const html = render(makeAllowance({ hasData: false }));

    expect(html).toContain("Sem dados do ciclo");
  });
});
