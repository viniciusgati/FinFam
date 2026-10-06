/**
 * Utilitários puros de calendário ciente de fuso horário.
 *
 * O processo pode rodar num servidor com `TZ=UTC`; para o FinFam o dia e o mês
 * relevantes são sempre os do fuso da família (default `America/Sao_Paulo`,
 * sobreponível por `FINFAM_TIME_ZONE`). Nada aqui acessa banco de dados nem
 * rede — apenas converte instantes para o calendário do fuso.
 */

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

/** Data no calendário de um fuso: mês 1-based (1 = janeiro), como o Intl. */
export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
}

interface FullZonedParts extends ZonedDateParts {
  hour: number;
  minute: number;
  second: number;
}

type TimeZoneEnv = Record<string, string | undefined>;

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fuso de referência da aplicação: `FINFAM_TIME_ZONE` quando for um IANA
 * válido; caso contrário (ausente, vazio ou inválido), o default do Brasil.
 */
export function resolveTimeZone(env: TimeZoneEnv = process.env): string {
  const candidate = env.FINFAM_TIME_ZONE?.trim();
  if (candidate && isTimeZone(candidate)) return candidate;
  return DEFAULT_TIME_ZONE;
}

function fullZonedParts(date: Date, timeZone: string): FullZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Ano/mês/dia (mês 1-based) de `date` no fuso `timeZone`. */
export function zonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const { year, month, day } = fullZonedParts(date, timeZone);
  return { year, month, day };
}

/**
 * Instante UTC correspondente à meia-noite de `year-month-day` (mês 1-based)
 * no fuso `timeZone`. Nunca usa `new Date(ano, mês, dia)` local, de modo que o
 * resultado independe do `TZ` do processo.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day);
  const parts = fullZonedParts(new Date(utcGuess), timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return new Date(utcGuess - (asUtc - utcGuess));
}
