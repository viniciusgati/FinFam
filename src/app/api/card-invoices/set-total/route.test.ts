import { beforeEach, describe, expect, it, vi } from "vitest";

const { cardPurchaseMock, creditCardMock } = vi.hoisted(() => ({
  cardPurchaseMock: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  creditCardMock: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { cardPurchase: cardPurchaseMock, creditCard: creditCardMock },
}));

import { POST } from "./route";
import { formatCents } from "@/lib/money";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/card-invoices/set-total", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const card = { id: "card-1", name: "Nubank", closingDay: 20, dueDay: 5 };

// Compra à vista em 10/02 com fechamento 20 e vencimento 5 → compete em 2026-03.
const existingPurchase = {
  id: "p1",
  cardId: "card-1",
  description: "Mercado",
  amountCents: 50000,
  purchaseDate: new Date("2026-02-10T12:00:00Z"),
  category: null,
  installmentNumber: 1,
  installmentsTotal: 1,
  card,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/card-invoices/set-total", () => {
  it("cria o ajuste de fatura à vista quando o alvo é maior (201)", async () => {
    creditCardMock.findUnique.mockResolvedValue(card);
    cardPurchaseMock.findMany.mockResolvedValue([existingPurchase]);
    cardPurchaseMock.create.mockResolvedValue({
      id: "p2",
      cardId: "card-1",
      description: "Ajuste de fatura",
      amountCents: 25000,
      purchaseDate: new Date("2026-02-01T03:00:00Z"),
      category: "Ajuste",
      installmentNumber: 1,
      installmentsTotal: 1,
      card,
    });

    const response = await POST(
      jsonRequest({ cardId: "card-1", monthKey: "2026-03", totalCents: 75000 }),
    );

    expect(response.status).toBe(201);
    expect(cardPurchaseMock.create).toHaveBeenCalledWith({
      data: {
        cardId: "card-1",
        description: "Ajuste de fatura",
        amountCents: 25000,
        purchaseDate: expect.any(Date),
        category: "Ajuste",
        installmentNumber: 1,
        installmentsTotal: 1,
      },
      include: { card: true },
    });
    const body = await response.json();
    expect(body.description).toBe("Ajuste de fatura");
    expect(body.amountCents).toBe(25000);
  });

  it("retorna 400 com a mensagem de erro quando o alvo é menor e não cria nada", async () => {
    creditCardMock.findUnique.mockResolvedValue(card);
    cardPurchaseMock.findMany.mockResolvedValue([existingPurchase]);

    const response = await POST(
      jsonRequest({ cardId: "card-1", monthKey: "2026-03", totalCents: 25000 }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `O total-alvo (${formatCents(25000)}) é menor que o total já lançado (${formatCents(50000)}). Para corrigir para baixo, exclua/edite lançamentos existentes.`,
    });
    expect(cardPurchaseMock.create).not.toHaveBeenCalled();
  });

  it("retorna 200 sem criar quando o alvo é igual ao total lançado", async () => {
    creditCardMock.findUnique.mockResolvedValue(card);
    cardPurchaseMock.findMany.mockResolvedValue([existingPurchase]);

    const response = await POST(
      jsonRequest({ cardId: "card-1", monthKey: "2026-03", totalCents: 50000 }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: false, currentCents: 50000 });
    expect(cardPurchaseMock.create).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o cartão não existe e não cria nada", async () => {
    creditCardMock.findUnique.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ cardId: "inexistente", monthKey: "2026-03", totalCents: 75000 }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(cardPurchaseMock.create).not.toHaveBeenCalled();
  });

  it("retorna 400 para payload inválido (totalCents <= 0 ou monthKey inválido)", async () => {
    const response = await POST(
      jsonRequest({ cardId: "card-1", monthKey: "2026-03", totalCents: 0 }),
    );

    expect(response.status).toBe(400);
    expect(creditCardMock.findUnique).not.toHaveBeenCalled();
    expect(cardPurchaseMock.create).not.toHaveBeenCalled();

    const invalidMonth = await POST(
      jsonRequest({ cardId: "card-1", monthKey: "2026-13", totalCents: 75000 }),
    );
    expect(invalidMonth.status).toBe(400);
  });
});
