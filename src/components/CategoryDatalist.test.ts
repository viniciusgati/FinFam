import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CategoryDatalist from "./CategoryDatalist";

function render(suggestions: string[]): string {
  return renderToStaticMarkup(
    createElement(CategoryDatalist, { suggestions }),
  );
}

describe("CategoryDatalist (renderização)", () => {
  it("inclui a opção Sem categoria e as sugestões recebidas", () => {
    const html = render(["Mercado", "Alimentação"]);

    expect(html).toContain("<datalist");
    expect(html).toContain('value=""');
    expect(html).toContain("Sem categoria");
    expect(html).toContain('value="Mercado"');
    expect(html).toContain('value="Alimentação"');
  });

  it("mantém a opção Sem categoria mesmo sem sugestões", () => {
    const html = render([]);

    expect(html).toContain("<datalist");
    expect(html).toContain('value=""');
    expect(html).toContain("Sem categoria");
  });
});
