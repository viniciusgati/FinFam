import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "./integration";

// Falha de forma explícita quando o banco de teste não está configurado; nunca
// pula em silêncio. `npm test` não inclui este arquivo (ver vitest.config.ts).
requireTestDatabase();

const prisma = getTestPrisma();

describe("infraestrutura de testes de integração", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("conecta ao PostgreSQL de teste via Prisma", async () => {
    const rows = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT version()
    `;
    expect(rows[0]?.version).toContain("PostgreSQL");
  });

  it("persiste dados no banco de teste", async () => {
    await prisma.income.create({
      data: { name: "Salário", amountCents: 1000, receiveDay: 1 },
    });
    expect(await prisma.income.count()).toBe(1);
  });

  it("limpa as tabelas entre os testes (reset no beforeEach)", async () => {
    expect(await prisma.income.count()).toBe(0);
  });
});
