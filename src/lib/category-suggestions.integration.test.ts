import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { loadCategorySuggestions } from "./category-suggestions";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

describe("loadCategorySuggestions — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("combina as três tabelas, deduplica por caixa/espaço e ordena pt-BR", async () => {
    const card = await prisma.creditCard.create({
      data: { name: "Nubank", closingDay: 20, dueDay: 5 },
    });

    await prisma.variableExpense.createMany({
      data: [
        {
          description: "Mercado",
          amountCents: 1000,
          date: new Date(2026, 9, 5),
          paymentMethod: "PIX",
          category: "Mercado",
        },
        {
          description: "Feira",
          amountCents: 500,
          date: new Date(2026, 9, 6),
          paymentMethod: "PIX",
          category: "  mercado  ",
        },
        {
          description: "Sem categoria",
          amountCents: 200,
          date: new Date(2026, 9, 7),
          paymentMethod: "PIX",
          category: null,
        },
      ],
    });

    await prisma.fixedExpense.createMany({
      data: [
        { name: "Aluguel", amountCents: 100000, category: "Moradia" },
        { name: "Luz", amountCents: 5000, category: "Alimentação" },
        { name: "Água", amountCents: 3000, category: null },
      ],
    });

    await prisma.cardPurchase.createMany({
      data: [
        {
          cardId: card.id,
          description: "Streaming",
          amountCents: 3000,
          purchaseDate: new Date(2026, 9, 8),
          installmentsTotal: 1,
          category: "alimentação ",
        },
      ],
    });

    const suggestions = await loadCategorySuggestions();

    expect(suggestions).toEqual(["Alimentação", "Mercado", "Moradia"]);
  });

  it("devolve [] quando não há categorias cadastradas", async () => {
    await expect(loadCategorySuggestions()).resolves.toEqual([]);
  });

  it("com volume grande e 7 categorias por tabela devolve no máximo 21 sugestões", async () => {
    const card = await prisma.creditCard.create({
      data: { name: "Nubank", closingDay: 20, dueDay: 5 },
    });

    const categoriesFor = (prefix: string) =>
      Array.from({ length: 7 }, (_, index) => `${prefix} ${index}`);

    const variableCategories = categoriesFor("Variável");
    const fixedCategories = categoriesFor("Fixa");
    const cardCategories = categoriesFor("Cartão");

    await prisma.variableExpense.createMany({
      data: Array.from({ length: 10_000 }, (_, index) => ({
        description: `Lançamento ${index}`,
        amountCents: 100,
        date: new Date(2026, 9, (index % 28) + 1),
        category: variableCategories[index % variableCategories.length],
      })),
    });

    await prisma.fixedExpense.createMany({
      data: Array.from({ length: 10_000 }, (_, index) => ({
        name: `Fixa ${index}`,
        amountCents: 100,
        category: fixedCategories[index % fixedCategories.length],
      })),
    });

    await prisma.cardPurchase.createMany({
      data: Array.from({ length: 10_000 }, (_, index) => ({
        cardId: card.id,
        description: `Compra ${index}`,
        amountCents: 100,
        purchaseDate: new Date(2026, 9, (index % 28) + 1),
        installmentsTotal: 1,
        category: cardCategories[index % cardCategories.length],
      })),
    });

    const suggestions = await loadCategorySuggestions();

    expect(suggestions.length).toBeLessThanOrEqual(21);
    expect(suggestions).toHaveLength(21);
    expect(new Set(suggestions).size).toBe(21);
  }, 60_000);
});
