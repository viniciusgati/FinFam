import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  variableGroupByMock,
  fixedGroupByMock,
  cardGroupByMock,
  findManyMock,
} = vi.hoisted(() => ({
  variableGroupByMock: vi.fn(),
  fixedGroupByMock: vi.fn(),
  cardGroupByMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    variableExpense: { groupBy: variableGroupByMock, findMany: findManyMock },
    fixedExpense: { groupBy: fixedGroupByMock, findMany: findManyMock },
    cardPurchase: { groupBy: cardGroupByMock, findMany: findManyMock },
  },
}));

import { loadCategorySuggestions } from "./category-suggestions";

beforeEach(() => {
  variableGroupByMock.mockReset();
  fixedGroupByMock.mockReset();
  cardGroupByMock.mockReset();
  findManyMock.mockReset();
  variableGroupByMock.mockResolvedValue([]);
  fixedGroupByMock.mockResolvedValue([]);
  cardGroupByMock.mockResolvedValue([]);
});

describe("loadCategorySuggestions — agregação no banco", () => {
  it("usa groupBy por category nas três tabelas e não materializa linhas", async () => {
    await loadCategorySuggestions();

    const expectedArgs = {
      by: ["category"],
      where: { category: { not: null } },
    };
    expect(variableGroupByMock).toHaveBeenCalledWith(expectedArgs);
    expect(fixedGroupByMock).toHaveBeenCalledWith(expectedArgs);
    expect(cardGroupByMock).toHaveBeenCalledWith(expectedArgs);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("devolve no máximo 21 sugestões deduplicadas com 7 categorias por tabela", async () => {
    const categoriesFor = (prefix: string) =>
      Array.from({ length: 7 }, (_, index) => ({
        category: `${prefix} ${index}`,
      }));

    variableGroupByMock.mockResolvedValue(categoriesFor("Variável"));
    fixedGroupByMock.mockResolvedValue(categoriesFor("Fixa"));
    cardGroupByMock.mockResolvedValue(categoriesFor("Cartão"));

    const suggestions = await loadCategorySuggestions();

    expect(suggestions).toHaveLength(21);
    expect(new Set(suggestions).size).toBe(21);
  });
});

describe("loadCategorySuggestions — fallback", () => {
  it("devolve [] quando a leitura falha, sem derrubar o dashboard", async () => {
    variableGroupByMock.mockRejectedValue(new Error("banco indisponível"));

    await expect(loadCategorySuggestions()).resolves.toEqual([]);
  });
});
