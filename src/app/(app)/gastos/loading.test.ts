import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

const DASHBOARD_ZONE_TEXTS = [
  "Gastos por categoria",
  "Resumo do ciclo",
  "Compromissos",
  "Explorar",
];

function render(): string {
  return renderToStaticMarkup(createElement(Loading)).replace(/\u00a0/g, " ");
}

describe("Loading de /gastos (skeleton acessível)", () => {
  it("expõe role=status + aria-busy e o texto de carregamento", () => {
    const html = render();

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Carregando…");
  });

  it("mostra o contexto de gastos e o seletor de mês desabilitado", () => {
    const html = render();

    expect(html).toContain("Gastos avulsos");
    expect(html).toContain("Mês");
    expect(html).toContain('aria-label="Selecionar mês"');
    expect(html).toContain("<select");
    expect(html).toContain("disabled");
  });

  it("não reaproveita textos de zona do dashboard", () => {
    const html = render();

    for (const text of DASHBOARD_ZONE_TEXTS) {
      expect(html).not.toContain(text);
    }
  });
});
