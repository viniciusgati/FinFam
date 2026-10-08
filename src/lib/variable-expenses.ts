/**
 * Domínio e validação dos gastos avulsos.
 *
 * Nenhuma dessas funções acessa banco de dados ou rede — apenas validam e
 * calculam, o que as torna facilmente testáveis (ver variable-expenses.test.ts).
 *
 * Regras completas em docs/SPEC.md §3.3.
 */

import { z } from "zod";
import { resolveTimeZone, zonedDateParts, zonedTimeToUtc } from "./time";

export const PAYMENT_METHODS = ["CASH", "DEBIT", "PIX", "CREDIT"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Gasto avulso entra no orçamento do mês? Gastos no crédito são registrados
 * apenas como anotação: a despesa é contada pela fatura do cartão (SPEC §3.4).
 */
export function isCountedInBudget(paymentMethod: PaymentMethod): boolean {
  return paymentMethod !== "CREDIT";
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Aceita apenas o formato `YYYY-MM`, com mês entre 01 e 12. */
export function isValidMonthParam(mes: string | null | undefined): mes is string {
  return typeof mes === "string" && MONTH_PATTERN.test(mes);
}

export interface MonthRange {
  gte: Date;
  lt: Date;
}

/**
 * Intervalo semiaberto `[início do mês, início do mês seguinte)` no fuso da
 * família, usado no filtro por mês. O limite superior é exclusivo para não
 * haver off-by-one.
 */
export function monthRange(
  mes: string,
  timeZone: string = resolveTimeZone(),
): MonthRange {
  const match = MONTH_PATTERN.exec(mes);
  if (!match) {
    throw new Error(`Mês inválido: ${mes}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    gte: zonedTimeToUtc(year, month, 1, timeZone),
    lt: zonedTimeToUtc(nextYear, nextMonth, 1, timeZone),
  };
}

/** Mês corrente no formato `YYYY-MM`, no calendário do fuso da família. */
export function currentMonthParam(
  referenceDate: Date = new Date(),
  timeZone: string = resolveTimeZone(),
): string {
  const { year, month } = zonedDateParts(referenceDate, timeZone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Rótulo legível de um mês `YYYY-MM` (ex.: `outubro de 2026`). */
export function monthLabel(mes: string): string {
  const match = MONTH_PATTERN.exec(mes);
  if (!match) return mes;
  return `${MONTH_NAMES[Number(match[2]) - 1]} de ${match[1]}`;
}

export const createVariableExpenseSchema = z.object({
  description: z.string().trim().min(1),
  amountCents: z.number().int().nonnegative(),
  date: z.coerce.date(),
  category: z.string().trim().min(1).nullable().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paid: z.boolean(),
  creditCardId: z.string().min(1).nullable().optional(),
});

export type CreateVariableExpenseInput = z.infer<
  typeof createVariableExpenseSchema
>;

export const updateVariableExpenseSchema = createVariableExpenseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export type UpdateVariableExpenseInput = z.infer<
  typeof updateVariableExpenseSchema
>;
