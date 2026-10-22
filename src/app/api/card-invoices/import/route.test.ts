import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, txCardPurchaseMock, classifyInvoiceTitlesMock } =
  vi.hoisted(() => {
    const txCardPurchase = { deleteMany: vi.fn(), createMany: vi.fn() };
    const prisma = {
      creditCard: { findUnique: vi.fn() },
      cardPurchase: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      variableExpense: { findMany: vi.fn() },
      fixedExpense: { findMany: vi.fn() },
      $transaction: vi.fn(
        async (
          fn: (tx: { cardPurchase: typeof txCardPurchase }) => Promise<unknown>,
        ) => fn({ cardPurchase: txCardPurchase }),
      ),
    };
    return {
      prismaMock: prisma,
      txCardPurchaseMock: txCardPurchase,
      classifyInvoiceTitlesMock: vi.fn(),
    };
  });

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/invoice-category", () => ({
  classifyInvoiceTitles: classifyInvoiceTitlesMock,
}));

import { POST } from "./route";
import { IMPORT_FAILURE_MESSAGE } from "@/lib/invoice-import";
import { resolveTimeZone, zonedDateParts } from "@/lib/time";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/card-invoices/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(text: string): Request {
  return new Request("http://localhost/api/card-invoices/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: text,
  });
}

const card = {
  id: "card-1",
  name: "Nubank",
  limitCents: null,
  closingDay: 13,
  dueDay: 20,
  active: true,
};

// Compras do cartão: uma à vista na competência alvo (2026-09), uma parcelada
// na mesma competência (nunca apagada) e uma à vista de outra competência.
const existingRows = [
  {
    id: "ajuste",
    cardId: "card-1",
    description: "Ajuste de fatura",
    amountCents: 99900,
    purchaseDate: new Date(Date.UTC(2026, 8, 5, 12)),
    category: "Ajuste",
    installmentNumber: 1,
    installmentsTotal: 1,
  },
  {
    id: "parcelada",
    cardId: "card-1",
    description: "Loja Nova",
    amountCents: 80000,
    purchaseDate: new Date(Date.UTC(2026, 8, 1, 12)),
    category: null,
    installmentNumber: 1,
    installmentsTotal: 8,
  },
  {
    id: "outra",
    cardId: "card-1",
    description: "Mercado antigo",
    amountCents: 5000,
    purchaseDate: new Date(Date.UTC(2026, 6, 10, 12)),
    category: null,
    installmentNumber: 1,
    installmentsTotal: 1,
  },
];

const familyHistory = [
  { description: "Netflix.Com", category: "Streaming" },
  { description: "Padaria Central", category: "Mercado" },
];

/**
 * CSV de exemplo da história #269: linhas de 13/08/2026 a 10/09/2026 para
 * cartão de fechamento dia 13 e vencimento dia 20 — competência 2026-09,
 * 9 positivas, 1 negativa (total das positivas = 93485 centavos).
 */
const EXAMPLE_CSV = [
  "date,title,amount",
  "2026-08-13,Padaria Central,12,34",
  "2026-08-14,Netflix.Com,45,90",
  "2026-08-16,Posto Avenida,150,00",
  "2026-08-21,Supermercado Bom Preço,238,76",
  "2026-08-29,UBER TRIP,23,45",
  "2026-09-02,Farmácia Vida,87,90",
  "2026-09-04,Netflix.Com,45,90",
  "2026-09-07,Padaria Central,18,50",
  "2026-09-10,Loja de Roupas,312,10",
  "2026-09-05,Pagamento recebido,- 500,00",
].join("\n");

interface CreateRow {
  cardId: string;
  description: string;
  amountCents: number;
  purchaseDate: Date;
  category: string | null;
  installmentNumber: number;
  installmentsTotal: number;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.creditCard.findUnique.mockResolvedValue(card);
  prismaMock.cardPurchase.findMany.mockImplementation(
    (args: { where?: { category?: unknown; cardId?: string } }) =>
      Promise.resolve(args.where?.category ? familyHistory : existingRows),
  );
  prismaMock.variableExpense.findMany.mockResolvedValue([]);
  prismaMock.fixedExpense.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: { cardPurchase: typeof txCardPurchaseMock }) => unknown) =>
      fn({ cardPurchase: txCardPurchaseMock }),
  );
  txCardPurchaseMock.deleteMany.mockImplementation(
    (args: { where: { id: { in: string[] } } }) =>
      Promise.resolve({ count: args.where.id.in.length }),
  );
  txCardPurchaseMock.createMany.mockImplementation(
    (args: { data: unknown[] }) => Promise.resolve({ count: args.data.length }),
  );
  classifyInvoiceTitlesMock.mockImplementation(
    async (titles: string[]) => titles.map(() => null),
  );
});

