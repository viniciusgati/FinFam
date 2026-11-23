import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { loadSavingsGoalHistory } from "./dashboard";
import { savingsGoalHistory, savingsGoalHistoryLabel } from "./savings-goal";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

// 2026-03-25 12:00 em America/Sao_Paulo (UTC-3) ⇒ mês corrente 2026-03.
const NOW = new Date("2026-03-25T15:00:00.000Z");

function snapshot(
  monthKey: string,
  incomeCents: number,
  consumedCents: number,
) {
  return {
    monthKey,
    incomeCents,
    consumedCents,
    fixedExpensesCents: 0,
    variableExpensesCents: consumedCents,
    cardExpensesCents: 0,
    consumedPercent: incomeCents > 0 ? (consumedCents / incomeCents) * 100 : 0,
  };
}

describe("loadSavingsGoalHistory — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("exclui o mês corrente e mapeia os meses fechados para o histórico", async () => {
    await prisma.monthlySnapshot.createMany({
      data: [
        // Fora da janela (anterior aos 12 meses fechados): ignorado.
        snapshot("2025-02", 500000, 0),
        // Sem movimentação: entra na leitura, mas fica fora do denominador.
        snapshot("2025-11", 0, 0),
        // Atingiu a meta (guardado 400000).
        snapshot("2025-12", 500000, 100000),
        // Não atingiu a meta (guardado 50000).
        snapshot("2026-01", 500000, 450000),
        // Atingiu a meta (guardado 200000).
        snapshot("2026-02", 500000, 300000),
        // Mês corrente: nunca entra no histórico.
        snapshot("2026-03", 500000, 0),
      ],
    });

    const months = await loadSavingsGoalHistory(NOW, NOW);

    expect(months.map((month) => month.monthKey)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);

    const history = savingsGoalHistory(months, 100000);
    expect(history).toMatchObject({ metCount: 2, evaluatedCount: 3 });
    expect(savingsGoalHistoryLabel(history)).toBe(
      "Meta atingida em 2 de 3 meses fechados nos últimos 12 meses.",
    );
  });

  it("devolve no máximo 12 meses, em ordem cronológica", async () => {
    const keys = [
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ];
    await prisma.monthlySnapshot.createMany({
      data: keys.map((key) => snapshot(key, 500000, 100000)),
    });

    const months = await loadSavingsGoalHistory(NOW, NOW);

    expect(months).toHaveLength(12);
    expect(months.map((month) => month.monthKey)).toEqual([
      "2025-03",
      "2025-04",
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("sem meta não há histórico", async () => {
    await prisma.monthlySnapshot.create({
      data: snapshot("2026-02", 500000, 100000),
    });

    const months = await loadSavingsGoalHistory(NOW, NOW);

    expect(savingsGoalHistory(months, null)).toBeNull();
    expect(savingsGoalHistory(months, 0)).toBeNull();
  });
});
