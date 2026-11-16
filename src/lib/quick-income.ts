/**
 * Lógica pura do modo "Entrada" do card de lançamento rápido do dashboard
 * (história #371).
 *
 * Valida a entrada digitada e monta o payload do `POST /api/variable-incomes`
 * já existente. Entradas avulsas não têm categoria, forma de pagamento nem
 * `paid`, então o payload carrega apenas descrição, valor e data. Nenhuma
 * função aqui acessa banco ou rede — tudo é coberto por quick-income.test.ts.
 */

import { parseAmountToCents } from "./money";
import { isValidDateISO } from "./quick-expense";

export {
  AMOUNT_ERROR,
  DATE_ERROR,
  DESCRIPTION_ERROR,
  isValidDateISO,
  todayISO,
} from "./quick-expense";
import { AMOUNT_ERROR, DATE_ERROR, DESCRIPTION_ERROR } from "./quick-expense";

export interface QuickIncomeInput {
  description: string;
  amount: string;
  date: string;
}

export type QuickIncomeErrors = Partial<
  Record<"description" | "amount" | "date", string>
>;

export interface QuickIncomePayload {
  description: string;
  amountCents: number;
  date: string;
}

/** Valida a entrada do card e devolve as mensagens em pt-BR por campo. */
export function validateQuickIncome(input: QuickIncomeInput): QuickIncomeErrors {
  const errors: QuickIncomeErrors = {};
  if (!input.description.trim()) errors.description = DESCRIPTION_ERROR;
  if (parseAmountToCents(input.amount) === null) errors.amount = AMOUNT_ERROR;
  if (!isValidDateISO(input.date)) errors.date = DATE_ERROR;
  return errors;
}

/**
 * Monta o payload do card a partir de uma entrada já validada. Devolve
 * `null` quando a entrada é inválida (defesa contra uso fora de ordem).
 */
export function buildQuickIncomePayload(
  input: QuickIncomeInput,
): QuickIncomePayload | null {
  const description = input.description.trim();
  const amountCents = parseAmountToCents(input.amount);
  if (!description || amountCents === null || !isValidDateISO(input.date)) {
    return null;
  }

  return {
    description,
    amountCents,
    date: input.date,
  };
}

/** Traduz os `fieldErrors` (zod flatten) do 400 da API para pt-BR por campo. */
export function mapQuickIncomeFieldErrors(raw: unknown): QuickIncomeErrors {
  const fieldErrors = (raw ?? {}) as Record<string, unknown>;
  const errors: QuickIncomeErrors = {};
  if (fieldErrors.description) errors.description = DESCRIPTION_ERROR;
  if (fieldErrors.amountCents) errors.amount = AMOUNT_ERROR;
  if (fieldErrors.date) errors.date = DATE_ERROR;
  return errors;
}
