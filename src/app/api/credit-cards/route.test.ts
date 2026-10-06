import { beforeEach, describe, expect, it, vi } from "vitest";

const { creditCardMock, cardPurchaseMock } = vi.hoisted(() => ({
  creditCardMock: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  cardPurchaseMock: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { creditCard: creditCardMock, cardPurchase: cardPurchaseMock },
}));

import { GET, POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

function jsonRequest(
  method: string,
  body: unknown,
  url = "http://localhost/api/credit-cards",
) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/credit-cards", () => {
  it("lista todos os cartões, inclusive inativos, por nome", async () => {
    const cards = [
      { id: "1", name: "Nubank", closingDay: 20, dueDay: 5, active: true },
      { id: "2", name: "Inter", closingDay: 10, dueDay: 15, active: false },
    ];
    creditCardMock.findMany.mockResolvedValue(cards);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cards);
    expect(creditCardMock.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });
});

describe("POST /api/credit-cards", () => {
  it("cria cartão válido com active=true por padrão", async () => {
    const created = {
      id: "1",
      name: "Nubank",
      limitCents: null,
      closingDay: 20,
      dueDay: 5,
      active: true,
    };
    creditCardMock.create.mockResolvedValue(created);

    const response = await POST(
      jsonRequest("POST", { name: "Nubank", closingDay: 20, dueDay: 5 }),
    );

    expect(response.status).toBe(201);
    expect(creditCardMock.create).toHaveBeenCalledWith({
      data: {
        name: "Nubank",
        closingDay: 20,
        dueDay: 5,
        active: true,
      },
    });
  });

  it("rejeita closingDay fora de 1–31 sem persistir", async () => {
    const response = await POST(
      jsonRequest("POST", { name: "Nubank", closingDay: 32, dueDay: 5 }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(creditCardMock.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/credit-cards/:id", () => {
  it("atualiza parcialmente e retorna 200", async () => {
    creditCardMock.findUnique.mockResolvedValue({ id: "1", active: true });
    creditCardMock.update.mockResolvedValue({ id: "1", active: false });

    const response = await PATCH(
      jsonRequest("PATCH", { active: false }),
      context("1"),
    );

    expect(response.status).toBe(200);
    expect(creditCardMock.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { active: false },
    });
  });

  it("retorna 404 quando o id não existe", async () => {
    creditCardMock.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("PATCH", { active: false }),
      context("inexistente"),
    );

    expect(response.status).toBe(404);
    expect(creditCardMock.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/credit-cards/:id", () => {
  it("retorna 204 e remove quando não há compras", async () => {
    creditCardMock.findUnique.mockResolvedValue({ id: "1" });
    cardPurchaseMock.count.mockResolvedValue(0);
    creditCardMock.delete.mockResolvedValue({ id: "1" });

    const response = await DELETE(
      new Request("http://localhost/api/credit-cards/1"),
      context("1"),
    );

    expect(response.status).toBe(204);
    expect(creditCardMock.delete).toHaveBeenCalledWith({ where: { id: "1" } });
  });

  it("retorna 409 e não apaga quando há compras", async () => {
    creditCardMock.findUnique.mockResolvedValue({ id: "1" });
    cardPurchaseMock.count.mockResolvedValue(2);

    const response = await DELETE(
      new Request("http://localhost/api/credit-cards/1"),
      context("1"),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toHaveProperty("error");
    expect(creditCardMock.delete).not.toHaveBeenCalled();
  });
});
