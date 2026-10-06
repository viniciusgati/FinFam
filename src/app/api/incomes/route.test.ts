import { beforeEach, describe, expect, it, vi } from "vitest";

const { incomeMock } = vi.hoisted(() => ({
  incomeMock: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { income: incomeMock },
}));

import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";

function jsonRequest(method: string, body: unknown, url = "http://localhost/api/incomes") {
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

describe("GET /api/incomes", () => {
  it("lista entradas (inclusive inativas) ordenadas por nome", async () => {
    const items = [
      { id: "2", name: "Bônus", amountCents: 5000, receiveDay: 20, active: false },
      { id: "1", name: "Salário", amountCents: 100000, receiveDay: 5, active: true },
    ];
    incomeMock.findMany.mockResolvedValue(items);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(items);
    expect(incomeMock.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });

  it("responde 200 com lista vazia", async () => {
    incomeMock.findMany.mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe("POST /api/incomes", () => {
  it("cria com dados normalizados e active padrão true", async () => {
    const created = {
      id: "1",
      name: "Salário",
      amountCents: 100000,
      receiveDay: 5,
      startMonth: null,
      endMonth: null,
      active: true,
    };
    incomeMock.create.mockResolvedValue(created);

    const response = await POST(
      jsonRequest("POST", { name: "Salário", amountCents: 100000, receiveDay: 5 }),
    );

    expect(response.status).toBe(201);
    expect(incomeMock.create).toHaveBeenCalledWith({
      data: {
        name: "Salário",
        amountCents: 100000,
        receiveDay: 5,
        startMonth: undefined,
        endMonth: undefined,
        active: true,
      },
    });
    expect(await response.json()).toEqual(created);
  });

  it("rejeita payload inválido sem chamar create", async () => {
    const response = await POST(
      jsonRequest("POST", { name: "", amountCents: -1, receiveDay: 0 }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
    expect(incomeMock.create).not.toHaveBeenCalled();
  });

  it("rejeita mês invertido sem chamar create", async () => {
    const response = await POST(
      jsonRequest("POST", {
        name: "Aluguel",
        amountCents: 1000,
        receiveDay: 5,
        startMonth: "2026-05",
        endMonth: "2026-03",
      }),
    );

    expect(response.status).toBe(400);
    expect(incomeMock.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/incomes/:id", () => {
  it("desativa apenas o campo active", async () => {
    incomeMock.findUnique.mockResolvedValue({
      id: "1",
      startMonth: null,
      endMonth: null,
      active: true,
    });
    incomeMock.update.mockResolvedValue({ id: "1", active: false });

    const response = await PATCH(jsonRequest("PATCH", { active: false }), context("1"));

    expect(response.status).toBe(200);
    expect(incomeMock.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { active: false },
    });
    expect(await response.json()).toEqual({ id: "1", active: false });
  });

  it("rejeita payload inválido sem chamar update", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", { amountCents: -5 }),
      context("1"),
    );

    expect(response.status).toBe(400);
    expect(incomeMock.update).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o id não existe", async () => {
    incomeMock.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("PATCH", { active: false }),
      context("inexistente"),
    );

    expect(response.status).toBe(404);
    expect(incomeMock.update).not.toHaveBeenCalled();
  });

  it("rejeita período invertido considerando o registro existente", async () => {
    incomeMock.findUnique.mockResolvedValue({
      id: "1",
      startMonth: "2026-05",
      endMonth: null,
      active: true,
    });

    const response = await PATCH(
      jsonRequest("PATCH", { endMonth: "2026-01" }),
      context("1"),
    );

    expect(response.status).toBe(400);
    expect(incomeMock.update).not.toHaveBeenCalled();
  });
});
