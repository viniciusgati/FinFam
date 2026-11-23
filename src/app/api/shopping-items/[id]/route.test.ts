import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock, deleteMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    shoppingItem: {
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
}));

import { DELETE, PATCH } from "./route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    name: "Arroz",
    kind: "ESSENCIAL",
    category: "Mercearia",
    quantity: 2,
    estimatedUnitPriceCents: 1000,
    priceSource: null,
    priceSampleCount: 0,
    priceFetchedAt: null,
    purchased: false,
    purchasedAt: null,
    addedOn: "2026-11-01",
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-01T12:00:00.000Z"),
    ...overrides,
  };
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/shopping-items/item-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PATCH /api/shopping-items/:id", () => {
  it("atualiza só os campos enviados e nunca addedOn", async () => {
    findUniqueMock.mockResolvedValue(row());
    updateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row(data)),
    );

    const response = await PATCH(
      jsonRequest("PATCH", { quantity: 5, addedOn: "2020-01-01" }),
      params("item-1"),
    );

    expect(response.status).toBe(200);
    const [args] = updateMock.mock.calls[0];
    expect(args).toEqual({ where: { id: "item-1" }, data: { quantity: 5 } });
    expect(args.data).not.toHaveProperty("addedOn");
    expect(args.data).not.toHaveProperty("name");
    expect(args.data).not.toHaveProperty("category");
  });

  it("marcar como comprado preenche purchasedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T15:00:00.000Z"));
    findUniqueMock.mockResolvedValue(row());
    updateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row(data)),
    );

    const response = await PATCH(
      jsonRequest("PATCH", { purchased: true }),
      params("item-1"),
    );

    expect(response.status).toBe(200);
    const [args] = updateMock.mock.calls[0];
    expect(args.data.purchased).toBe(true);
    expect(args.data.purchasedAt).toEqual(new Date("2026-11-23T15:00:00.000Z"));
    expect(args.data).not.toHaveProperty("addedOn");
  });

  it("retorna 400 sem atualizar quando o payload é inválido", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", { kind: "OUTRO" }),
      params("item-1"),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.fieldErrors.kind).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o id não existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("PATCH", { quantity: 3 }),
      params("ausente"),
    );

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/shopping-items/:id", () => {
  it("remove o item e retorna 204", async () => {
    findUniqueMock.mockResolvedValue(row());
    deleteMock.mockResolvedValue(row());

    const response = await DELETE(
      new Request("http://localhost/api/shopping-items/item-1", {
        method: "DELETE",
      }),
      params("item-1"),
    );

    expect(response.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "item-1" } });
  });

  it("retorna 404 quando o id não existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/shopping-items/ausente", {
        method: "DELETE",
      }),
      params("ausente"),
    );

    expect(response.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
