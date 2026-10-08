import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock, deleteMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    variableIncome: {
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
}));

import { DELETE, GET, PATCH } from "./route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/variable-incomes/abc", {
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

describe("GET /api/variable-incomes/:id", () => {
  it("retorna 200 com o registro existente", async () => {
    findUniqueMock.mockResolvedValue({ id: "abc" });

    const response = await GET(
      new Request("http://localhost/api/variable-incomes/abc"),
      params("abc"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "abc" });
  });

  it("retorna 404 quando o id não existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/variable-incomes/x"),
      params("x"),
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/variable-incomes/:id", () => {
  it("atualiza somente os campos enviados", async () => {
    findUniqueMock.mockResolvedValue({ id: "abc", amountCents: 1000 });
    updateMock.mockResolvedValue({ id: "abc", amountCents: 4200 });

    const response = await PATCH(
      jsonRequest("PATCH", { amountCents: 4200 }),
      params("abc"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "abc", amountCents: 4200 });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { amountCents: 4200 },
    });
  });

  it("retorna 400 para payload inválido e não atualiza", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", { amountCents: 0 }),
      params("abc"),
    );

    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("retorna 400 para corpo vazio e não atualiza", async () => {
    const response = await PATCH(jsonRequest("PATCH", {}), params("abc"));

    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o id não existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("PATCH", { amountCents: 4200 }),
      params("x"),
    );

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/variable-incomes/:id", () => {
  it("remove e retorna 204 sem corpo", async () => {
    findUniqueMock.mockResolvedValue({ id: "abc" });
    deleteMock.mockResolvedValue({ id: "abc" });

    const response = await DELETE(
      new Request("http://localhost/api/variable-incomes/abc", {
        method: "DELETE",
      }),
      params("abc"),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "abc" } });
  });

  it("retorna 404 quando o id não existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/variable-incomes/x", {
        method: "DELETE",
      }),
      params("x"),
    );

    expect(response.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
