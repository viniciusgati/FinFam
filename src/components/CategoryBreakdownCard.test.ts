import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CategoryBreakdown } from "@/lib/category-breakdown";
import CategoryBreakdownCard from "./CategoryBreakdownCard";

function render(breakdown: CategoryBreakdown): string {
  return renderToStaticMarkup(
    createElement(CategoryBreakdownCard, { breakdown }),
  ).replace(/\u00a0/g, " ");
}

const populated: CategoryBreakdown = {
  monthKey: "2026-10",
  items: [
    { category: "Moradia", amountCents: 120000 },
    { category: "Mercado", amountCents: 6000 },
  ],
  totalCents: 126000,
};

const empty: CategoryBreakdown = {
  monthKey: "2026-10",
  items: [],
  totalCents: 0,
};

describe("CategoryBreakdownCard (renderização)", () => {
  it("renderiza o gráfico com role=img e aria-label citando fatias e total", () => {
    const html = render(populated);

    expect(html).toContain('role="img"');
    expect(html).toContain(
      'aria-label="Gastos por categoria: Moradia R$ 1.200,00 (95%), Mercado R$ 60,00 (5%). Total R$ 1.260,00"',
    );
  });

  it("lista as fatias com R$ e % na tabela, na ordem maior→menor", () => {
    const html = render(populated);

    expect(html).toContain("Gastos por categoria");
    expect(html).toContain("Categoria");
    expect(html).toContain("Valor");
    expect(html).toContain("Moradia");
    expect(html).toContain("R$ 1.200,00");
    expect(html).toContain("95%");
    expect(html).toContain("Mercado");
    expect(html).toContain("R$ 60,00");
    expect(html).toContain("5%");
    expect(html).toContain("Total — R$ 1.260,00");
    expect(html.indexOf("Moradia")).toBeLessThan(html.indexOf("Mercado"));
    expect(html.indexOf("Mercado")).toBeLessThan(html.indexOf("Total"));
  });

  it("no estado vazio mostra a mensagem e o CTA para /gastos, sem gráfico", () => {
    const html = render(empty);

    expect(html).toContain("Nenhum gasto por categoria neste mês");
    expect(html).toContain('href="/gastos"');
    expect(html).toContain("Registrar gastos");
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("Total —");
  });
});
