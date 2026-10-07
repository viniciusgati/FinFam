/**
 * Lógica pura do ciclo financeiro e da diária restante.
 *
 * Nenhuma função aqui acessa banco de dados ou rede — apenas aritmética de
 * calendário (ciente do fuso da família, ver `time.ts`) e de centavos, o que as
 * torna facilmente testáveis (ver cycle.test.ts).
 *
 * Definições (ver história #225):
 * - Ciclo com `cycleStartDay = d`: começa no dia `d` de um mês e termina no dia
 *   `d−1` do mês seguinte. `cycleKey` é o mês do início (`YYYY-MM`).
 * - `d = 1` ⇒ ciclo = mês calendário (comportamento anterior preservado).
 * - `remainingDays` conta o próprio dia corrente e o último dia do ciclo
 *   (inclusive). Ex.: `d = 20` e hoje `2026-03-25` ⇒ `26`.
 * - Diária restante: `max(renda − obrigações − gastos avulsos, 0) / dias`,
 *   arredondada para centavos. Orçamento livre `<= 0` ⇒ diária `0`.
 */
import { formatCents } from "./money";
import { resolveTimeZone, zonedDateParts, zonedTimeToUtc } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CycleWindow {
  /** Mês de início do ciclo (YYYY-MM). */
  cycleKey: string;
  /** Meia-noite do primeiro dia do ciclo. */
  start: Date;
  /** Último dia do ciclo (inclusive), à meia-noite. */
  end: Date;
  /** Meia-noite do primeiro dia do ciclo seguinte (limite exclusivo). */
  nextStart: Date;
  /** Dia do mês em que o ciclo começa. */
  startDay: number;
}

