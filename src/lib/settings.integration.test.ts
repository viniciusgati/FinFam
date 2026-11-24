import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  disconnectTestDatabase,
  getTestPrisma,
  requireTestDatabase,
  resetDatabase,
} from "../test/integration";
import { defaultSettings, getSettings, updateSettings } from "./settings";

// Falha de forma explícita sem `TEST_DATABASE_URL`; nunca toca SQLite.
requireTestDatabase();

const prisma = getTestPrisma();

describe("settings — integração com PostgreSQL", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("defaultSettings retorna cycleStartDay 1, sem meta e modo renda", () => {
    expect(defaultSettings()).toEqual({
      cycleStartDay: 1,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
  });

  it("getSettings sem linha persistida retorna o default", async () => {
    const settings = await getSettings();
    expect(settings).toEqual({
      cycleStartDay: 1,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
  });

  it("getSettings converte coluna nula em savingsGoalCents null", async () => {
    await prisma.appSettings.create({
      data: { id: "singleton", cycleStartDay: 10, savingsGoalCents: null },
    });

    expect(await getSettings()).toEqual({
      cycleStartDay: 10,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
  });

  it("updateSettings grava o singleton e getSettings reflete o valor", async () => {
    await updateSettings({ cycleStartDay: 20 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 20,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });

    const rows = await prisma.appSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].cycleStartDay).toBe(20);
  });

  it("updateSettings grava e relê a meta de economia", async () => {
    await updateSettings({ cycleStartDay: 5, savingsGoalCents: 50000 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 5,
      savingsGoalCents: 50000,
      consumptionMode: "INCOME",
    });

    const rows = await prisma.appSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].savingsGoalCents).toBe(50000);
  });

  it("updateSettings com savingsGoalCents null limpa a meta", async () => {
    await updateSettings({ cycleStartDay: 5, savingsGoalCents: 50000 });
    await updateSettings({ cycleStartDay: 5, savingsGoalCents: null });

    expect(await getSettings()).toEqual({
      cycleStartDay: 5,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
    expect(await prisma.appSettings.count()).toBe(1);
  });

  it("updateSettings sem savingsGoalCents preserva a meta persistida", async () => {
    await updateSettings({ cycleStartDay: 5, savingsGoalCents: 50000 });
    await updateSettings({ cycleStartDay: 15 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 15,
      savingsGoalCents: 50000,
      consumptionMode: "INCOME",
    });
  });

  it("updateSettings atualiza a mesma linha (não duplica o singleton)", async () => {
    await updateSettings({ cycleStartDay: 5 });
    await updateSettings({ cycleStartDay: 15 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 15,
      savingsGoalCents: null,
      consumptionMode: "INCOME",
    });
    expect(await prisma.appSettings.count()).toBe(1);
  });

  it("updateSettings grava e relê o modo de consumo", async () => {
    await updateSettings({
      cycleStartDay: 5,
      consumptionMode: "VARIABLE_BUDGET",
    });

    expect(await getSettings()).toEqual({
      cycleStartDay: 5,
      savingsGoalCents: null,
      consumptionMode: "VARIABLE_BUDGET",
    });

    const rows = await prisma.appSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].consumptionMode).toBe("VARIABLE_BUDGET");
  });

  it("updateSettings sem consumptionMode preserva o modo persistido", async () => {
    await updateSettings({
      cycleStartDay: 5,
      consumptionMode: "VARIABLE_BUDGET",
    });
    await updateSettings({ cycleStartDay: 10 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 10,
      savingsGoalCents: null,
      consumptionMode: "VARIABLE_BUDGET",
    });
  });

  it("migration aplica o default INCOME na coluna nova", async () => {
    await prisma.appSettings.create({
      data: { id: "singleton", cycleStartDay: 1 },
    });

    const row = await prisma.appSettings.findUnique({
      where: { id: "singleton" },
    });
    expect(row?.consumptionMode).toBe("INCOME");
  });
});
