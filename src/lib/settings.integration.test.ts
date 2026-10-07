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

  it("defaultSettings retorna cycleStartDay 1", () => {
    expect(defaultSettings()).toEqual({ cycleStartDay: 1 });
  });

  it("getSettings sem linha persistida retorna o default 1", async () => {
    const settings = await getSettings();
    expect(settings.cycleStartDay).toBe(1);
  });

  it("updateSettings grava o singleton e getSettings reflete o valor", async () => {
    await updateSettings({ cycleStartDay: 20 });

    expect(await getSettings()).toEqual({ cycleStartDay: 20 });

    const rows = await prisma.appSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].cycleStartDay).toBe(20);
  });

  it("updateSettings atualiza a mesma linha (não duplica o singleton)", async () => {
    await updateSettings({ cycleStartDay: 5 });
    await updateSettings({ cycleStartDay: 15 });

    expect(await getSettings()).toEqual({ cycleStartDay: 15 });
    expect(await prisma.appSettings.count()).toBe(1);
  });
});
