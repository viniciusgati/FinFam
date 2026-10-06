import { beforeEach, describe, expect, it, vi } from "vitest";

const { cardPurchaseMock, creditCardMock } = vi.hoisted(() => ({
  cardPurchaseMock: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  creditCardMock: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { cardPurchase: cardPurchaseMock, creditCard: creditCardMock },
}));

import { GET, POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

function jsonRequest(
  method: string,
  body: unknown,
  url = "http://localhost/api/card-purchases",
) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

const validPurchase = {
  cardId: "card-1",
  description: "Notebook",
  amountCents: 300000,
  purchaseDate: "2026-11-15",
  installmentNumber: 1,
  installmentsTotal: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/card-purchases", () => {
  it("lista todas as compras por data quando não há mês", async () => {
    cardPurchaseMock.findMany.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/card-purchases"),
    );

    expect(response.status).toBe(200);
    expect(cardPurchaseMock.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: [{ purchaseDate: "asc" }, { id: "asc" }],
      include: { card: true },
    });
  });

  it("filtra pelo mês informado em ?mes", async () => {
    cardPurchaseMock.findMany.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/card-purchases?mes=2027-01"));

    expect(cardPurchaseMock.findMany).toHaveBeenCalledWith({
      where: {
        purchaseDate: {
          gte: new Date(2027, 0, 1),
          lt: new Date(2027, 1, 1),
        },
      },
      orderBy: [{ purchaseDate: "asc" }, { id: "asc" }],
      include: { card: true },
    });
  });
});

describe("POST /api/card-purchases", () => {
  it("cria compra válida retornando 201", async () => {
    creditCardMock.findUnique.mockResolvedValue({ id: "card-1" });
    cardPurchaseMock.create.mockResolvedValue({
      id: "p1",
      ...validPurchase,
    });

    const response = await POST(jsonRequest("POST", validPurchase));

    expect(response.status).toBe(201);
    expect(creditCardMock.findUnique).toHaveBeenCalledWith({
      where: { id: "card-1" },
    });
    expect(cardPurchaseMock.create).toHaveBeenCalledWith({
      data: {
        cardId: "card-1",
        description: "Notebook",
        amountCents: 300000,
        purchaseDate: new Date("2026-11-15"),
        installmentNumber: 1,
        installmentsTotal: 3,
      },
      include: { card: true },
    });
  });

  it("retorna 400 quando o cardId não existe e não persiste", async () => {
    creditCardMock.findUnique.mockResolvedValue(null);

    const response = await POST(jsonRequest("POST", validPurchase));

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(cardPurchaseMock.create).not.toHaveBeenCalled();
  });

  it("retorna 400 quando a parcela excede o total e não persiste", async () => {
    const response = await POST(
      jsonRequest("POST", {
        ...validPurchase,
        installmentNumber: 4,
        installmentsTotal: 3,
      }),
    );

    expect(response.status).toBe(400);
    expect(creditCardMock.findUnique).not.toHaveBeenCalled();
    expect(cardPurchaseMock.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/card-purchases/:id", () => {
  it("edita parcialmente e retorna 200", async () => {
    cardPurchaseMock.findUnique.mockResolvedValue({
      id: "p1",
      installmentNumber: 1,
      installmentsTotal: 3,
    });
    cardPurchaseMock.update.mockResolvedValue({ id: "p1", description: "Mouse" });

    const response = await PATCH(
      jsonRequest("PATCH", { description: "Mouse" }),
      context("p1"),
    );

    expect(response.status).toBe(200);
    expect(cardPurchaseMock.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { description: "Mouse" },
      include: { card: true },
    });
  });

  it("retorna 404 quando o id não existe", async () => {
    cardPurchaseMock.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("PATCH", { description: "Mouse" }),
      context("inexistente"),
    );

    expect(response.status).toBe(404);
    expect(cardPurchaseMock.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/card-purchases/:id", () => {
  it("retorna 204 e remove", async () => {
    cardPurchaseMock.findUnique.mockResolvedValue({ id: "p1" });
    cardPurchaseMock.delete.mockResolvedValue({ id: "p1" });

    const response = await DELETE(
      new Request("http://localhost/api/card-purchases/p1"),
      context("p1"),
    );

    expect(response.status).toBe(204);
    expect(cardPurchaseMock.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("retorna 404 quando o id não existe", async () => {
    cardPurchaseMock.findUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/card-purchases/inexistente"),
      context("inexistente"),
    );

    expect(response.status).toBe(404);
    expect(cardPurchaseMock.delete).not.toHaveBeenCalled();
  });
});
