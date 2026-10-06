import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock, deleteMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    variableExpense: {
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
}));

import { DELETE, GET, PATCH } from "./route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/variable-expenses/abc", {
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

describe("GET /api/variable-expenses/:id", () => {
  it("retorna 200 com o registro existente", async () => {
    findUniqueMock.mockResolvedValue({ id: "abc" });

    const response = await GET(
      new Request("http://localhost/api/variable-expenses/abc"),
      params("abc"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "abc" });
  });

  it("retorna 404 quando o id não existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/variable-expenses/x"),
      params("x"),
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/variable-expenses/:id", () => {
  it("atualiza somente os campos enviados", async () => {
    findUniqueMock.mockResolvedValue({ id: "abc", paid: false });
    updateMock.mockResolvedValue({ id: "abc", paid: true });

    const response = await PATCH(
      jsonRequest("PATCH", { paid: true }),
      params("abc"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "abc", paid: true });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { paid: true },
    });
  });

  it("retorna 400 para payload inválido e não atualiza", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", { amountCents: -1 }),
      params("abc"),
    );

    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o id não existe", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("PATCH", { paid: true }),
      params("x"),
    );

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/variable-expenses/:id", () => {
  it("remove e retorna 204 sem corpo", async () => {
    findUniqueMock.mockResolvedValue({ id: "abc" });
    deleteMock.mockResolvedValue({ id: "abc" });

    const response = await DELETE(
      new Request("http://localhost/api/variable-expenses/abc", {
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
      new Request("http://localhost/api/variable-expenses/x", {
        method: "DELETE",
      }),
      params("x"),
    );

    expect(response.status).toBe(404);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
