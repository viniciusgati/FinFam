import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    reserveSnapshot: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/reserve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reserve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.reserveSnapshot.upsert.mockImplementation(
      async ({ create }: { create: { monthKey: string; amountCents: number } }) => ({
        monthKey: create.monthKey,
        amountCents: create.amountCents,
      }),
    );
  });

  it("faz upsert do saldo confirmado", async () => {
    const response = await POST(
      jsonRequest({
        monthKey: "2026-11",
        amountCents: 160000,
        note: "Poupança",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      monthKey: "2026-11",
      amountCents: 160000,
    });
    expect(prismaMock.reserveSnapshot.upsert).toHaveBeenCalledWith({
      where: { monthKey: "2026-11" },
      create: { monthKey: "2026-11", amountCents: 160000, note: "Poupança" },
      update: { amountCents: 160000, note: "Poupança" },
    });
  });

  it("aceita saldo zero", async () => {
    const response = await POST(
      jsonRequest({ monthKey: "2026-11", amountCents: 0 }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).amountCents).toBe(0);
  });

  it("rejeita mês inválido e saldo negativo sem tocar no banco", async () => {
    const invalidMonth = await POST(
      jsonRequest({ monthKey: "2026-13", amountCents: 1000 }),
    );
    expect(invalidMonth.status).toBe(400);
    expect(prismaMock.reserveSnapshot.upsert).not.toHaveBeenCalled();

    const negative = await POST(
      jsonRequest({ monthKey: "2026-11", amountCents: -1 }),
    );
    expect(negative.status).toBe(400);
    expect(prismaMock.reserveSnapshot.upsert).not.toHaveBeenCalled();
  });

  it("responde 500 quando o banco falha", async () => {
    prismaMock.reserveSnapshot.upsert.mockRejectedValue(new Error("db"));

    const response = await POST(
      jsonRequest({ monthKey: "2026-11", amountCents: 1000 }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Não foi possível salvar o saldo",
    });
  });
});
