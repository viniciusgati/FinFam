import { describe, expect, it } from "vitest";
import {
  NAV_AUTO_COLLAPSE_MS,
  defaultNavExpanded,
  parseStoredExpanded,
  shouldAutoCollapse,
} from "./nav-collapse";

describe("shouldAutoCollapse", () => {
  it("recolhe quando o tempo de inatividade expira", () => {
    expect(shouldAutoCollapse(0, NAV_AUTO_COLLAPSE_MS)).toBe(true);
    expect(shouldAutoCollapse(1000, 1000 + NAV_AUTO_COLLAPSE_MS + 1)).toBe(
      true,
    );
  });

  it("mantém expandido quando houve interação recente", () => {
    expect(shouldAutoCollapse(1000, 1000)).toBe(false);
    expect(shouldAutoCollapse(1000, 1000 + NAV_AUTO_COLLAPSE_MS - 1)).toBe(
      false,
    );
  });

  it("respeita um timeout customizado", () => {
    expect(shouldAutoCollapse(0, 3000, 5000)).toBe(false);
    expect(shouldAutoCollapse(0, 5000, 5000)).toBe(true);
  });
});

describe("defaultNavExpanded", () => {
  it("inicia recolhido no tablet e expandido no desktop", () => {
    expect(defaultNavExpanded(true)).toBe(false);
    expect(defaultNavExpanded(false)).toBe(true);
  });
});

describe("parseStoredExpanded", () => {
  it("converte a preferência persistida em boolean", () => {
    expect(parseStoredExpanded("true")).toBe(true);
    expect(parseStoredExpanded("false")).toBe(false);
  });

  it("retorna null para valores ausentes ou inválidos", () => {
    expect(parseStoredExpanded(null)).toBeNull();
    expect(parseStoredExpanded("1")).toBeNull();
    expect(parseStoredExpanded("")).toBeNull();
  });
});
