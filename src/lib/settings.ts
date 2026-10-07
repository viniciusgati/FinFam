/**
 * Configuração global da família (linha singleton `AppSettings`).
 *
 * `cycleStartDay` é o dia do mês que marca o início do ciclo financeiro. A
 * faixa válida é 1–28 para que todo mês tenha o dia (meses curtos nunca
 * quebram o ciclo). O default é 1, ou seja, o ciclo coincide com o mês
 * calendário — preservando o comportamento anterior do dashboard.
 */
import { prisma } from "./db";

export interface AppSettings {
  cycleStartDay: number;
}

export const CYCLE_START_DAY_MIN = 1;
export const CYCLE_START_DAY_MAX = 28;

/** Identificador fixo da linha singleton de configurações. */
export const SETTINGS_SINGLETON_ID = "singleton";

/** Configuração usada quando ainda não há linha persistida. Pura. */
export function defaultSettings(): AppSettings {
  return { cycleStartDay: 1 };
}

/** Lê a configuração global; devolve o default quando a linha não existe. */
export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.appSettings.findUnique({
    where: { id: SETTINGS_SINGLETON_ID },
  });
  if (!row) return defaultSettings();
  return { cycleStartDay: row.cycleStartDay };
}

/** Grava (upsert) a configuração global do singleton. */
export async function updateSettings(input: {
  cycleStartDay: number;
}): Promise<AppSettings> {
  const row = await prisma.appSettings.upsert({
    where: { id: SETTINGS_SINGLETON_ID },
    create: {
      id: SETTINGS_SINGLETON_ID,
      cycleStartDay: input.cycleStartDay,
    },
    update: { cycleStartDay: input.cycleStartDay },
  });
  return { cycleStartDay: row.cycleStartDay };
}
