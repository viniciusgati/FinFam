/**
 * Schemas zod das APIs de entradas fixas (`/api/incomes`) e saídas fixas
 * (`/api/fixed-expenses`).
 *
 * Valores monetários trafegam como inteiro positivo em centavos; a vigência usa
 * o formato `YYYY-MM` e é inclusiva nas duas pontas (ver docs/SPEC.md e as
 * suposições da história #212).
 */
import { z } from "zod";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_MESSAGE = "Mês inválido (use AAAA-MM)";

const nameSchema = z.string().trim().min(1, "Informe um nome");
const amountCentsSchema = z
  .number()
  .int("Informe um valor em centavos")
  .positive("Informe um valor maior que zero");
const daySchema = z
  .number()
  .int("Dia deve ser um número inteiro")
  .min(1, "Dia deve ser entre 1 e 31")
  .max(31, "Dia deve ser entre 1 e 31");
const monthSchema = z.string().regex(MONTH_REGEX, MONTH_MESSAGE).nullish();
const categorySchema = z.string().nullish();

/**
 * Vigência válida: `endMonth` não pode ser anterior a `startMonth`. Limites
 * nulos/ausentes significam "sem limite".
 */
export function isPeriodValid(
  startMonth?: string | null,
  endMonth?: string | null,
): boolean {
  if (!startMonth || !endMonth) return true;
  return endMonth >= startMonth;
}

function refinePeriod(
  data: { startMonth?: string | null; endMonth?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (!isPeriodValid(data.startMonth, data.endMonth)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endMonth"],
      message: "Mês final não pode ser anterior ao inicial",
    });
  }
}

const incomeFields = z.object({
  name: nameSchema,
  amountCents: amountCentsSchema,
  receiveDay: daySchema,
  startMonth: monthSchema,
  endMonth: monthSchema,
  active: z.boolean(),
});

const fixedExpenseFields = z.object({
  name: nameSchema,
  amountCents: amountCentsSchema,
  dueDay: daySchema,
  category: categorySchema,
  startMonth: monthSchema,
  endMonth: monthSchema,
  active: z.boolean(),
});

export const incomeCreateSchema = incomeFields
  .extend({ active: z.boolean().optional().default(true) })
  .superRefine(refinePeriod);

export const incomeUpdateSchema = incomeFields.partial().superRefine(refinePeriod);

export const fixedExpenseCreateSchema = fixedExpenseFields
  .extend({ active: z.boolean().optional().default(true) })
  .superRefine(refinePeriod);

export const fixedExpenseUpdateSchema = fixedExpenseFields
  .partial()
  .superRefine(refinePeriod);

export type IncomeCreateInput = z.infer<typeof incomeCreateSchema>;
export type IncomeUpdateInput = z.infer<typeof incomeUpdateSchema>;
export type FixedExpenseCreateInput = z.infer<typeof fixedExpenseCreateSchema>;
export type FixedExpenseUpdateInput = z.infer<typeof fixedExpenseUpdateSchema>;

/** Primeira mensagem de erro do zod, usada nas respostas `{ error }`. */
export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}
