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
    variableSpentCents: 0,
    elapsedDays: 0,
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

  it("mostra o rótulo do período do ciclo e o saldo restante", () => {
    const html = render(
      makeAllowance({
        dailyCents: 12500,
        freeBudgetCents: 325000,
        remainingDays: 26,
        window: cycleWindow(NOW, 20),
      }),
    );

    expect(html).toContain("Ciclo financeiro · início dia 20");
    expect(html).toContain("Ainda tem R$ 3.250,00 até o fim do ciclo");
  });

  it("quando o ciclo coincide com o mês, explica no rótulo do período", () => {
    const html = render(makeAllowance({}));

    expect(html).toContain(
      "Ciclo financeiro · início dia 1 (coincide com o mês)",
    );
  });

  it("inclui o rótulo do período no aria-label da seção", () => {
    const html = render(makeAllowance({ window: cycleWindow(NOW, 20) }));
    const match = html.match(/aria-label="([^"]*)"/);

    expect(match?.[1]).toContain("Ciclo financeiro · início dia 20");
  });

  it("no-data mostra Sem dados do ciclo e não exibe linha de saldo", () => {
    const html = render(makeAllowance({ hasData: false }));

    expect(html).toContain("Sem dados do ciclo");
    expect(html).not.toContain("Ainda tem");
  });

  it("orçamento esgotado mostra R$ 0,00 por dia", () => {
    const html = render(makeAllowance({ freeBudgetCents: 0 }));

    expect(html).toContain("R$ 0,00 por dia");
    expect(html).toContain("Orçamento do ciclo esgotado");
  });

  it("ciclo estourado mostra a diária negativa", () => {
    const html = render(
      makeAllowance({ dailyCents: -1250, freeBudgetCents: 0, remainingDays: 8 }),
    );

    expect(html).toContain("-R$ 12,50 por dia");
    expect(html).toContain("Orçamento do ciclo estourado");
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
