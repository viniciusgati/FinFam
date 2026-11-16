/**
 * Vencimentos do ciclo e contas perto de terminar.
 *
 * A função é pura: recebe a janela do ciclo, as saídas fixas, os cartões e as
 * compras já carregadas, além do mês-base (`YYYY-MM`) e do fuso da família.
 * Nada aqui acessa banco ou rede, o que mantém os textos e a ordenação
 * testáveis (ver upcoming.test.ts).
 *
 * - `bills`: saídas fixas cuja ocorrência de `dueDay` cai no ciclo (vigência
 *   checada no mês da ocorrência) + faturas cujo vencimento cai em
 *   `[cycle.start, cycle.nextStart)`, ordenadas por data.
 * - `endingSoon`: itens fixos ativos cujo `endMonth` (inclusivo) está a 1 ou 2
 *   meses do mês-base, ordenados por `endMonth` e depois por nome.
 */

import { dayInCycleWindow, type CycleWindow } from "./cycle";
import { isActiveInMonth, monthKey, monthLabel, shiftMonthKey } from "./finance";
import {
  allocateInstallments,
  installmentDueDate,
  type CardPurchaseRecord,
} from "./invoices";
import { formatCents } from "./money";
import { resolveTimeZone, zonedDateParts, type ZonedDateParts } from "./time";

/** Máximo de meses à frente em que uma conta é sinalizada como "terminando". */
export const UPCOMING_WARNING_MONTHS = 2;

/** Saída fixa mínima para o cálculo dos vencimentos do ciclo. */
export interface UpcomingFixedExpense {
  name: string;
  amountCents: number;
  dueDay: number;
  active: boolean;
  startMonth?: string | null;
  endMonth?: string | null;
}

/** Cartão de crédito: metadados de fechamento/vencimento e nome exibido. */
export interface UpcomingCard {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
}

/** Um vencimento do ciclo (saída fixa ou fatura), em ordem cronológica. */
export interface UpcomingBill {
  name: string;
  /** Data de vencimento no calendário da família (YYYY-MM-DD). */
  dueDate: string;
  amountCents: number;
}

/** Aviso de conta que termina em um dos próximos meses. */
export interface UpcomingEndingSoon {
  name: string;
  /** Mês de término inclusivo (YYYY-MM). */
  endMonth: string;
}

export interface UpcomingCommitments {
  bills: UpcomingBill[];
  endingSoon: UpcomingEndingSoon[];
}

export interface UpcomingCommitmentsInput {
  cycle: CycleWindow;
  fixedExpenses: UpcomingFixedExpense[];
  cards: UpcomingCard[];
  purchases: CardPurchaseRecord[];
  /** Mês-base (`YYYY-MM`): avisos contam a partir dos meses seguintes. */
  referenceMonthKey: string;
  timeZone?: string;
}

function isoDate(date: Date, timeZone: string): string {
  const { year, month, day }: ZonedDateParts = zonedDateParts(date, timeZone);
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR");
}

/**
 * Monta os vencimentos do ciclo e os avisos de término a partir de dados já
 * carregados. O mês-base define a janela dos avisos; os vencimentos usam a
 * janela do ciclo.
 */
export function buildUpcomingCommitments(
  input: UpcomingCommitmentsInput,
): UpcomingCommitments {
  const timeZone = input.timeZone ?? resolveTimeZone();
  const { cycle, referenceMonthKey } = input;

  const bills: UpcomingBill[] = [];

  for (const expense of input.fixedExpenses) {
    const due = dayInCycleWindow(cycle, expense.dueDay, timeZone);
    if (due === null || !isActiveInMonth(expense, monthKey(due))) continue;

    bills.push({
      name: expense.name,
      dueDate: isoDate(due, timeZone),
      amountCents: expense.amountCents,
    });
  }

  // Faturas: soma as parcelas por cartão e competência e só mantém as que
  // vencem dentro da janela do ciclo. O valor é o da competência (parcela do
  // mês), não o total da compra.
  const cardById = new Map(input.cards.map((card) => [card.id, card]));
  const invoices = new Map<
    string,
    { name: string; due: Date; amountCents: number }
  >();

  for (const purchase of input.purchases) {
    const card = cardById.get(purchase.card.id) ?? purchase.card;
    for (const installment of allocateInstallments(
      purchase,
      card.closingDay,
      card.dueDay,
    )) {
      const due = installmentDueDate(installment.monthKey, card.dueDay, timeZone);
      if (
        due.getTime() < cycle.start.getTime() ||
        due.getTime() >= cycle.nextStart.getTime()
      ) {
        continue;
      }

      const key = `${card.id}:${installment.monthKey}`;
      const existing = invoices.get(key);
      if (existing) {
        existing.amountCents += installment.amountCents;
      } else {
        invoices.set(key, {
          name: `Fatura ${card.name}`,
          due,
          amountCents: installment.amountCents,
        });
      }
    }
  }

  for (const invoice of invoices.values()) {
    if (invoice.amountCents <= 0) continue;
    bills.push({
      name: invoice.name,
      dueDate: isoDate(invoice.due, timeZone),
      amountCents: invoice.amountCents,
    });
  }

  bills.sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || compareNames(a.name, b.name),
  );

  const warningMonths = new Set(
    Array.from({ length: UPCOMING_WARNING_MONTHS }, (_, index) =>
      shiftMonthKey(referenceMonthKey, index + 1),
    ),
  );

  const endingSoon = input.fixedExpenses
    .flatMap((expense) => {
      const endMonth = expense.endMonth;
      if (!endMonth || !warningMonths.has(endMonth)) return [];
      if (!isActiveInMonth(expense, endMonth)) return [];
      return [{ name: expense.name, endMonth }];
    })
    .sort(
      (a, b) => a.endMonth.localeCompare(b.endMonth) || compareNames(a.name, b.name),
    );

  return { bills, endingSoon };
}

/**
 * Linha de um vencimento: `Aluguel — 30/11 — R$ 1.500,00`.
 *
 * `formatCents` usa espaço não separável; o chamador normaliza ao comparar.
 */
export function billLineLabel(bill: UpcomingBill): string {
  const [, month, day] = bill.dueDate.split("-");
  return `${bill.name} — ${day}/${month} — ${formatCents(bill.amountCents)}`;
}

/** Aviso de término: `Termina em janeiro de 2027`. */
export function endingSoonLabel(warning: UpcomingEndingSoon): string {
  return `Termina em ${monthLabel(warning.endMonth)}`;
}
