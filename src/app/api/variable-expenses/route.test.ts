import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock, createMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    variableExpense: {
      findMany: findManyMock,
      create: createMock,
    },
  },
}));

import { GET, POST } from "./route";

const baseUrl = "http://localhost/api/variable-expenses";

const validPayload = {
  description: "Mercado",
  amountCents: 1234,
  date: "2026-10-15T00:00:00.000Z",
  category: "Alimentação",
  paymentMethod: "PIX",
  paid: true,
};

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

describe("GET /api/variable-expenses", () => {
  it("filtra pelo mês informado e ordena por data/createdAt desc", async () => {
    findManyMock.mockResolvedValue([{ id: "1" }]);

    const response = await GET(new Request(`${baseUrl}?mes=2026-10`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "1" }]);
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date("2026-10-01T03:00:00.000Z"),
          lt: new Date("2026-11-01T03:00:00.000Z"),
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
  });

  it("usa o mês corrente quando `mes` é ausente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    findManyMock.mockResolvedValue([]);

    const response = await GET(new Request(baseUrl));

    expect(response.status).toBe(200);
    const [args] = findManyMock.mock.calls[0];
    expect(args.where.date.gte.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(args.where.date.lt.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("retorna 400 para mês em formato inválido e não consulta o banco", async () => {
    const response = await GET(new Request(`${baseUrl}?mes=2026-13`));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/variable-expenses", () => {
  it("cria e retorna 201 com Location e o registro", async () => {
    createMock.mockResolvedValue({ id: "abc123", ...validPayload });

    const response = await POST(postRequest(validPayload));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(
      "/api/variable-expenses/abc123",
    );
    expect(json.id).toBe("abc123");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("retorna 400 sem persistir quando o payload é inválido", async () => {
    const response = await POST(
      postRequest({ ...validPayload, amountCents: -10 }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });
});
