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
 * - Diária restante: `(renda − obrigações − gastos avulsos) / dias`,
 *   arredondada para centavos. **Pode ser negativa**: quando o ciclo já foi
 *   estourado, o valor negativo diz quanto a mais está sendo gasto por dia.
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
 * Dias do ciclo já decorridos, contando o próprio dia (inclusive). Nunca
 * negativo. Ex.: ciclo começando no dia 20 e hoje 25/03 ⇒ 6.
 */
export function elapsedCycleDays(
  now: Date,
  cycleStartDay: number,
  timeZone: string = resolveTimeZone(),
): number {
  const window = cycleWindow(now, cycleStartDay, timeZone);
  const start = zonedDateParts(window.start, timeZone);
  const today = zonedDateParts(now, timeZone);
  const diff = Math.round(
    (calendarDayUtc(today.year, today.month, today.day) -
      calendarDayUtc(start.year, start.month, start.day)) /
      DAY_MS,
  );
  return Math.max(diff + 1, 0);
}

/**
 * Divide o orçamento livre em centavos pelos dias restantes, arredondando para
 * centavos. `freeBudgetCents` pode ser negativo (ciclo estourado): nesse caso a
 * diária também fica negativa e informa o excesso diário. `remainingDays <= 0`
 * devolve o próprio orçamento (último dia do ciclo) sem dividir por zero.
 */
export function dailyCentsForBudget(
  freeBudgetCents: number,
  remainingDays: number,
): number {
  if (remainingDays <= 0) return Math.round(freeBudgetCents);
  const daily = Math.round(freeBudgetCents / remainingDays);
  // Normaliza `-0` (sobra de arredondamento) para `0` — comparações estritas
  // com `Object.is` distinguiriam os dois.
  return daily === 0 ? 0 : daily;
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
  /** Diária do ciclo em centavos. Negativa quando o ciclo foi estourado. */
  dailyCents: number;
  /** Orçamento livre do ciclo em centavos (nunca negativo). */
  freeBudgetCents: number;
  /** Dias restantes do ciclo (contando hoje). */
  remainingDays: number;
  /** Gastos avulsos já feitos dentro do ciclo (mesma janela do orçamento). */
  variableSpentCents: number;
  /** Dias do ciclo já decorridos, contando hoje (≥ 0). */
  elapsedDays: number;
  /** Há renda ou obrigações cadastradas no ciclo? */
  hasData: boolean;
  window: CycleWindow;
}

/**
 * Calcula a diária restante do ciclo atual.
 *
 * `hasData` distingue "sem dados do ciclo" (nenhuma renda/obrigação) de um
 * orçamento realmente esgotado (`freeBudgetCents <= 0` sem ser `hasData`).
 *
 * `freeBudgetCents` fica em `0` quando o ciclo estourou (é o orçamento
 * disponível), mas `dailyCents` segue para negativo: é o excesso diário, que o
 * card exibe para o usuário ver quanto gasta a mais por dia.
 */
export function dailyAllowanceCents(
  input: DailyAllowanceInput,
): DailyAllowance {
  const timeZone = input.timeZone ?? resolveTimeZone();
  const incomeCents = Math.max(input.incomeCents, 0);
  const obligationsCents = Math.max(input.obligationsCents, 0);
  const variableSpentCents = Math.max(input.variableSpentCents, 0);

  const rawFreeBudgetCents =
    incomeCents - obligationsCents - variableSpentCents;
  const freeBudgetCents = Math.max(rawFreeBudgetCents, 0);
  const remainingDays = remainingCycleDays(
    input.now,
    input.cycleStartDay,
    timeZone,
  );
  const elapsedDays = elapsedCycleDays(
    input.now,
    input.cycleStartDay,
    timeZone,
  );

  return {
    dailyCents: dailyCentsForBudget(rawFreeBudgetCents, remainingDays),
    freeBudgetCents,
    remainingDays,
    variableSpentCents,
    elapsedDays,
    hasData: incomeCents > 0 || obligationsCents > 0,
    window: cycleWindow(input.now, input.cycleStartDay, timeZone),
  };
}

export interface UsualDailySpendInput {
  /** Gastos avulsos (PIX/débito/dinheiro) dentro do ciclo. */
  variableSpentCents: number;
  /**
   * Fatura de cartão do mês calendário corrente. Ela já é contabilizada como
   * obrigação no orçamento livre; aqui entra **também** como consumo, porque a
   * compra no cartão é consumo real (decisão de produto do usuário).
   */
  cardExpensesCents: number;
  /** Dias decorridos do ciclo (contando hoje). */
  elapsedDays: number;
}

