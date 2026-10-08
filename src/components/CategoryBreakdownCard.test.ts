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
  it("renderiza os itens na ordem e o total com rótulo acessível", () => {
    const html = render(populated);

    expect(html).toContain('aria-label="Gastos por categoria"');
    expect(html).toContain("Gastos por categoria");
    expect(html).toContain("Moradia — R$ 1.200,00");
    expect(html).toContain("Mercado — R$ 60,00");
    expect(html).toContain("Total — R$ 1.260,00");
    expect(html.indexOf("Moradia")).toBeLessThan(html.indexOf("Mercado"));
    expect(html.indexOf("Mercado")).toBeLessThan(html.indexOf("Total"));
  });

  it("no estado vazio mostra a mensagem e o CTA para /gastos", () => {
    const html = render(empty);

    expect(html).toContain("Nenhum gasto por categoria neste mês");
    expect(html).toContain('href="/gastos"');
    expect(html).toContain("Registrar gastos");
    expect(html).not.toContain("Total —");
  });
});
