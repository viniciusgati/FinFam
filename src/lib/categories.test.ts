import { describe, expect, it } from "vitest";
import {
  NO_CATEGORY_LABEL,
  categoryKey,
  categoryLabel,
  collectCategorySuggestions,
  normalizeCategoryLabel,
} from "./categories";

describe("normalizeCategoryLabel", () => {
  it("faz trim e colapsa espaços internos preservando a caixa", () => {
    expect(normalizeCategoryLabel("  Mercado   do  bairro ")).toBe(
      "Mercado do bairro",
    );
    expect(normalizeCategoryLabel("  mercado  ")).toBe("mercado");
  });

  it("devolve null para vazio, só espaços, null ou undefined", () => {
    expect(normalizeCategoryLabel("")).toBeNull();
    expect(normalizeCategoryLabel("   ")).toBeNull();
    expect(normalizeCategoryLabel(null)).toBeNull();
    expect(normalizeCategoryLabel(undefined)).toBeNull();
  });
});

describe("categoryKey", () => {
  it("compara ignorando caixa em pt-BR", () => {
    expect(categoryKey("Mercado")).toBe(categoryKey("  mercado  "));
    expect(categoryKey("MERCADO")).toBe(categoryKey("mercado"));
  });

  it("preserva acentos (Alimentação ≠ Alimentacao)", () => {
    expect(categoryKey("Alimentação")).not.toBe(categoryKey("Alimentacao"));
  });

  it("devolve chave vazia para vazio/ausente", () => {
    expect(categoryKey(null)).toBe("");
    expect(categoryKey(undefined)).toBe("");
    expect(categoryKey("   ")).toBe("");
  });
});

describe("categoryLabel", () => {
  it("rotula ausência como Sem categoria", () => {
    expect(categoryLabel(null)).toBe(NO_CATEGORY_LABEL);
    expect(categoryLabel("   ")).toBe(NO_CATEGORY_LABEL);
    expect(NO_CATEGORY_LABEL).toBe("Sem categoria");
  });

  it("mantém o texto informado normalizado", () => {
    expect(categoryLabel("Feira")).toBe("Feira");
    expect(categoryLabel("  Feira  ")).toBe("Feira");
  });
});

describe("collectCategorySuggestions", () => {
  it("deduplica por chave, descarta vazios, preserva o 1º rótulo e ordena pt-BR", () => {
    expect(
      collectCategorySuggestions([
        null,
        "Mercado",
        " mercado ",
        "Alimentação",
        "",
      ]),
    ).toEqual(["Alimentação", "Mercado"]);
  });

  it("devolve lista vazia quando não há categorias utilizáveis", () => {
    expect(collectCategorySuggestions([])).toEqual([]);
    expect(collectCategorySuggestions([null, undefined, "", "   "])).toEqual([]);
  });

  it("preserva o primeiro rótulo digitado para a chave", () => {
    expect(
      collectCategorySuggestions(["  mercado  ", "Mercado", "MERCADO"]),
    ).toEqual(["mercado"]);
  });
});
