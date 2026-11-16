/**
 * Lógica pura dos gastos avulsos "em aberto" (ainda não pagos).
 *
 * Nenhuma função aqui acessa banco de dados ou rede, e nenhuma depende do
 * relógio real: a data de referência entra por parâmetro. Isso mantém o resumo
 * do ciclo/mês, o filtro rápido de `/gastos` e a reversão otimista testáveis
 * sem DOM (ver open-expenses.test.ts).
 *
 * "Em aberto" é sobre quitação (`paid = false`), não sobre orçamento: o resumo
 * não filtra o método de pagamento e inclui gastos no crédito.
 */

import { formatCents } from "./money";
import { resolveTimeZone, zonedDateParts, zonedTimeToUtc } from "./time";

export interface OpenExpenseItem {
  id: string;
  amountCents: number;
  /** Data em ISO 8601 (comparações por instante). */
  date: string;
  paid: boolean;
}

export interface OpenExpensesSummary {
  totalCents: number;
  count: number;
}

/** Intervalo semiaberto `[from, to)` em ISO 8601. */
export interface OpenExpensesWindow {
  from: string;
  to: string;
}

export interface OpenMonthWindow extends OpenExpensesWindow {
  /** Mês calendário da referência (`YYYY-MM`). */
  monthKey: string;
}

/** Mensagens exatas publicadas pelas áreas `role="status"`/`role="alert"`. */
export const MARK_PAID_SUCCESS_MESSAGE = "Gasto marcado como pago";
export const MARK_PAID_ERROR_MESSAGE =
  "Não foi possível marcar como pago. Tente novamente.";
export const MARK_PAID_NOT_FOUND_MESSAGE =
  "Gasto não encontrado. Atualize a lista.";

function isOpen(item: OpenExpenseItem): boolean {
  return !item.paid;
}

/**
 * Soma e conta os gastos em aberto cuja data cai em `[from, to)`.
 *
 * `from` é inclusivo e `to` exclusivo. A comparação é feita por instante, então
 * itens no mesmo fuso não escorregam de janela por diferença de offset no ISO.
 */
export function sumOpenExpenses(
  items: OpenExpenseItem[],
  window: OpenExpensesWindow,
): OpenExpensesSummary {
  const fromMs = Date.parse(window.from);
  const toMs = Date.parse(window.to);

  let totalCents = 0;
  let count = 0;
  for (const item of items) {
    if (!isOpen(item)) continue;
    const instant = Date.parse(item.date);
    if (instant >= fromMs && instant < toMs) {
      totalCents += item.amountCents;
      count += 1;
    }
  }

  return { totalCents, count };
}

/**
 * Janela do mês calendário que contém `referenceDate` no fuso da família.
 * É semiaberta: do dia 1 à meia-noite até o dia 1 do mês seguinte (exclusivo).
 */
export function monthWindow(
  referenceDate: Date,
  timeZone: string = resolveTimeZone(),
): OpenMonthWindow {
  const { year, month } = zonedDateParts(referenceDate, timeZone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    from: zonedTimeToUtc(year, month, 1, timeZone).toISOString(),
    to: zonedTimeToUtc(nextYear, nextMonth, 1, timeZone).toISOString(),
  };
}

/**
 * Filtro rápido da lista: `"open"` devolve só os não pagos; qualquer outro
 * valor (ausente ou inválido) devolve todos os gastos.
 */
export function filterByStatus<T extends { paid: boolean }>(
  items: T[],
  status: string | null | undefined,
): T[] {
  if (status === "open") return items.filter((item) => !item.paid);
  return items;
}

/**
 * Atualização otimista: altera apenas a linha alvo. Serve tanto para marcar
 * como pago quanto para reverter (`paid = false`) quando o PATCH falha.
 */
export function setExpensePaid<T extends { id: string; paid: boolean }>(
  items: T[],
  id: string,
  paid: boolean,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, paid } : item));
}

/**
 * Mantém a linha em processo de marcação como "em aberto" até o PATCH
 * responder. Sem isso, a atualização otimista de `paid` remove a linha do
 * filtro `status=open` e esconde o estado "Marcando..." antes do 200.
 */
export function withMarkingOpen<T extends { id: string; paid: boolean }>(
  items: T[],
  markingId: string | null,
): T[] {
  if (markingId === null) return items;
  return items.map((item) =>
    item.id === markingId ? { ...item, paid: false } : item,
  );
}

/** `Nenhum gasto em aberto` / `1 gasto em aberto` / `N gastos em aberto`. */
export function openExpenseCountLabel(count: number): string {
  if (count <= 0) return "Nenhum gasto em aberto";
  if (count === 1) return "1 gasto em aberto";
  return `${count} gastos em aberto`;
}

function summaryText(prefix: string, summary: OpenExpensesSummary): string {
  return `${prefix}: ${formatCents(summary.totalCents)} · ${openExpenseCountLabel(
    summary.count,
  )}`;
}

/** Linha do card do dashboard, ex.: `A pagar no ciclo: R$ 120,00 · 2 gastos em aberto`. */
export function openCycleSummaryText(summary: OpenExpensesSummary): string {
  return summaryText("A pagar no ciclo", summary);
}

/** Linha do resumo de `/gastos`, ex.: `A pagar no mês: R$ 120,00 · 2 gastos em aberto`. */
export function openMonthSummaryText(summary: OpenExpensesSummary): string {
  return summaryText("A pagar no mês", summary);
}

/** Empty state do filtro rápido, ex.: `Nenhum gasto em aberto em novembro de 2026.` */
export function openExpensesEmptyText(monthLabel: string): string {
  return `Nenhum gasto em aberto em ${monthLabel}.`;
}
