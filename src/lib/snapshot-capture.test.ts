import { describe, expect, it } from "vitest";
import { isSnapshotTrigger } from "./snapshot-capture";

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
