import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { prisma } from "./db";
import { monthKey, shiftMonthKey } from "./finance";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const testPrisma = getTestPrisma();

/**
 * O client exportado por `./db` tem a extensão que captura meses fechados
 * depois de qualquer mutação nos modelos de domínio (o "write em qualquer
 * mês"). Este arquivo cobre o gancho de ponta a ponta: mutação real no client
 * do app → snapshot do mês fechado gravado, sem cron.
 */
describe("captura automática no write (extensão do Prisma)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("grava os snapshots dos meses fechados após uma escrita no client do app", async () => {
    const current = monthKey(new Date());
    const previous = shiftMonthKey(current, -1);

    // Renda vigente cobrindo a janela automática de captura.
    await testPrisma.income.create({
      data: { name: "Salário", amountCents: 500000, startMonth: "2026-01" },
    });

    // Escrita pelo client do app: dispara a captura antes de responder.
    await prisma.variableExpense.create({
      data: {
        description: "Mercado",
        amountCents: 10000,
        date: new Date(),
        paymentMethod: "PIX",
      },
    });

    const previousSnapshot = await testPrisma.monthlySnapshot.findUnique({
      where: { monthKey: previous },
    });
    expect(previousSnapshot).not.toBeNull();
    expect(previousSnapshot?.incomeCents).toBe(500000);

    // O mês corrente não é fechado: continua calculado ao vivo.
    const currentSnapshot = await testPrisma.monthlySnapshot.findUnique({
      where: { monthKey: current },
    });
    expect(currentSnapshot).toBeNull();
  });
});
