import { describe, expect, it } from "vitest";
import { NAV_ICONS } from "./nav-icons";
import { NAV_ITEMS, type NavIconName } from "./navigation";

describe("NAV_ICONS", () => {
  it("mapeia cada ícone da navegação para paths SVG válidos", () => {
    for (const item of NAV_ITEMS) {
      const paths = NAV_ICONS[item.icon];
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) {
        expect(d.trim().length).toBeGreaterThan(0);
        expect(d).toMatch(/^[Mm]/);
      }
    }
  });

  it("cobre exatamente os ícones usados pela navegação", () => {
    const used = new Set<NavIconName>(NAV_ITEMS.map((item) => item.icon));
    expect(Object.keys(NAV_ICONS).sort()).toEqual([...used].sort());
  });
});
