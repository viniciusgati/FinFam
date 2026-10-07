import { describe, expect, it } from "vitest";
import { isActivePath, NAV_ITEMS } from "./navigation";

describe("NAV_ITEMS", () => {
  it("lista exatamente as 7 rotas na ordem esperada", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/entradas",
      "/saidas",
      "/gastos",
      "/cartoes",
      "/historico",
      "/configuracoes",
    ]);
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Dashboard",
      "Entradas",
      "Saídas",
      "Gastos",
      "Cartões",
      "Histórico",
      "Configurações",
    ]);
  });

  it("inclui a rota de configurações", () => {
    expect(NAV_ITEMS).toContainEqual({
      href: "/configuracoes",
      label: "Configurações",
    });
    expect(isActivePath("/configuracoes", "/configuracoes")).toBe(true);
  });
});

describe("isActivePath", () => {
  it("usa correspondência exata para a raiz", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/entradas", "/")).toBe(false);
  });

  it("mantém a seção ativa em subrotas", () => {
    expect(isActivePath("/entradas/123", "/entradas")).toBe(true);
    expect(isActivePath("/entradas", "/entradas")).toBe(true);
  });

  it("não ativa uma seção para outra rota", () => {
    expect(isActivePath("/entradas", "/gastos")).toBe(false);
  });

  it("não confunde prefixos parecidos", () => {
    expect(isActivePath("/entradas-arquivadas", "/entradas")).toBe(false);
  });
});