describe("POST /api/card-invoices/import — dryRun", () => {
  it("responde 200 com competência, contagens e total sem nenhuma escrita", async () => {
    const response = await POST(
      jsonRequest({ cardId: "card-1", csv: EXAMPLE_CSV, dryRun: true }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      monthKey: "2026-09",
      toImport: 9,
      toRemove: 1,
      toMatch: 0,
      ignored: 1,
      totalCents: 93485,
    });

    // Nenhuma escrita: transação e mutações nunca acontecem no preview.
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.cardPurchase.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.cardPurchase.createMany).not.toHaveBeenCalled();
    // DeepSeek só na confirmação (não no preview).
    expect(classifyInvoiceTitlesMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/card-invoices/import — confirmação", () => {
  it("substitui a competência numa transação e devolve o resumo final", async () => {
    classifyInvoiceTitlesMock.mockResolvedValue([
      "Mercado",
      "Streaming",
      "Transporte",
      null,
      null,
      null,
      null,
      null,
      null,
    ]);

    const response = await POST(jsonRequest({ cardId: "card-1", csv: EXAMPLE_CSV }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      monthKey: "2026-09",
      imported: 9,
      removed: 1,
      matched: 0,
      ignored: 1,
    });

    // Exclusão + inserção existem apenas dentro da transação (atomicidade).
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.cardPurchase.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.cardPurchase.createMany).not.toHaveBeenCalled();
    expect(txCardPurchaseMock.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["ajuste"] } },
    });
    expect(txCardPurchaseMock.createMany).toHaveBeenCalledTimes(1);

    const createArgs = txCardPurchaseMock.createMany.mock.calls[0][0] as {
      data: CreateRow[];
    };
    expect(createArgs.data).toHaveLength(9);
    expect(createArgs.data[0]).toMatchObject({
      cardId: "card-1",
      description: "Padaria Central",
      amountCents: 1234,
      purchaseDate: expect.any(Date),
      category: "Mercado",
      installmentNumber: 1,
      installmentsTotal: 1,
    });
    // Linha discordante de 13/08 ajustada para 14/08 (janela do ciclo 2026-09).
    expect(
      zonedDateParts(createArgs.data[0].purchaseDate, resolveTimeZone()),
    ).toEqual({ year: 2026, month: 8, day: 14 });
    expect(createArgs.data[1].category).toBe("Streaming");
    expect(createArgs.data[3].category).toBeNull();

    // Uma única chamada de classificação com títulos + histórico da família.
    expect(classifyInvoiceTitlesMock).toHaveBeenCalledTimes(1);
    const [titles, suggestions, existingByTitle] =
      classifyInvoiceTitlesMock.mock.calls[0] as [
        string[],
        string[],
        Map<string, string | null>,
      ];
    expect(titles).toHaveLength(9);
    expect(titles[0]).toBe("Padaria Central");
    expect(suggestions).toContain("Streaming");
    expect(existingByTitle.get("Netflix.Com")).toBe("Streaming");
  });

  it("mantém parceladas e casa `… - Parcela 2/8` sem reinserir a linha", async () => {
    const csv = [
      "date,title,amount",
      "2026-09-05,Loja Nova - Parcela 2/8,100,00",
      "2026-09-06,Padaria Central,10,00",
    ].join("\n");

    const response = await POST(jsonRequest({ cardId: "card-1", csv }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      monthKey: "2026-09",
      imported: 1,
      removed: 1,
      matched: 1,
      ignored: 0,
    });

    // Só a à vista da competência alvo é apagada; parcelada e outra
    // competência permanecem.
    expect(txCardPurchaseMock.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["ajuste"] } },
    });
    const createArgs = txCardPurchaseMock.createMany.mock.calls[0][0] as {
      data: CreateRow[];
    };
    expect(createArgs.data).toHaveLength(1);
    expect(createArgs.data[0].description).toBe("Padaria Central");
  });

  it("falha na classificação não bloqueia a importação (categorias vazias)", async () => {
    classifyInvoiceTitlesMock.mockRejectedValue(new Error("IA fora do ar"));

    const response = await POST(jsonRequest({ cardId: "card-1", csv: EXAMPLE_CSV }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { imported: number };
    expect(body.imported).toBe(9);

    const createArgs = txCardPurchaseMock.createMany.mock.calls[0][0] as {
      data: CreateRow[];
    };
    expect(createArgs.data.every((row) => row.category === null)).toBe(true);
  });

  it("falha na gravação responde 500 e mantém as escritas contidas na transação", async () => {
    txCardPurchaseMock.createMany.mockRejectedValue(new Error("db down"));

    const response = await POST(jsonRequest({ cardId: "card-1", csv: EXAMPLE_CSV }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: IMPORT_FAILURE_MESSAGE });

    // As mutações só existem dentro de $transaction (o Prisma reverte a
    // transação inteira na rejeição): nenhuma escrita fora dela.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.cardPurchase.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.cardPurchase.createMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/card-invoices/import — erros (400)", () => {
  it("cartão inexistente responde 400 sem persistir nada", async () => {
    prismaMock.creditCard.findUnique.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ cardId: "inexistente", csv: EXAMPLE_CSV }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Cartão não encontrado" });
    expect(prismaMock.cardPurchase.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("CSV só com negativas/inválidas responde 400 sem persistir nada", async () => {
    const csv = [
      "date,title,amount",
      "2026-09-05,Pagamento recebido,- 500,00",
      "2026-09-06,Linha quebrada,abc",
    ].join("\n");

    const response = await POST(jsonRequest({ cardId: "card-1", csv }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "O CSV não tem nenhuma linha válida para importar.",
    });
    expect(prismaMock.creditCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("cabeçalho divergente responde 400 com o erro em pt-BR", async () => {
    const response = await POST(
      jsonRequest({
        cardId: "card-1",
        csv: "data,descricao,valor\n2026-09-01,X,10,00",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Cabeçalho inválido: era esperado "date,title,amount".',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("corpo malformado (JSON inválido) responde 400 em pt-BR", async () => {
    const response = await POST(rawRequest("isso não é json"));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Corpo da requisição inválido");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("corpo sem csv responde 400 em pt-BR", async () => {
    const response = await POST(jsonRequest({ cardId: "card-1" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Cole o conteúdo do CSV da fatura");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
