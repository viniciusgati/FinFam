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

describe("Loading de /configuracoes (skeleton acessível)", () => {
  it("expõe role=status + aria-busy e o texto de carregamento", () => {
    const html = render();

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Carregando…");
  });

  it("mostra o contexto de configurações e o campo do ciclo desabilitado", () => {
    const html = render();

    expect(html).toContain("Configurações");
    expect(html).toContain('aria-label="Dia de início do ciclo financeiro"');
    expect(html).toContain("<input");
    expect(html).toContain("disabled");
  });

  it("não reaproveita textos de zona do dashboard", () => {
    const html = render();

    for (const text of DASHBOARD_ZONE_TEXTS) {
      expect(html).not.toContain(text);
    }
  });
});
