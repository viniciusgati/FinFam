import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GlossaryTermId } from "@/lib/glossary";
import TermHelpLink from "./TermHelpLink";

function render(termId: GlossaryTermId): string {
  return renderToStaticMarkup(createElement(TermHelpLink, { termId }));
}

describe("TermHelpLink (renderização)", () => {
  it("aponta para a âncora do ciclo com texto e rótulo acessível", () => {
    const html = render("ciclo");

    expect(html).toContain('href="/ajuda#ciclo"');
    expect(html).toContain('aria-label="Saiba mais sobre Ciclo financeiro"');
    expect(html).toMatch(/>Saiba mais</);
  });

  it("aponta para a âncora da diária com texto e rótulo acessível", () => {
    const html = render("diaria");

    expect(html).toContain('href="/ajuda#diaria"');
    expect(html).toContain('aria-label="Saiba mais sobre Diária"');
    expect(html).toMatch(/>Saiba mais</);
  });

  it("diferencia o link do texto comum e tem foco visível", () => {
    const html = render("ciclo");

    expect(html).toContain("underline");
    expect(html).toContain("focus-visible:ring-2");
  });
});
