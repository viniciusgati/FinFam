import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NAV_EXPANDED_STORAGE_KEY,
  readNavExpanded,
  writeNavExpanded,
} from "./nav-collapse";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readNavExpanded / writeNavExpanded", () => {
  it("alterna o valor gravado em finfam.nav.expanded", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });

    expect(readNavExpanded()).toBe(true);
    writeNavExpanded(false);
    expect(store.get(NAV_EXPANDED_STORAGE_KEY)).toBe("false");
    expect(readNavExpanded()).toBe(false);
    writeNavExpanded(true);
    expect(store.get(NAV_EXPANDED_STORAGE_KEY)).toBe("true");
    expect(readNavExpanded()).toBe(true);
  });

  it("sem valor persistido assume expandido", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
    });

    expect(readNavExpanded()).toBe(true);
  });

  it("sem localStorage retorna expandido sem lançar exceção", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(readNavExpanded()).toBe(true);
    expect(() => writeNavExpanded(false)).not.toThrow();
  });

  it("quando o acesso ao localStorage lança, retorna expandido sem exceção", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });

    expect(readNavExpanded()).toBe(true);
    expect(() => writeNavExpanded(false)).not.toThrow();
  });
});
