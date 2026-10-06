import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "@/test/integration";
import { PATCH } from "./[id]/route";
import { GET, POST } from "./route";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

function jsonRequest(
  method: string,
  body: unknown,
  url = "http://localhost/api/incomes",
) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe("rotas /api/incomes — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("GET lista as entradas persistidas ordenadas por nome", async () => {
    await prisma.income.createMany({
      data: [
        { name: "Salário", amountCents: 500000, receiveDay: 5 },
        { name: "Auxílio", amountCents: 100000, receiveDay: 10 },
      ],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ name: string }>;
    expect(body.map((income) => income.name)).toEqual(["Auxílio", "Salário"]);
  });

  it("POST com payload válido persiste e retorna 201", async () => {
    const response = await POST(
      jsonRequest("POST", {
        name: "Salário",
        amountCents: 500000,
        receiveDay: 5,
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string };
    expect(body).toMatchObject({
      name: "Salário",
      amountCents: 500000,
      receiveDay: 5,
      active: true,
    });

    const persisted = await prisma.income.findMany();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      id: body.id,
      name: "Salário",
      amountCents: 500000,
      receiveDay: 5,
      active: true,
    });
  });

  it("POST com payload inválido retorna 400 sem persistir", async () => {
    const response = await POST(
      jsonRequest("POST", { name: "", amountCents: -1, receiveDay: 0 }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(await prisma.income.count()).toBe(0);
  });

  it("PATCH atualiza o registro persistido", async () => {
    const created = await prisma.income.create({
      data: { name: "Salário", amountCents: 500000, receiveDay: 5 },
    });

    const response = await PATCH(
      jsonRequest("PATCH", { amountCents: 600000, active: false }),
      context(created.id),
    );

    expect(response.status).toBe(200);

    const persisted = await prisma.income.findUnique({
      where: { id: created.id },
    });
    expect(persisted).toMatchObject({
      id: created.id,
      name: "Salário",
      amountCents: 600000,
      active: false,
    });
  });
});
