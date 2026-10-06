import { beforeEach, describe, expect, it, vi } from "vitest";

const { fixedExpenseMock } = vi.hoisted(() => ({
  fixedExpenseMock: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: { fixedExpense: fixedExpenseMock },
}));

import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";

function jsonRequest(
  method: string,
  body: unknown,
  url = "http://localhost/api/fixed-expenses",
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

describe("GET /api/fixed-expenses", () => {
  it("lista saídas (inclusive inativas) ordenadas por nome", async () => {
    const items = [
      { id: "1", name: "Aluguel", amountCents: 250000, dueDay: 10, category: "Moradia" },
      { id: "2", name: "Internet", amountCents: 12000, dueDay: 20, active: false },
    ];
    fixedExpenseMock.findMany.mockResolvedValue(items);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(items);
    expect(fixedExpenseMock.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });
});

describe("POST /api/fixed-expenses", () => {
  it("cria persistindo dueDay e categoria", async () => {
    const created = {
      id: "1",
      name: "Aluguel",
      amountCents: 250000,
      dueDay: 10,
      category: "Moradia",
      active: true,
    };
    fixedExpenseMock.create.mockResolvedValue(created);

    const response = await POST(
      jsonRequest("POST", {
        name: "Aluguel",
        amountCents: 250000,
        dueDay: 10,
        category: "Moradia",
      }),
    );

    expect(response.status).toBe(201);
    expect(fixedExpenseMock.create).toHaveBeenCalledWith({
      data: {
        name: "Aluguel",
        amountCents: 250000,
        dueDay: 10,
        category: "Moradia",
        active: true,
      },
    });
  });

  it("rejeita dueDay fora de 1–31 sem persistir", async () => {
    const response = await POST(
      jsonRequest("POST", { name: "Aluguel", amountCents: 250000, dueDay: 32 }),
    );

    expect(response.status).toBe(400);
    expect(fixedExpenseMock.create).not.toHaveBeenCalled();
  });

  it("rejeita categoria não-string sem persistir", async () => {
    const response = await POST(
      jsonRequest("POST", {
        name: "Aluguel",
        amountCents: 250000,
        dueDay: 10,
        category: 42,
      }),
    );

    expect(response.status).toBe(400);
    expect(fixedExpenseMock.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/fixed-expenses/:id", () => {
  it("desativa apenas o campo active", async () => {
    fixedExpenseMock.findUnique.mockResolvedValue({
      id: "1",
      startMonth: null,
      endMonth: null,
      active: true,
    });
    fixedExpenseMock.update.mockResolvedValue({ id: "1", active: false });

    const response = await PATCH(
      jsonRequest("PATCH", { active: false }),
      context("1"),
    );

    expect(response.status).toBe(200);
    expect(fixedExpenseMock.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { active: false },
    });
  });

  it("edita campos parcialmente", async () => {
    fixedExpenseMock.findUnique.mockResolvedValue({
      id: "1",
      startMonth: null,
      endMonth: null,
      active: true,
    });
    fixedExpenseMock.update.mockResolvedValue({ id: "1", name: "Água" });

    const response = await PATCH(
      jsonRequest("PATCH", { name: "Água" }),
      context("1"),
    );

    expect(response.status).toBe(200);
    expect(fixedExpenseMock.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { name: "Água" },
    });
  });

  it("retorna 404 quando o id não existe", async () => {
    fixedExpenseMock.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      jsonRequest("PATCH", { active: false }),
      context("inexistente"),
    );

    expect(response.status).toBe(404);
    expect(fixedExpenseMock.update).not.toHaveBeenCalled();
  });
});
