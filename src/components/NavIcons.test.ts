import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/lib/navigation";
import { NAV_ICONS, PinIcon } from "./NavIcons";

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

  it("ícone do botão Fixar segue o mesmo padrão dos ícones do menu", () => {
    const html = renderToStaticMarkup(createElement(PinIcon));

    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain("<path");
  });
});
