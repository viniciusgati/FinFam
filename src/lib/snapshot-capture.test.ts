import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ensureClosedMonthSnapshots, isSnapshotTrigger } from "./snapshot-capture";

describe("isSnapshotTrigger", () => {
  it("dispara para mutações nos modelos de domínio", () => {
    expect(isSnapshotTrigger("Income", "create")).toBe(true);
    expect(isSnapshotTrigger("FixedExpense", "update")).toBe(true);
    expect(isSnapshotTrigger("FixedExpense", "updateMany")).toBe(true);
    expect(isSnapshotTrigger("VariableExpense", "delete")).toBe(true);
    expect(isSnapshotTrigger("VariableExpense", "deleteMany")).toBe(true);
    expect(isSnapshotTrigger("VariableIncome", "upsert")).toBe(true);
    expect(isSnapshotTrigger("CardPurchase", "createMany")).toBe(true);
    expect(isSnapshotTrigger("CreditCard", "updateMany")).toBe(true);
  });

  it("não dispara em leituras", () => {
    expect(isSnapshotTrigger("Income", "findMany")).toBe(false);
    expect(isSnapshotTrigger("VariableExpense", "findFirst")).toBe(false);
    expect(isSnapshotTrigger("CardPurchase", "aggregate")).toBe(false);
  });

  it("não dispara nas tabelas de snapshot (evita recursão)", () => {
    expect(isSnapshotTrigger("MonthlySnapshot", "create")).toBe(false);
    expect(isSnapshotTrigger("MonthlyCategorySnapshot", "createMany")).toBe(
      false,
    );
  });

  it("não dispara fora dos modelos de domínio nem sem modelo", () => {
    expect(isSnapshotTrigger("AppSettings", "upsert")).toBe(false);
    expect(isSnapshotTrigger("MonthlyReview", "upsert")).toBe(false);
    expect(isSnapshotTrigger(undefined, "create")).toBe(false);
  });
});

describe("ensureClosedMonthSnapshots — lookback de compras (task #359)", () => {
  it("consulta compras a partir do lookback do primeiro mês-alvo, com rangeEnd como teto", async () => {
    const db = {
      monthlySnapshot: { findMany: vi.fn().mockResolvedValue([]) },
      income: { findMany: vi.fn().mockResolvedValue([]) },
      fixedExpense: { findMany: vi.fn().mockResolvedValue([]) },
      variableIncome: { findMany: vi.fn().mockResolvedValue([]) },
      variableExpense: { findMany: vi.fn().mockResolvedValue([]) },
      cardPurchase: { findMany: vi.fn().mockResolvedValue([]) },
    };

    // 08/10/2026 12:00 BRT — alvos fechados 2026-08 e 2026-09.
    await ensureClosedMonthSnapshots(db as unknown as PrismaClient, {
      now: new Date("2026-10-08T15:00:00.000Z"),
      months: 2,
    });

    const [args] = db.cardPurchase.findMany.mock.calls[0];
    // Primeiro alvo 2026-08 → lookback 2016-07; teto no fim da janela (2026-10).
    expect(args.where.purchaseDate.gte.toISOString()).toBe(
      "2016-07-01T03:00:00.000Z",
    );
    expect(args.where.purchaseDate.lt.toISOString()).toBe(
      "2026-10-01T03:00:00.000Z",
    );
  });
});
