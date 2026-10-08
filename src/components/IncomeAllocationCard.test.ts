import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IncomeAllocationCard from "./IncomeAllocationCard";

function render(
  overrides: Partial<Parameters<typeof IncomeAllocationCard>[0]> = {},
): string {
  const props = {
    incomeCents: 1200000,
    fixedExpensesCents: 300000,
    cardExpensesCents: 600000,
    variableExpensesCents: 40000,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(IncomeAllocationCard, props)).replace(
    /\u00a0/g,
    " ",
  );
}

describe("IncomeAllocationCard (renderização)", () => {
  it("mostra a renda, as fatias com valores e percentuais", () => {
    const html = render();

    expect(html).toContain("Para onde vai a renda");
    expect(html).toContain("R$ 12.000,00");
    expect(html).toContain("Contas fixas");
    expect(html).toContain("Fatura do cartão");
    expect(html).toContain("Gastos avulsos");
    expect(html).toContain("Ainda disponível");
    expect(html).toContain("R$ 2.600,00");
    expect(html).toContain("(25%)");
    expect(html).toContain("(50%)");
    expect(html).toContain('role="img"');
  });

  it("alerta quando o consumo passa da renda", () => {
    const html = render({
      incomeCents: 100000,
      fixedExpensesCents: 60000,
      cardExpensesCents: 50000,
      variableExpensesCents: 10000,
    });

    expect(html).toContain("No vermelho: o consumo passou a renda em R$ 200,00.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Ainda disponível");
  });

  it("mostra o estado vazio sem renda", () => {
    const html = render({
      incomeCents: 0,
      fixedExpensesCents: 0,
      cardExpensesCents: 0,
      variableExpensesCents: 0,
    });

    expect(html).toContain("Sem renda cadastrada neste mês");
  });
});
