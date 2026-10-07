/**
 * Schemas zod das APIs de entradas fixas (`/api/incomes`), saídas fixas
 * (`/api/fixed-expenses`), cartões (`/api/credit-cards`) e compras no cartão
 * (`/api/card-purchases`).
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

const creditCardFields = z.object({
  name: nameSchema,
  limitCents: amountCentsSchema.nullish(),
  closingDay: daySchema,
  dueDay: daySchema,
  active: z.boolean(),
});

export const creditCardCreateSchema = creditCardFields.extend({
  active: z.boolean().optional().default(true),
});

export const creditCardUpdateSchema = creditCardFields.partial();

const installmentNumberSchema = z
  .number()
  .int("Número da parcela deve ser um inteiro")
  .min(1, "O número da parcela deve ser pelo menos 1");

const installmentsTotalSchema = z
  .number()
  .int("Total de parcelas deve ser um inteiro")
  .min(1, "O total de parcelas deve ser pelo menos 1");

/**
 * `installmentNumber` é apenas metadado: `amountCents` é o valor total da
 * compra e o rateio é derivado em `invoices.ts` (premissa (a)). Ainda assim a
 * parcela não pode ultrapassar o total.
 */
function refineInstallments(
  data: { installmentNumber?: number; installmentsTotal?: number },
  ctx: z.RefinementCtx,
): void {
  if (
    data.installmentNumber !== undefined &&
    data.installmentsTotal !== undefined &&
    data.installmentNumber > data.installmentsTotal
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["installmentNumber"],
      message: "A parcela não pode ser maior que o total de parcelas",
    });
  }
}

const cardPurchaseFields = z.object({
  cardId: z.string().trim().min(1, "Selecione um cartão"),
  description: z.string().trim().min(1, "Informe uma descrição"),
  amountCents: amountCentsSchema,
  purchaseDate: z.coerce.date({
    errorMap: () => ({ message: "Informe a data da compra" }),
  }),
  category: categorySchema,
  installmentNumber: installmentNumberSchema,
  installmentsTotal: installmentsTotalSchema,
});

export const cardPurchaseCreateSchema =
  cardPurchaseFields.superRefine(refineInstallments);

export const cardPurchaseUpdateSchema =
  cardPurchaseFields.partial().superRefine(refineInstallments);

const CYCLE_START_DAY_MESSAGE = "Dia do ciclo deve ser entre 1 e 28";

/** Configuração global: dia do mês em que começa o ciclo financeiro (1–28). */
export const settingsUpdateSchema = z.object({
  cycleStartDay: z
    .number({
      invalid_type_error: CYCLE_START_DAY_MESSAGE,
      required_error: CYCLE_START_DAY_MESSAGE,
    })
    .int(CYCLE_START_DAY_MESSAGE)
    .min(1, CYCLE_START_DAY_MESSAGE)
    .max(28, CYCLE_START_DAY_MESSAGE),
});

export type IncomeCreateInput = z.infer<typeof incomeCreateSchema>;
export type IncomeUpdateInput = z.infer<typeof incomeUpdateSchema>;
export type FixedExpenseCreateInput = z.infer<typeof fixedExpenseCreateSchema>;
export type FixedExpenseUpdateInput = z.infer<typeof fixedExpenseUpdateSchema>;
export type CreditCardCreateInput = z.infer<typeof creditCardCreateSchema>;
export type CreditCardUpdateInput = z.infer<typeof creditCardUpdateSchema>;
export type CardPurchaseCreateInput = z.infer<typeof cardPurchaseCreateSchema>;
export type CardPurchaseUpdateInput = z.infer<typeof cardPurchaseUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

/** Primeira mensagem de erro do zod, usada nas respostas `{ error }`. */
export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}
