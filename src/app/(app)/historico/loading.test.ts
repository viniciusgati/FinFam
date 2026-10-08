import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HISTORY_LOADING_MESSAGE } from "@/lib/history";
import Loading from "./loading";

function render(): string {
  return renderToStaticMarkup(createElement(Loading)).replace(/\u00a0/g, " ");
}

describe("Loading de /historico (skeleton acessível)", () => {
  it("expõe role=status + aria-busy e o texto de carregamento", () => {
    const html = render();

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(HISTORY_LOADING_MESSAGE);
  });

  it("desabilita os controles durante o carregamento", () => {
    const html = render();

    const disabledCount = (html.match(/disabled=""/g) ?? []).length;
    // Dois botões (mês anterior/próximo) + o input de mês.
    expect(disabledCount).toBeGreaterThanOrEqual(3);
    expect(html).toContain('type="month"');
  });

  it("não renderiza nenhum valor provisório", () => {
    const html = render();

    expect(html).not.toContain("R$");
    expect(html).not.toContain("%");
  });
});
