import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    variableExpense: { findMany: findManyMock },
    fixedExpense: { findMany: findManyMock },
    cardPurchase: { findMany: findManyMock },
  },
}));

import { loadCategorySuggestions } from "./category-suggestions";

beforeEach(() => {
  findManyMock.mockReset();
});

describe("loadCategorySuggestions — fallback", () => {
  it("devolve [] quando a leitura falha, sem derrubar o dashboard", async () => {
    findManyMock.mockRejectedValue(new Error("banco indisponível"));

    await expect(loadCategorySuggestions()).resolves.toEqual([]);
  });
});
