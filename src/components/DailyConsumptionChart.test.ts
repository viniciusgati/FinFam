import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DailyConsumptionChart from "./DailyConsumptionChart";

function render(
  overrides: Partial<Parameters<typeof DailyConsumptionChart>[0]> = {},
): string {
  const props = {
    variableDailyCents: [0, 0, 5000, 0, 2000, 0, 0],
    obligationDailyCents: [0, 0, 0, 0, 10000, 0, 0],
    elapsedDay: 5,
    highlightDay: 3,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(DailyConsumptionChart, props)).replace(
    /\u00a0/g,
    " ",
  );
}

describe("DailyConsumptionChart (renderização)", () => {
  it("mostra título, resumo do dia típico e a legenda", () => {
    const html = render();

    expect(html).toContain("Consumo por dia");
    expect(html).toContain("Hoje: R$ 50,00");
    expect(html).toContain("Dia típico (Mediana): R$ 35,00");
    expect(html).toContain("Consumo do dia");
    expect(html).toContain("Vencimento (fixas/fatura)");
    expect(html).toContain('role="img"');
  });

  it("mostra o estado vazio sem consumo", () => {
    const html = render({
      variableDailyCents: [0, 0],
      obligationDailyCents: [0, 0],
      elapsedDay: 2,
      highlightDay: undefined,
    });

    expect(html).toContain("Sem consumo variável neste mês");
    expect(html).not.toContain("Hoje:");
  });
});
