/**
 * Regras puras de competência de fatura de cartão de crédito.
 *
 * Nenhuma função aqui acessa banco de dados ou rede — apenas aritmética
 * inteira de ano/mês (nunca depende do tamanho do mês), o que as torna
 * facilmente testáveis (ver invoices.test.ts) e seguras na virada de ano.
 *
 * Suposições documentadas (ver docs/SPEC.md §3.4):
 * - (a) Cada linha de compra representa a compra completa: `amountCents` é o
 *   total e `installmentsTotal` o número de parcelas.
 * - (b) Fechamento inclusivo: `dia(purchaseDate) <= closingDay` → ciclo no mês
 *   da compra; `> closingDay` → ciclo no mês seguinte.
 * - (c) Competência/vencimento: avança 1 mês quando `dueDay <= closingDay`;
 *   senão mantém o mês do ciclo.
 * - (d) Parcelas: parcela 1 no ciclo da compra; parcela `k` no ciclo `(k-1)`
 *   meses depois; a competência de cada parcela segue (c).
 * - (e) Rateio: parcela = `floor(amountCents / installmentsTotal)`; o resto
 *   (`%`) soma-se à 1ª parcela, garantindo soma exata = `amountCents`.
 */

import { resolveTimeZone, zonedDateParts, zonedTimeToUtc } from "./time";

export interface PurchaseInvoice {
  /** Mês do ciclo de fechamento em que a compra entrou (YYYY-MM). */
  cycleMonthKey: string;
  /** Mês de vencimento/competência da fatura (YYYY-MM). */
  dueMonthKey: string;
}

export interface InstallmentPlanInput {
  purchaseDate: Date;
  amountCents: number;
  installmentsTotal: number;
}

export interface CardPurchaseForMonth extends InstallmentPlanInput {
  card: { closingDay: number; dueDay: number };
}

export interface Installment {
  installmentNumber: number;
  /** Mês de competência da parcela (YYYY-MM). */
  monthKey: string;
  amountCents: number;
}

/** Total de meses desde o ano 0, permitindo comparar/somar meses sem Date. */
function totalMonths(year: number, monthIndex: number): number {
  return year * 12 + monthIndex;
}

