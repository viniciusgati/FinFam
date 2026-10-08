import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isNavIdle,
  navExpanded,
  NAV_AUTO_COLLAPSE_MS,
  NAV_PINNED_STORAGE_KEY,
  readNavPinned,
  touchNav,
  writeNavPinned,
  type NavCollapseState,
} from "./nav-collapse";

function state(overrides: Partial<NavCollapseState> = {}): NavCollapseState {
  return { pinned: false, lastInteractionAt: 0, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("navExpanded", () => {
  it("colapsa quando passou 5000ms sem interação e sem fixar", () => {
    const now = NAV_AUTO_COLLAPSE_MS;
    expect(navExpanded(state({ lastInteractionAt: 0 }), now)).toBe(false);
  });

  it("permanece expandido antes dos 5000ms", () => {
    const now = NAV_AUTO_COLLAPSE_MS - 1;
    expect(navExpanded(state({ lastInteractionAt: 0 }), now)).toBe(true);
  });

  it("permanece expandido após 5000ms quando fixado", () => {
    const now = NAV_AUTO_COLLAPSE_MS + 10_000;
    expect(
      navExpanded(state({ pinned: true, lastInteractionAt: 0 }), now),
    ).toBe(true);
  });
});

describe("isNavIdle", () => {
  it("é ocioso exatamente no limite de 5000ms", () => {
    expect(isNavIdle(state({ lastInteractionAt: 1000 }), 6000)).toBe(true);
    expect(isNavIdle(state({ lastInteractionAt: 1000 }), 5999)).toBe(false);
  });
});

describe("touchNav", () => {
  it("grava lastInteractionAt = now preservando pinned", () => {
    const next = touchNav(state({ pinned: true, lastInteractionAt: 5 }), 42);

    expect(next).toEqual({ pinned: true, lastInteractionAt: 42 });
  });

  it("reinicia a contagem do auto-colapso", () => {
    const touched = touchNav(state({ lastInteractionAt: 0 }), 4999);

    expect(navExpanded(touched, 4999 + NAV_AUTO_COLLAPSE_MS - 1)).toBe(true);
    expect(navExpanded(touched, 4999 + NAV_AUTO_COLLAPSE_MS)).toBe(false);
  });
});

describe("readNavPinned / writeNavPinned", () => {
  it("alterna o valor gravado em finfam.nav.pinned", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });

    expect(readNavPinned()).toBe(false);
    writeNavPinned(true);
    expect(store.get(NAV_PINNED_STORAGE_KEY)).toBe("true");
    expect(readNavPinned()).toBe(true);
    writeNavPinned(false);
    expect(store.get(NAV_PINNED_STORAGE_KEY)).toBe("false");
    expect(readNavPinned()).toBe(false);
  });

  it("sem localStorage retorna false sem lançar exceção", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(readNavPinned()).toBe(false);
    expect(() => writeNavPinned(true)).not.toThrow();
  });

  it("quando o acesso ao localStorage lança, retorna false sem exceção", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });

    expect(readNavPinned()).toBe(false);
    expect(() => writeNavPinned(true)).not.toThrow();
  });
});
