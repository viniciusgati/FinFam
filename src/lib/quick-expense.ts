/**
 * Lógica pura do card de lançamento rápido do dashboard (história #226).
 *
 * Valida a entrada digitada e monta o payload do `POST /api/variable-expenses`
 * já existente, com os mesmos defaults ocultos do formulário de `/gastos`.
 * Nenhuma função aqui acessa banco ou rede — tudo é coberto por
 * quick-expense.test.ts.
 */

import { parseAmountToCents } from "./money";

export const DESCRIPTION_ERROR = "Informe uma descrição.";
export const AMOUNT_ERROR = "Informe um valor válido (ex.: 12,34).";
export const DATE_ERROR = "Informe uma data válida.";

export interface QuickExpenseInput {
  description: string;
  amount: string;
  date: string;
}

export type QuickExpenseErrors = Partial<
  Record<"description" | "amount" | "date", string>
>;

export interface QuickExpensePayload {
  description: string;
  amountCents: number;
  date: string;
  paymentMethod: "PIX";
  paid: true;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Data de hoje no formato `YYYY-MM-DD` (mesmo cálculo da tela de gastos). */
export function todayISO(referenceDate: Date = new Date()): string {
  return referenceDate.toISOString().slice(0, 10);
}

/** Aceita `YYYY-MM-DD` somente quando o dia existe de fato no calendário. */
export function isValidDateISO(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  return (
    parsed.getUTCFullYear() === Number(match[1]) &&
    parsed.getUTCMonth() + 1 === Number(match[2]) &&
    parsed.getUTCDate() === Number(match[3])
  );
}

/** Valida a entrada do card e devolve as mensagens em pt-BR por campo. */
export function validateQuickExpense(input: QuickExpenseInput): QuickExpenseErrors {
  const errors: QuickExpenseErrors = {};
  if (!input.description.trim()) errors.description = DESCRIPTION_ERROR;
  if (parseAmountToCents(input.amount) === null) errors.amount = AMOUNT_ERROR;
  if (!isValidDateISO(input.date)) errors.date = DATE_ERROR;
  return errors;
}

/**
 * Monta o payload do card a partir de uma entrada já validada. Devolve
 * `null` quando a entrada é inválida (defesa contra uso fora de ordem).
 */
export function buildQuickExpensePayload(
  input: QuickExpenseInput,
): QuickExpensePayload | null {
  const description = input.description.trim();
  const amountCents = parseAmountToCents(input.amount);
  if (!description || amountCents === null || !isValidDateISO(input.date)) {
    return null;
  }

  return {
    description,
    amountCents,
    date: input.date,
    paymentMethod: "PIX",
    paid: true,
  };
}

/** Traduz os `fieldErrors` (zod flatten) do 400 da API para pt-BR por campo. */
export function mapQuickExpenseFieldErrors(raw: unknown): QuickExpenseErrors {
  const fieldErrors = (raw ?? {}) as Record<string, unknown>;
  const errors: QuickExpenseErrors = {};
  if (fieldErrors.description) errors.description = DESCRIPTION_ERROR;
  if (fieldErrors.amountCents) errors.amount = AMOUNT_ERROR;
  if (fieldErrors.date) errors.date = DATE_ERROR;
  return errors;
}
