/**
 * Lógica pura do card de lançamento rápido do dashboard (história #226).
 *
 * Valida a entrada digitada e monta o payload do `POST /api/variable-expenses`
 * já existente, com os mesmos defaults ocultos do formulário de `/gastos`.
 * Nenhuma função aqui acessa banco ou rede — tudo é coberto por
 * quick-expense.test.ts.
 */

import { normalizeCategoryLabel } from "./categories";
import { parseAmountToCents } from "./money";
import { resolveTimeZone, zonedDateParts } from "./time";

export const DESCRIPTION_ERROR = "Informe uma descrição.";
export const AMOUNT_ERROR = "Informe um valor válido (ex.: 12,34).";
export const DATE_ERROR = "Informe uma data válida.";
export const CARD_ERROR = "Selecione um cartão.";

/** Meio de pagamento do lançamento rápido: PIX/dinheiro ou cartão. */
export type QuickExpenseTarget = "pix" | "card";

export interface QuickExpenseInput {
  description: string;
  amount: string;
  date: string;
  category?: string;
  target?: QuickExpenseTarget;
  cardId?: string;
}

export type QuickExpenseErrors = Partial<
  Record<"description" | "amount" | "date" | "cardId", string>
>;

export interface QuickExpensePayload {
  description: string;
  amountCents: number;
  date: string;
  category: string | null;
  paymentMethod: "PIX";
  paid: true;
}

export interface QuickCardPurchasePayload {
  cardId: string;
  description: string;
  amountCents: number;
  purchaseDate: string;
  category: string | null;
  installmentNumber: 1;
  installmentsTotal: 1;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Data de hoje no formato `YYYY-MM-DD`, no calendário do fuso da família
 * (mesmo cálculo da tela de gastos e do dashboard).
 */
export function todayISO(
  referenceDate: Date = new Date(),
  timeZone: string = resolveTimeZone(),
): string {
  const { year, month, day } = zonedDateParts(referenceDate, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  if (input.target === "card" && !input.cardId?.trim()) {
    errors.cardId = CARD_ERROR;
  }
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
    category: normalizeCategoryLabel(input.category),
    paymentMethod: "PIX",
    paid: true,
  };
}

/**
 * Monta o payload do `POST /api/card-purchases` a partir de uma entrada já
 * validada. O lançamento rápido não oferece parcelamento: sempre 1 de 1.
 * Devolve `null` quando a entrada é inválida.
 */
export function buildQuickCardPurchasePayload(
  input: QuickExpenseInput,
): QuickCardPurchasePayload | null {
  const description = input.description.trim();
  const amountCents = parseAmountToCents(input.amount);
  const cardId = input.cardId?.trim() ?? "";
  if (
    !description ||
    amountCents === null ||
    !isValidDateISO(input.date) ||
    !cardId
  ) {
    return null;
  }

  return {
    cardId,
    description,
    amountCents,
    purchaseDate: `${input.date}T00:00:00`,
    category: normalizeCategoryLabel(input.category),
    installmentNumber: 1,
    installmentsTotal: 1,
  };
}

/** Mensagem de sucesso exibida após o lançamento, por meio de pagamento. */
export function quickExpenseSuccessMessage(target: QuickExpenseTarget): string {
  return target === "card"
    ? "Compra lançada na fatura do cartão"
    : "Gasto criado";
}

/**
 * Extrai a mensagem em pt-BR das respostas `{ error }` (ex.: 400 do fluxo de
 * cartão). Devolve `null` quando não há `error` textual.
 */
export function quickExpenseApiError(raw: unknown): string | null {
  const error = (raw as { error?: unknown } | null | undefined)?.error;
  return typeof error === "string" && error.trim() ? error : null;
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
