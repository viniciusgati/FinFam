import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import { CollapseIcon, NAV_ICONS } from "./NavIcons";

describe("NAV_ICONS", () => {
  it("cobre exatamente os ícones usados pela navegação", () => {
    const used = new Set(NAV_ITEMS.map((item) => item.icon));
    expect(Object.keys(NAV_ICONS).sort()).toEqual([...used].sort());
  });

  it("cada ícone renderiza SVG 24×24 com traço em currentColor", () => {
    for (const item of NAV_ITEMS) {
      const html = renderToStaticMarkup(NAV_ICONS[item.icon]);
      expect(html).toContain('viewBox="0 0 24 24"');
      expect(html).toContain('stroke="currentColor"');
      expect(html).toMatch(/<(path|rect|circle)/);
    }
  });

  it("inclui o ícone de ajuda (círculo com interrogação) entre os 8 itens", () => {
    expect(NAV_ITEMS).toHaveLength(8);
    const html = renderToStaticMarkup(NAV_ICONS.ajuda);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain("<circle");
  });

  it("ícone do controle de recolher/expandir segue o mesmo padrão dos ícones do menu", () => {
    const html = renderToStaticMarkup(createElement(CollapseIcon));

    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain("<path");
  });
});
