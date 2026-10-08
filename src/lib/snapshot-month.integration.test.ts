import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { loadDashboardData } from "./dashboard";
import { computeFinanceStatus } from "./finance";
import { resolveReferenceDate } from "./invoices";
import { ensureClosedMonthSnapshots } from "./snapshot-capture";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

// 08/10/2026 12:00 BRT — outubro/2026 corrente, setembro fechado.
const NOW = new Date("2026-10-08T15:00:00.000Z");

/**
 * Garantia de produto: um mês fechado é imutável. O dashboard de setembro lê o
 * snapshot criado na captura e continua idêntico mesmo depois de desativar a
 * renda e a saída fixa no presente.
 */
describe("dashboard de mês fechado (snapshot imutável)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.income.create({
      data: { name: "Salário", amountCents: 500000, startMonth: "2026-08" },
    });
    await prisma.fixedExpense.create({
      data: {
        name: "Aluguel",
        amountCents: 120000,
        category: "Moradia",
        startMonth: "2026-08",
      },
    });
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lê o snapshot e não muda quando os dados de origem mudam", async () => {
    await ensureClosedMonthSnapshots(prisma, { now: NOW, months: 1 });
    const referenceDate = new Date("2026-09-15T12:00:00.000Z");

    const before = await loadDashboardData(referenceDate);
    expect(before.monthlyIncomeCents).toBe(500000);
    expect(before.fixedExpensesCents).toBe(120000);
    expect(before.series.variableDailyCents).toHaveLength(30);

    // Muda o presente: desativa a saída fixa e a renda.
    await prisma.fixedExpense.updateMany({ data: { active: false } });
    await prisma.income.updateMany({ data: { active: false } });

    const after = await loadDashboardData(referenceDate);
    expect(after.monthlyIncomeCents).toBe(500000);
    expect(after.fixedExpensesCents).toBe(120000);
    expect(after.categoryBreakdown).toEqual(before.categoryBreakdown);
    expect(after.consumption).toEqual(before.consumption);
    expect(after.series.dailyExpensesCents).toEqual(
      before.series.dailyExpensesCents,
    );
  });

  it("?mes de mês fechado ancora no último dia: ritmo e projeção não estouram (regressão)", async () => {
    await ensureClosedMonthSnapshots(prisma, { now: NOW, months: 1 });
    const referenceDate = resolveReferenceDate("2026-09", NOW);

    const data = await loadDashboardData(referenceDate);
    const status = computeFinanceStatus(data);

    // Regressão: `?mes` de mês fechado vinha como dia 1 → elapsed 1 e projeção
    // ~30× o mês ("Risco de estouro" em todo mês já encerrado). Com o mês
    // inteiro decorrido a projeção é o próprio fechamento.
    expect(status.daysElapsed).toBe(30);
    expect(status.daysRemaining).toBe(0);
    expect(status.projectedPercent).toBeCloseTo(status.consumedPercent, 5);
    expect(status.projectedCents).toBe(status.consumedCents);
  });
});
