/**
 * Configuração global da família (linha singleton `AppSettings`).
 *
 * `cycleStartDay` é o dia do mês que marca o início do ciclo financeiro. A
 * faixa válida é 1–28 para que todo mês tenha o dia (meses curtos nunca
 * quebram o ciclo). O default é 1, ou seja, o ciclo coincide com o mês
 * calendário — preservando o comportamento anterior do dashboard.
 *
 * `savingsGoalCents` é a meta de economia por ciclo, em centavos. `null`
 * significa "sem meta" e é o default (retrocompatível com bancos que ainda
 * não tinham a coluna).
 *
 * `consumptionMode` é a forma de medir o consumo do ciclo na Home (história
 * #380). O default `INCOME` preserva o comportamento anterior.
 */
import {
  DEFAULT_CONSUMPTION_MODE,
  type ConsumptionMode,
} from "./consumption-mode";
import { prisma } from "./db";

export interface AppSettings {
  cycleStartDay: number;
  savingsGoalCents: number | null;
  consumptionMode: ConsumptionMode;
}

export const CYCLE_START_DAY_MIN = 1;
export const CYCLE_START_DAY_MAX = 28;

/** Identificador fixo da linha singleton de configurações. */
export const SETTINGS_SINGLETON_ID = "singleton";

/** Configuração usada quando ainda não há linha persistida. Pura. */
export function defaultSettings(): AppSettings {
  return {
    cycleStartDay: 1,
    savingsGoalCents: null,
    consumptionMode: DEFAULT_CONSUMPTION_MODE,
  };
}

/** Lê a configuração global; devolve o default quando a linha não existe. */
export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.appSettings.findUnique({
    where: { id: SETTINGS_SINGLETON_ID },
  });
  if (!row) return defaultSettings();
  return {
    cycleStartDay: row.cycleStartDay,
    savingsGoalCents: row.savingsGoalCents ?? null,
    consumptionMode: row.consumptionMode ?? DEFAULT_CONSUMPTION_MODE,
  };
}

/**
 * Grava (upsert) a configuração global do singleton.
 *
 * `savingsGoalCents` omitido mantém o valor persistido; `null` limpa a meta.
 * `consumptionMode` omitido mantém o valor persistido.
 */
export async function updateSettings(input: {
  cycleStartDay: number;
  savingsGoalCents?: number | null;
  consumptionMode?: ConsumptionMode;
}): Promise<AppSettings> {
  const row = await prisma.appSettings.upsert({
    where: { id: SETTINGS_SINGLETON_ID },
    create: {
      id: SETTINGS_SINGLETON_ID,
      cycleStartDay: input.cycleStartDay,
      savingsGoalCents: input.savingsGoalCents ?? null,
      consumptionMode: input.consumptionMode ?? DEFAULT_CONSUMPTION_MODE,
    },
    update: {
      cycleStartDay: input.cycleStartDay,
      ...(input.savingsGoalCents !== undefined
        ? { savingsGoalCents: input.savingsGoalCents }
        : {}),
      ...(input.consumptionMode !== undefined
        ? { consumptionMode: input.consumptionMode }
        : {}),
    },
  });
  return {
    cycleStartDay: row.cycleStartDay,
    savingsGoalCents: row.savingsGoalCents ?? null,
    consumptionMode: row.consumptionMode ?? DEFAULT_CONSUMPTION_MODE,
  };
}
