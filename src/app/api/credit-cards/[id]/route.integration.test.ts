import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "@/test/integration";
import { DELETE } from "./route";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

const context = (id: string) => ({ params: Promise.resolve({ id }) });

const deleteRequest = (id: string) =>
  new Request(`http://localhost/api/credit-cards/${id}`, { method: "DELETE" });

describe("DELETE /api/credit-cards/:id — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("retorna 409 e mantém o cartão quando há compras associadas", async () => {
    const card = await prisma.creditCard.create({
      data: { name: "Nubank", closingDay: 20, dueDay: 5 },
    });
    await prisma.cardPurchase.create({
      data: {
        cardId: card.id,
        description: "Notebook",
        amountCents: 300000,
        purchaseDate: new Date(2026, 10, 15),
      },
    });

    const response = await DELETE(deleteRequest(card.id), context(card.id));

    expect(response.status).toBe(409);
    expect(await response.json()).toHaveProperty("error");
    expect(
      await prisma.creditCard.findUnique({ where: { id: card.id } }),
    ).not.toBeNull();
    expect(await prisma.cardPurchase.count({ where: { cardId: card.id } })).toBe(
      1,
    );
  });

  it("retorna 204 e remove o cartão quando não há compras", async () => {
    const card = await prisma.creditCard.create({
      data: { name: "Inter", closingDay: 10, dueDay: 15 },
    });

    const response = await DELETE(deleteRequest(card.id), context(card.id));

    expect(response.status).toBe(204);
    expect(
      await prisma.creditCard.findUnique({ where: { id: card.id } }),
    ).toBeNull();
  });
});
