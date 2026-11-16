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

  it("defaultSettings retorna cycleStartDay 1 e sem meta", () => {
    expect(defaultSettings()).toEqual({ cycleStartDay: 1, savingsGoalCents: null });
  });

  it("getSettings sem linha persistida retorna o default", async () => {
    const settings = await getSettings();
    expect(settings).toEqual({ cycleStartDay: 1, savingsGoalCents: null });
  });

  it("getSettings converte coluna nula em savingsGoalCents null", async () => {
    await prisma.appSettings.create({
      data: { id: "singleton", cycleStartDay: 10, savingsGoalCents: null },
    });

    expect(await getSettings()).toEqual({
      cycleStartDay: 10,
      savingsGoalCents: null,
    });
  });

  it("updateSettings grava o singleton e getSettings reflete o valor", async () => {
    await updateSettings({ cycleStartDay: 20 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 20,
      savingsGoalCents: null,
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
    });
    expect(await prisma.appSettings.count()).toBe(1);
  });

  it("updateSettings sem savingsGoalCents preserva a meta persistida", async () => {
    await updateSettings({ cycleStartDay: 5, savingsGoalCents: 50000 });
    await updateSettings({ cycleStartDay: 15 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 15,
      savingsGoalCents: 50000,
    });
  });

  it("updateSettings atualiza a mesma linha (não duplica o singleton)", async () => {
    await updateSettings({ cycleStartDay: 5 });
    await updateSettings({ cycleStartDay: 15 });

    expect(await getSettings()).toEqual({
      cycleStartDay: 15,
      savingsGoalCents: null,
    });
    expect(await prisma.appSettings.count()).toBe(1);
  });
});
