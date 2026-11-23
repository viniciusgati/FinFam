import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock, createMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    shoppingItem: {
      findMany: findManyMock,
      create: createMock,
    },
  },
}));

import { GET, POST } from "./route";

const baseUrl = "http://localhost/api/shopping-items";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    name: "Arroz",
    kind: "ESSENCIAL",
    category: null,
    quantity: 1,
    estimatedUnitPriceCents: null,
    priceSource: null,
    priceSampleCount: 0,
    priceFetchedAt: null,
    purchased: false,
    purchasedAt: null,
    addedOn: "2026-11-10",
    createdAt: new Date("2026-11-10T12:00:00.000Z"),
    updatedAt: new Date("2026-11-10T12:00:00.000Z"),
    ...overrides,
  };
}

function postRequest(body: unknown): Request {
  return new Request(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  findManyMock.mockReset();
  createMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/shopping-items", () => {
  it("lista ativos já ordenados: essenciais primeiro, depois desejáveis", async () => {
    findManyMock.mockResolvedValue([
      row({ id: "desejo-novo", name: "Chocolate", kind: "DESEJAVEL", addedOn: "2026-11-15" }),
      row({ id: "essencial-novo", name: "Leite", kind: "ESSENCIAL", addedOn: "2026-11-12" }),
      row({ id: "desejo-antigo", name: "Vinho", kind: "DESEJAVEL", addedOn: "2026-11-01" }),
      row({ id: "essencial-antigo", name: "Arroz", kind: "ESSENCIAL", addedOn: "2026-11-05" }),
      row({ id: "comprado", name: "Feijão", kind: "ESSENCIAL", purchased: true }),
    ]);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.map((item: { id: string }) => item.id)).toEqual([
      "essencial-antigo",
      "essencial-novo",
      "desejo-antigo",
      "desejo-novo",
    ]);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { purchased: false },
      orderBy: [{ addedOn: "asc" }, { id: "asc" }],
    });
  });

  it("expõe preço 0 como sem preço (null)", async () => {
    findManyMock.mockResolvedValue([row({ estimatedUnitPriceCents: 0 })]);

    const response = await GET();
    const [item] = await response.json();

    expect(item.estimatedUnitPriceCents).toBeNull();
  });
});

describe("POST /api/shopping-items", () => {
  it("cria, retorna 201 com Location e grava addedOn no fuso da família", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00.000Z"));
    createMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row({ ...data, id: "novo-id" })),
    );

    const response = await POST(
      postRequest({
        name: "  Arroz  ",
        kind: "ESSENCIAL",
        quantity: 2,
        estimatedUnitPriceCents: 1000,
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe("/api/shopping-items/novo-id");
    const [args] = createMock.mock.calls[0];
    expect(args.data).toMatchObject({
      name: "Arroz",
      kind: "ESSENCIAL",
      quantity: 2,
      estimatedUnitPriceCents: 1000,
      addedOn: "2026-11-23",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({ id: "novo-id" });
  });

  it("usa quantidade default 1 quando ausente", async () => {
    createMock.mockResolvedValue(row());

    await POST(postRequest({ name: "Arroz", kind: "ESSENCIAL" }));

    const [args] = createMock.mock.calls[0];
    expect(args.data.quantity).toBe(1);
  });

  it.each([
    [{ name: "", kind: "ESSENCIAL" }, "name"],
    [{ name: "   ", kind: "ESSENCIAL" }, "name"],
    [{ name: "Arroz", kind: "OUTRO" }, "kind"],
    [{ name: "Arroz", kind: "ESSENCIAL", quantity: 0 }, "quantity"],
    [{ name: "Arroz", kind: "ESSENCIAL", quantity: 1000 }, "quantity"],
    [{ name: "Arroz", kind: "ESSENCIAL", quantity: 1.5 }, "quantity"],
    [{ name: "Arroz", kind: "ESSENCIAL", estimatedUnitPriceCents: -1 }, "estimatedUnitPriceCents"],
  ])("retorna 400 sem persistir para payload inválido: %j", async (payload, field) => {
    const response = await POST(postRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.fieldErrors[field]).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("retorna 400 sem persistir quando o corpo não é JSON válido", async () => {
    const response = await POST(
      new Request(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });
});
