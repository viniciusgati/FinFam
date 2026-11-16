import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { openCycleSummaryText } from "@/lib/open-expenses";
import OpenExpensesCard from "./OpenExpensesCard";

function render(summary: { totalCents: number; count: number }): string {
  return renderToStaticMarkup(
    createElement(OpenExpensesCard, { summary }),
  ).replace(/\u00a0/g, " ");
}

describe("OpenExpensesCard (renderização)", () => {
  it("mostra o título A pagar, o resumo do ciclo e o link filtrado", () => {
    const summary = { totalCents: 12050, count: 2 };
    const html = render(summary);

    expect(html).toContain("A pagar");
    expect(html).toContain(openCycleSummaryText(summary).replace(/\u00a0/g, " "));
    expect(html).toContain('href="/gastos?status=open"');
    expect(html).toContain("Ver gastos em aberto");
  });

  it("com zero em aberto mantém a linha exata e o link", () => {
    const html = render({ totalCents: 0, count: 0 });

    expect(html).toContain("A pagar no ciclo: R$ 0,00 · Nenhum gasto em aberto");
    expect(html).toContain('href="/gastos?status=open"');
  });
});