/**
 * Consumo médio por dia do ciclo ("ritmo recente" do simulador "posso
 * comprar?"): gastos avulsos + fatura de cartão do mês, divididos pelos dias
 * decorridos do ciclo. `null` quando não há consumo medido ou dias decorridos.
 */
export function usualDailySpendCents(
  input: UsualDailySpendInput,
): number | null {
  if (input.elapsedDays <= 0) return null;
  const consumed =
    Math.max(input.variableSpentCents, 0) + Math.max(input.cardExpensesCents, 0);
  if (consumed <= 0) return null;
  return Math.round(consumed / input.elapsedDays);
}

export type DailyAllowanceCardState =
  | "no-data"
  | "exhausted"
  | "over-budget"
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
  /** Janela do ciclo. Ex.: `Ciclo financeiro · início dia 20`. */
  periodLabel: string;
  /**
   * Saldo restante do ciclo. Ex.: `Ainda tem R$ 3.250,00 até o fim do ciclo`.
   * Vazio sem dados ou com orçamento livre zerado (esgotado/estourado).
   */
  freeBudgetLabel: string;
  /** Texto alternativo para leitor de tela / `aria-label`. */
  ariaLabel: string;
}

/** Rótulo da janela do ciclo a partir do dia de início. */
function cyclePeriodLabel(startDay: number): string {
  if (startDay === 1) {
    return "Ciclo financeiro · início dia 1 (coincide com o mês)";
  }
  return `Ciclo financeiro · início dia ${startDay}`;
}

/**
 * Estado de exibição do card "Pode gastar por dia". Função pura para que os
 * textos exatos sejam testáveis (o projeto não possui test runner de DOM).
 */
export function dailyAllowanceCard(
  allowance: DailyAllowance,
): DailyAllowanceCard {
  const periodLabel = cyclePeriodLabel(allowance.window.startDay);
  // Só exibe o saldo com orçamento livre de fato: esgotado/estourado já têm o
  // detalhe do estado, e "Ainda tem R$ 0,00" contradiz a diária negativa.
  const freeBudgetLabel =
    allowance.hasData && allowance.freeBudgetCents > 0
      ? `Ainda tem ${formatCents(allowance.freeBudgetCents)} até o fim do ciclo`
      : "";

  if (!allowance.hasData) {
    const value = "Sem dados do ciclo";
    return {
      state: "no-data",
      dailyCents: 0,
      remainingDays: allowance.remainingDays,
      value,
      label: value,
      detail: "",
      periodLabel,
      freeBudgetLabel,
      ariaLabel: `Pode gastar por dia: ${value}. ${periodLabel}`,
    };
  }

  if (allowance.dailyCents < 0) {
    // Ciclo estourado: a diária negativa diz quanto a mais está sendo gasto
    // por dia para fechar o ciclo no azul de novo.
    const value = formatCents(allowance.dailyCents);
    return {
      state: "over-budget",
      dailyCents: allowance.dailyCents,
      remainingDays: allowance.remainingDays,
      value,
      label: `${value} por dia`,
      detail: "Orçamento do ciclo estourado",
      periodLabel,
      freeBudgetLabel,
      ariaLabel: `Pode gastar por dia: ${value}. Orçamento do ciclo estourado. ${periodLabel}`,
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
      periodLabel,
      freeBudgetLabel,
      ariaLabel: `Pode gastar por dia: ${value}. Orçamento do ciclo esgotado. ${periodLabel}`,
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
      periodLabel,
      freeBudgetLabel,
      ariaLabel: `Pode gastar por dia: ${value}. Último dia do ciclo. ${periodLabel}`,
    };
  }

  return {
    state: "ready",
    dailyCents: allowance.dailyCents,
    remainingDays: allowance.remainingDays,
    value,
    label: `${value} por dia`,
    detail: `${allowance.remainingDays} dias restantes no ciclo`,
    periodLabel,
    freeBudgetLabel,
    ariaLabel: `Pode gastar por dia: ${value}, ${allowance.remainingDays} dias restantes no ciclo. ${periodLabel}`,
  };
}

/**
 * Rótulo do contador do cabeçalho do dashboard: dias até o fim do ciclo,
 * contando o dia corrente (mesma contagem de `remainingCycleDays`). Ex.: dia
 * 08 com ciclo terminando em 15 ⇒ "8 dias para o fim do ciclo".
 */
export function cycleEndCountdownLabel(days: number): string {
  if (days <= 0) return "Ciclo encerrado";
  if (days === 1) return "Hoje é o último dia do ciclo";
  return `${days} dias para o fim do ciclo`;
}
