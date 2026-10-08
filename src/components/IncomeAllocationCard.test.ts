import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IncomeAllocationCard from "./IncomeAllocationCard";

function render(
  overrides: Partial<Parameters<typeof IncomeAllocationCard>[0]> = {},
): string {
  const props = {
    incomeCents: 1200000,
    fixedIncomeCents: 1000000,
    variableIncomeCents: 200000,
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
  it("mostra as entradas decompostas, as saídas, o consumo e o saldo", () => {
    const html = render();

    expect(html).toContain("Para onde vai a renda");
    expect(html).toContain("Entradas fixas");
    expect(html).toContain("R$ 10.000,00");
    expect(html).toContain("Entradas variáveis");
    expect(html).toContain("R$ 2.000,00");
    expect(html).toContain("Total de entradas");
    expect(html).toContain("R$ 12.000,00");
    expect(html).toContain("Contas fixas");
    expect(html).toContain("Fatura do cartão");
    expect(html).toContain("Gastos avulsos");
    expect(html).toContain("Saldo do mês");
    expect(html).toContain("R$ 2.600,00");
    expect(html).toContain("Consumo disponível");
    expect(html).toContain("R$ 9.000,00");
    expect(html).toContain("(25%)");
    expect(html).toContain("(50%)");
    expect(html).toContain('role="img"');
  });

  it("inclui os valores em R$ das séries no aria-label do gráfico", () => {
    const html = render();

    const aria = html.match(/role="img" aria-label="([^"]*)"/)?.[1] ?? "";
    expect(aria).toContain("Entradas fixas R$ 10.000,00");
    expect(aria).toContain("Entradas variáveis R$ 2.000,00");
    expect(aria).toContain("total de entradas R$ 12.000,00");
    expect(aria).toContain("Contas fixas R$ 3.000,00");
    expect(aria).toContain("Fatura do cartão R$ 6.000,00");
    expect(aria).toContain("Gastos avulsos R$ 400,00");
    expect(aria).toContain("consumo disponível R$ 9.000,00");
    expect(aria).toContain("saldo do mês R$ 2.600,00");
  });

  it("alerta quando as saídas passam das entradas", () => {
    const html = render({
      incomeCents: 100000,
      fixedIncomeCents: 80000,
      variableIncomeCents: 20000,
      fixedExpensesCents: 60000,
      cardExpensesCents: 50000,
      variableExpensesCents: 10000,
    });

    expect(html).toContain("Saldo do mês");
    expect(html).toContain("-R$ 200,00");
    expect(html).toContain("No vermelho: o consumo passou a renda em R$ 200,00.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("(0%)");
  });

  it("no estado vazio mostra a mensagem e o CTA para /gastos", () => {
    const html = render({
      incomeCents: 0,
      fixedIncomeCents: 0,
      variableIncomeCents: 0,
      fixedExpensesCents: 0,
      cardExpensesCents: 0,
      variableExpensesCents: 0,
    });

    expect(html).toContain("Sem renda cadastrada neste mês");
    expect(html).toContain('href="/gastos"');
    expect(html).toContain("Registrar gastos");
    expect(html).not.toContain('role="img"');
  });
});
