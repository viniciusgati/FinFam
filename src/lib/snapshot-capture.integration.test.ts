import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { ensureClosedMonthSnapshots } from "./snapshot-capture";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

// 08/10/2026 12:00 BRT — outubro/2026 corrente, setembro fechado.
const NOW = new Date("2026-10-08T15:00:00.000Z");

async function seedVigentItems() {
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
}

describe("ensureClosedMonthSnapshots", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedVigentItems();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("captura os meses fechados com movimentação e ignora os vazios", async () => {
    const result = await ensureClosedMonthSnapshots(prisma, {
      now: NOW,
      months: 3,
    });

    expect(result.created).toEqual(["2026-08", "2026-09"]);
    expect(result.empty).toEqual(["2026-07"]);
    expect(result.kept).toEqual([]);

    const snapshots = await prisma.monthlySnapshot.findMany({
      orderBy: { monthKey: "asc" },
    });
    expect(snapshots.map((row) => row.monthKey)).toEqual([
      "2026-08",
      "2026-09",
    ]);
    expect(snapshots[1].incomeCents).toBe(500000);
    expect(snapshots[1].fixedExpensesCents).toBe(120000);
    expect(snapshots[1].consumedPercent).toBeCloseTo(24);

    // Categorias do snapshot acompanham (uma por mês com a saída fixa).
    const categories = await prisma.monthlyCategorySnapshot.findMany({
      where: { monthKey: "2026-09" },
    });
    expect(categories).toEqual([
      expect.objectContaining({
        categoryKey: "moradia",
        categoryLabel: "Moradia",
        amountCents: 120000,
      }),
    ]);
  });

  it("é idempotente: rodar de novo não recria nem altera nada", async () => {
    await ensureClosedMonthSnapshots(prisma, { now: NOW, months: 3 });
    const before = await prisma.monthlySnapshot.findMany({
      orderBy: { monthKey: "asc" },
    });

    const result = await ensureClosedMonthSnapshots(prisma, {
      now: NOW,
      months: 3,
    });

    expect(result.created).toEqual([]);
    expect(result.kept).toEqual(["2026-08", "2026-09"]);
    expect(
      await prisma.monthlySnapshot.findMany({ orderBy: { monthKey: "asc" } }),
    ).toEqual(before);
  });

  it("regressão: desativar uma saída não altera o snapshot do mês fechado", async () => {
    await ensureClosedMonthSnapshots(prisma, { now: NOW, months: 1 });
    const before = await prisma.monthlySnapshot.findUnique({
      where: { monthKey: "2026-09" },
    });

    await prisma.fixedExpense.updateMany({ data: { active: false } });
    const result = await ensureClosedMonthSnapshots(prisma, {
      now: NOW,
      months: 1,
    });

    expect(result.created).toEqual([]);
    const after = await prisma.monthlySnapshot.findUnique({
      where: { monthKey: "2026-09" },
    });
    expect(after).toEqual(before);
    // O mês fechado segue com a saída que existia na captura.
    expect(after?.fixedExpensesCents).toBe(120000);
  });

  it("com force, recalcula o mês após correção explícita", async () => {
    await ensureClosedMonthSnapshots(prisma, { now: NOW, months: 1 });
    await prisma.fixedExpense.updateMany({ data: { active: false } });

    const result = await ensureClosedMonthSnapshots(prisma, {
      now: NOW,
      months: 1,
      force: true,
    });

    expect(result.recalculated).toEqual(["2026-09"]);
    const recalculated = await prisma.monthlySnapshot.findUnique({
      where: { monthKey: "2026-09" },
    });
    expect(recalculated?.fixedExpensesCents).toBe(0);
    expect(recalculated?.consumedCents).toBe(0);
    // Categorias do mês antigo foram substituídas.
    expect(
      await prisma.monthlyCategorySnapshot.count({
        where: { monthKey: "2026-09" },
      }),
    ).toBe(0);
  });

  it("com force em mês sem snapshot, cria (e não apenas recalcula)", async () => {
    const result = await ensureClosedMonthSnapshots(prisma, {
      now: NOW,
      months: 1,
      force: true,
    });

    expect(result.created).toEqual(["2026-09"]);
    expect(result.recalculated).toEqual([]);
  });

  it("fecha o mês na virada pelo fuso da família (23:30 BRT ainda é dia 31)", async () => {
    // 01/11/2026 02:30 UTC = 31/10/2026 23:30 BRT → outubro ainda não fechou.
    const beforeTurn = await ensureClosedMonthSnapshots(prisma, {
      now: new Date("2026-11-01T02:30:00.000Z"),
      months: 1,
    });
    expect(beforeTurn.created).toEqual(["2026-09"]);

    // 01/11/2026 03:00 UTC = 01/11/2026 00:00 BRT → outubro fechado.
    const afterTurn = await ensureClosedMonthSnapshots(prisma, {
      now: new Date("2026-11-01T03:00:00.000Z"),
      months: 1,
    });
    expect(afterTurn.created).toEqual(["2026-10"]);
  });

  it("tolera chamadas concorrentes sem duplicar snapshots", async () => {
    const [first, second] = await Promise.all([
      ensureClosedMonthSnapshots(prisma, { now: NOW, months: 1 }),
      ensureClosedMonthSnapshots(prisma, { now: NOW, months: 1 }),
    ]);

    const created = [...first.created, ...second.created];
    expect(created).toEqual(["2026-09"]);
    expect(
      await prisma.monthlySnapshot.count({ where: { monthKey: "2026-09" } }),
    ).toBe(1);
    expect(
      await prisma.monthlyCategorySnapshot.count({
        where: { monthKey: "2026-09" },
      }),
    ).toBe(1);
  });

  it("rejeita mês malformado com mensagem em pt-BR", async () => {
    await expect(
      ensureClosedMonthSnapshots(prisma, { month: "2026-13" }),
    ).rejects.toThrow("Mês inválido");
  });
});
