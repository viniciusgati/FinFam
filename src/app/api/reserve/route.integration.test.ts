import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "@/test/integration";
import { POST } from "./route";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/reserve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reserve — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("persiste o saldo confirmado do mês", async () => {
    const response = await POST(
      jsonRequest({ monthKey: "2026-11", amountCents: 160000 }),
    );

    expect(response.status).toBe(200);
    const persisted = await prisma.reserveSnapshot.findUnique({
      where: { monthKey: "2026-11" },
    });
    expect(persisted).toMatchObject({
      monthKey: "2026-11",
      amountCents: 160000,
    });
  });

  it("faz upsert no mesmo mês e aceita zero", async () => {
    await POST(jsonRequest({ monthKey: "2026-11", amountCents: 160000 }));
    const second = await POST(
      jsonRequest({ monthKey: "2026-11", amountCents: 0 }),
    );

    expect(second.status).toBe(200);
    const rows = await prisma.reserveSnapshot.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountCents: 0 });
  });
});
