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
    // O dia típico continua com rótulo textual no resumo (sem linha no plot).
    expect(html).toContain("Dia típico (Mediana)");
    expect(html).toContain('role="img"');
  });

  it("não desenha linha tracejada no meio do gráfico (regressão)", () => {
    const html = render();

    // A linha do dia típico cruzava o gráfico no meio e confundia a leitura.
    expect(html).not.toContain("stroke-dasharray");
    expect(html).not.toContain("<line");
    // Some a linha, mas o valor do dia típico segue no resumo.
    expect(html).toContain("Dia típico (Mediana): R$ 35,00");
    expect(html).toContain("1 dia acima");
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
