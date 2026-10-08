import { describe, expect, it } from "vitest";
import { NAV_ICONS } from "@/components/NavIcons";
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

  it("define um ícone para cada rota, sem repetições", () => {
    const icons = NAV_ITEMS.map((item) => item.icon);
    expect(icons).toEqual([
      "dashboard",
      "entradas",
      "saidas",
      "gastos",
      "cartoes",
      "historico",
      "configuracoes",
    ]);
    expect(new Set(icons).size).toBe(NAV_ITEMS.length);
  });

  it("inclui a rota de configurações", () => {
    expect(NAV_ITEMS).toContainEqual({
      href: "/configuracoes",
      label: "Configurações",
      icon: "configuracoes",
    });
    expect(isActivePath("/configuracoes", "/configuracoes")).toBe(true);
  });

  it("todos os icones de NAV_ITEMS existem no mapa de SVGs", () => {
    expect(NAV_ITEMS).toHaveLength(7);
    for (const item of NAV_ITEMS) {
      expect(Object.keys(NAV_ICONS)).toContain(item.icon);
      expect(NAV_ICONS[item.icon]).toBeDefined();
    }
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