function monthKeyFromTotal(total: number): string {
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Mês do ciclo de fechamento (b) expresso em meses totais. */
function cycleTotal(purchaseDate: Date, closingDay: number): number {
  const offset = purchaseDate.getDate() <= closingDay ? 0 : 1;
  return totalMonths(purchaseDate.getFullYear(), purchaseDate.getMonth()) + offset;
}

/** Deslocamento de vencimento da regra (c). */
export function dueOffset(closingDay: number, dueDay: number): number {
  return dueDay <= closingDay ? 1 : 0;
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

/**
 * Calcula o ciclo de fechamento (b) e o mês de competência/vencimento (c) de
 * uma compra. Ex.: compra 10/03/2026, fechamento 20, vencimento 5 →
 * `{ cycleMonthKey: "2026-03", dueMonthKey: "2026-04" }`.
 */
export function purchaseInvoice(
  purchaseDate: Date,
  closingDay: number,
  dueDay: number,
): PurchaseInvoice {
  const cycle = cycleTotal(purchaseDate, closingDay);
  return {
    cycleMonthKey: monthKeyFromTotal(cycle),
    dueMonthKey: monthKeyFromTotal(cycle + dueOffset(closingDay, dueDay)),
  };
}

/**
 * Rateia uma compra em parcelas, alocando cada uma à sua fatura (d) com a
 * competência de (c) e o rateio exato de (e).
 */
export function allocateInstallments(
  purchase: InstallmentPlanInput,
  closingDay: number,
  dueDay: number,
): Installment[] {
  const total = Math.max(purchase.installmentsTotal, 1);
  const baseAmount = Math.floor(purchase.amountCents / total);
  const remainder = purchase.amountCents - baseAmount * total;
  const firstCycle = cycleTotal(purchase.purchaseDate, closingDay);
  const offset = dueOffset(closingDay, dueDay);

  return Array.from({ length: total }, (_, index) => ({
    installmentNumber: index + 1,
    monthKey: monthKeyFromTotal(firstCycle + index + offset),
    amountCents: index === 0 ? baseAmount + remainder : baseAmount,
  }));
}

/**
 * Soma as parcelas cuja competência coincide com `monthKey`. Mês sem parcelas
 * retorna `0`; cada parcela entra em exatamente um mês.
 */
export function sumCardExpensesForMonth(
  purchases: CardPurchaseForMonth[],
  monthKey: string,
): number {
  return purchases.reduce((total, purchase) => {
    const installments = allocateInstallments(
      purchase,
      purchase.card.closingDay,
      purchase.card.dueDay,
    );
    return (
      total +
      installments
        .filter((installment) => installment.monthKey === monthKey)
        .reduce((sum, installment) => sum + installment.amountCents, 0)
    );
  }, 0);
}

/** Compra persistida, com os dados do cartão necessários à competência. */
export interface CardPurchaseRecord extends InstallmentPlanInput {
  id: string;
  description: string;
  category?: string | null;
  card: { id: string; name: string; closingDay: number; dueDay: number };
}

/** Uma parcela de uma compra que cai no mês de referência da fatura. */
export interface InvoiceLine {
  purchaseId: string;
  description: string;
  category: string | null;
  cardId: string;
  cardName: string;
  installmentNumber: number;
  installmentsTotal: number;
  amountCents: number;
}

export interface InvoiceMonth {
  monthKey: string;
  lines: InvoiceLine[];
  totalCents: number;
}

/**
 * Monta a fatura de um mês: uma linha por parcela cuja competência coincide com
 * `monthKey`, com os metadados da compra, e o total do mês. Compra à vista tem
 * uma única linha; parcela `k/N` é identificada por `installmentNumber`.
 *
 * Ordena por cartão, descrição, compra e número da parcela para uma leitura
 * estável entre cargas.
 */
export function invoiceLinesForMonth(
  purchases: CardPurchaseRecord[],
  monthKey: string,
): InvoiceMonth {
  const lines = purchases
    .flatMap((purchase) =>
      allocateInstallments(
        purchase,
        purchase.card.closingDay,
        purchase.card.dueDay,
      )
        .filter((installment) => installment.monthKey === monthKey)
        .map((installment) => ({
          purchaseId: purchase.id,
          description: purchase.description,
          category: purchase.category ?? null,
          cardId: purchase.card.id,
          cardName: purchase.card.name,
          installmentNumber: installment.installmentNumber,
          installmentsTotal: purchase.installmentsTotal,
          amountCents: installment.amountCents,
        })),
    )
    .sort(
      (a, b) =>
        a.cardName.localeCompare(b.cardName, "pt-BR") ||
        a.description.localeCompare(b.description, "pt-BR") ||
        a.purchaseId.localeCompare(b.purchaseId) ||
        a.installmentNumber - b.installmentNumber,
    );

  return {
    monthKey,
    lines,
    totalCents: lines.reduce((total, line) => total + line.amountCents, 0),
  };
}

/**
 * Resolve o mês de referência a partir do parâmetro `?mes=YYYY-MM`.
 * Valor ausente ou inválido cai no mês atual (ver SPEC, suposição (h)).
 */
export function resolveReferenceDate(
  mes: string | undefined,
  now: Date = new Date(),
): Date {
  if (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    const [year, month] = mes.split("-").map(Number);
    return zonedTimeToUtc(year, month, 1, resolveTimeZone());
  }
  return now;
}

/** Rótulo textual da competência exibida no dashboard. */
export function invoiceDueLabel(referenceDate: Date): string {
  const { year, month } = zonedDateParts(referenceDate, resolveTimeZone());
  return `Fatura com vencimento em ${MONTH_NAMES[month - 1]}/${year}`;
}