function calendarDayUtc(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Janela do ciclo que contém `referenceDate`.
 *
 * Quando o dia de referência é anterior a `cycleStartDay`, o ciclo corrente
 * começou no mês anterior.
 */
export function cycleWindow(
  referenceDate: Date,
  cycleStartDay: number,
  timeZone: string = resolveTimeZone(),
): CycleWindow {
  const { year, month, day } = zonedDateParts(referenceDate, timeZone);

  let startYear = year;
  let startMonth = month;
  if (day < cycleStartDay) {
    startMonth -= 1;
    if (startMonth < 1) {
      startMonth = 12;
      startYear -= 1;
    }
  }

  const nextStartYear = startMonth === 12 ? startYear + 1 : startYear;
  const nextStartMonth = startMonth === 12 ? 1 : startMonth + 1;

  const start = zonedTimeToUtc(startYear, startMonth, cycleStartDay, timeZone);
  const nextStart = zonedTimeToUtc(
    nextStartYear,
    nextStartMonth,
    cycleStartDay,
    timeZone,
  );
  const endCalendar = new Date(
    calendarDayUtc(nextStartYear, nextStartMonth, cycleStartDay) - DAY_MS,
  );
  const end = zonedTimeToUtc(
    endCalendar.getUTCFullYear(),
    endCalendar.getUTCMonth() + 1,
    endCalendar.getUTCDate(),
    timeZone,
  );

  return {
    cycleKey: `${startYear}-${pad2(startMonth)}`,
    start,
    end,
    nextStart,
    startDay: cycleStartDay,
  };
}

/**
 * Dias restantes do ciclo, contando o próprio dia e o último dia (inclusive).
 * Nunca negativo: um instante posterior ao fim do ciclo retorna `0`.
 */
export function remainingCycleDays(
  now: Date,
  cycleStartDay: number,
  timeZone: string = resolveTimeZone(),
): number {
  const window = cycleWindow(now, cycleStartDay, timeZone);
  const today = zonedDateParts(now, timeZone);
  const last = zonedDateParts(window.end, timeZone);
  const diff = Math.round(
    (calendarDayUtc(last.year, last.month, last.day) -
      calendarDayUtc(today.year, today.month, today.day)) /
      DAY_MS,
  );
  return Math.max(diff + 1, 0);
}

/**
 * Divide o orçamento livre em centavos pelos dias restantes, arredondando para
 * centavos. Orçamento livre `<= 0` retorna `0`; `remainingDays <= 0` devolve o
 * próprio orçamento (último dia do ciclo) sem dividir por zero.
 */
export function dailyCentsForBudget(
  freeBudgetCents: number,
  remainingDays: number,
): number {
  const free = Math.max(freeBudgetCents, 0);
  if (free <= 0) return 0;
  if (remainingDays <= 0) return free;
  return Math.round(free / remainingDays);
}

export interface DailyAllowanceInput {
  incomeCents: number;
  obligationsCents: number;
  variableSpentCents: number;
  cycleStartDay: number;
  now: Date;
  timeZone?: string;
}

export interface DailyAllowance {
  /** Diária restante em centavos (nunca negativa). */
  dailyCents: number;
  /** Orçamento livre do ciclo em centavos (nunca negativo). */
  freeBudgetCents: number;
  /** Dias restantes do ciclo (contando hoje). */
  remainingDays: number;
  /** Há renda ou obrigações cadastradas no ciclo? */
  hasData: boolean;
  window: CycleWindow;
}

/**
 * Calcula a diária restante do ciclo atual.
 *
 * `hasData` distingue "sem dados do ciclo" (nenhuma renda/obrigação) de um
 * orçamento realmente esgotado (`freeBudgetCents <= 0` sem ser `hasData`).
 */
export function dailyAllowanceCents(
  input: DailyAllowanceInput,
): DailyAllowance {
  const timeZone = input.timeZone ?? resolveTimeZone();
  const incomeCents = Math.max(input.incomeCents, 0);
  const obligationsCents = Math.max(input.obligationsCents, 0);
  const variableSpentCents = Math.max(input.variableSpentCents, 0);

  const freeBudgetCents = Math.max(
    incomeCents - obligationsCents - variableSpentCents,
    0,
  );
  const remainingDays = remainingCycleDays(
    input.now,
    input.cycleStartDay,
    timeZone,
  );

  return {
    dailyCents: dailyCentsForBudget(freeBudgetCents, remainingDays),
    freeBudgetCents,
    remainingDays,
    hasData: incomeCents > 0 || obligationsCents > 0,
    window: cycleWindow(input.now, input.cycleStartDay, timeZone),
  };
}

export type DailyAllowanceCardState =
  | "no-data"
  | "exhausted"
  | "last-day"
  | "ready";

export interface DailyAllowanceCard {
  state: DailyAllowanceCardState;
  dailyCents: number;
  remainingDays: number;
  /** Ex.: `R$ 125,00`. */
  value: string;
  /** Ex.: `R$ 125,00 por dia`. */
  label: string;
  /** Ex.: `26 dias restantes no ciclo`. */
  detail: string;
  /** Texto alternativo para leitor de tela / `aria-label`. */
  ariaLabel: string;
}

/**
 * Estado de exibição do card "Pode gastar por dia". Função pura para que os
 * textos exatos sejam testáveis (o projeto não possui test runner de DOM).
 */
export function dailyAllowanceCard(
  allowance: DailyAllowance,
): DailyAllowanceCard {
  if (!allowance.hasData) {
    const value = "Sem dados do ciclo";
    return {
      state: "no-data",
      dailyCents: 0,
      remainingDays: allowance.remainingDays,
      value,
      label: value,
      detail: "",
      ariaLabel: `Pode gastar por dia: ${value}`,
    };
  }

  if (allowance.freeBudgetCents <= 0) {
    const value = formatCents(0);
    return {
      state: "exhausted",
      dailyCents: 0,
      remainingDays: allowance.remainingDays,
      value,
      label: `${value} por dia`,
      detail: "Orçamento do ciclo esgotado",
      ariaLabel: `Pode gastar por dia: ${value}. Orçamento do ciclo esgotado`,
    };
  }

  const value = formatCents(allowance.dailyCents);

  if (allowance.remainingDays <= 1) {
    return {
      state: "last-day",
      dailyCents: allowance.dailyCents,
      remainingDays: allowance.remainingDays,
      value,
      label: `${value} por dia`,
      detail: "Último dia do ciclo",
      ariaLabel: `Pode gastar por dia: ${value}. Último dia do ciclo`,
    };
  }

  return {
    state: "ready",
    dailyCents: allowance.dailyCents,
    remainingDays: allowance.remainingDays,
    value,
    label: `${value} por dia`,
    detail: `${allowance.remainingDays} dias restantes no ciclo`,
    ariaLabel: `Pode gastar por dia: ${value}, ${allowance.remainingDays} dias restantes no ciclo`,
  };
}
