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
    // Cada série (barra, marcador e linha do dia típico) tem rótulo textual
    // próprio, sem depender da cor/`fill`.
    expect(html).toContain("Dia típico (Mediana)");
    expect(html).toContain('role="img"');
  });

  it("inclui consumo, dia típico e vencimentos em R$ no aria-label", () => {
    const html = render();

    const aria = html.match(/role="img" aria-label="([^"]*)"/)?.[1] ?? "";
    expect(aria).toContain("consumo total R$ 70,00");
    expect(aria).toContain("dia típico R$ 35,00 (Mediana)");
    expect(aria).toContain("totalizando R$ 100,00");
  });

  it("no estado vazio mostra a mensagem e o CTA para /gastos", () => {
    const html = render({
      variableDailyCents: [0, 0],
      obligationDailyCents: [0, 0],
      elapsedDay: 2,
      highlightDay: undefined,
    });

    expect(html).toContain("Sem consumo variável neste mês");
    expect(html).toContain('href="/gastos"');
    expect(html).toContain("Registrar gastos");
    expect(html).not.toContain("Hoje:");
  });
});
