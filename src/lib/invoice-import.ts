/**
 * Regras puras da importação de fatura CSV (história #269, subtarefa 2).
 *
 * Nenhuma função aqui acessa banco de dados ou rede — só reaproveita as
 * regras de ciclo/competência de `invoices.ts` (`purchaseInvoice`/`dueOffset`
 * e `allocateInstallments`) sobre as linhas já parseadas do CSV:
 *
 * 1. `detectInvoiceCompetence` — a competência da fatura é a **moda** das
 *    linhas (maior número de linhas); empate de linhas vence quem tem maior
 *    soma absoluta de valores; empate de soma, o mês mais recente.
 * 2. `planInvoiceImport` — monta o plano de substituição: ajusta a data das
 *    linhas da **minoria discordante** com o menor deslocamento que as cai na
 *    janela do ciclo detectado (valor original preservado), marca para
 *    exclusão apenas compras **à vista** da competência alvo (inclui
 *    "Ajuste de fatura" e gastos manuais), **nunca** parceladas, e casa
 *    linhas `… - Parcela k/N` com parceladas existentes de mesma
 *    descrição-base, mesmo N e valor igual à k-ésima parcela.
 *
 * Linhas negativas (pagamentos/estornos) e inválidas não entram no plano:
 * chegam aqui como `ignored`, já contadas pelo parser.
 */

import { shiftMonthKey } from "./finance";
import type { InvoiceCsvRow } from "./invoice-csv";
import {
  allocateInstallments,
  dueOffset,
  purchaseInvoice,
} from "./invoices";

/** Regras de ciclo do cartão usadas na detecção e no ajuste de datas. */
export interface InvoiceImportCard {
  closingDay: number;
  dueDay: number;
}

/**
 * Mensagem fixa de falha da importação (história #269): usada pela rota em
 * erros de gravação (500) e pela UI em falha de rede/JSON, garantindo o mesmo
 * texto pt-BR nos dois caminhos.
 */
export const IMPORT_FAILURE_MESSAGE =
  "Não foi possível importar a fatura. Tente novamente.";

/** Compra já persistida, no mínimo shape para excluir/casar no plano. */
export interface InvoiceImportExistingPurchase {
  id: string;
  description: string;
  purchaseDate: Date;
  amountCents: number;
  installmentsTotal: number;
}

/** Linha cuja data foi ajustada para dentro da janela do ciclo detectado. */
export interface InvoiceImportAdjustedRow {
  /** Número da linha no arquivo CSV. */
  line: number;
  /** Data original (`YYYY-MM-DD`). */
  date: string;
  /** Data final, mínima dentro da janela da competência detectada. */
  adjustedDate: string;
}

/** Linha a inserir como compra à vista (`installmentsTotal = 1`). */
export interface InvoiceImportInsertRow {
  line: number;
  /** Data final (`YYYY-MM-DD`), já ajustada quando discordante. */
  date: string;
  title: string;
  amountCents: number;
}

export interface InvoiceImportPlan {
  /** Competência detectada (moda); `null` quando não há nenhuma linha. */
  monthKey: string | null;
  /** Ids das compras **à vista** da competência alvo a apagar. */
  toDeleteIds: string[];
  /** Linhas a criar como compras à vista (data já ajustada). */
  toInsert: InvoiceImportInsertRow[];
  /** Linhas casadas com parcelada existente: mantidas, não reinseridas. */
  toSkipMatched: InvoiceCsvRow[];
  /** Negativas + inválidas do parser (não viram lançamento). */
  ignored: number;
  /** Linhas da minoria cuja data foi ajustada (valor original preservado). */
  adjustedRows: InvoiceImportAdjustedRow[];
}

/** Sufítulo Nubank de parcela: `… - Parcela 2/8`. */
const PARCELA_SUFFIX = /\s+-\s*Parcela\s+(\d+)\s*\/\s*(\d+)$/i;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Competência (mês de vencimento) de uma data `YYYY-MM-DD` pelas regras do
 * cartão — mesmo caminho de `purchaseInvoice`, com data construída ao meio-dia
 * UTC (convenção do projeto: dia exato em qualquer fuso do processo).
 */
function competenceOfIsoDate(isoDate: string, card: InvoiceImportCard): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return purchaseInvoice(
    new Date(Date.UTC(year, month - 1, day, 12)),
    card.closingDay,
    card.dueDay,
  ).dueMonthKey;
}

/** Competência de uma compra persistida (mesma regra usada na fatura). */
function competenceOfPurchase(
  purchaseDate: Date,
  card: InvoiceImportCard,
): string {
  return purchaseInvoice(purchaseDate, card.closingDay, card.dueDay)
    .dueMonthKey;
}

/**
 * Primeiro dia (`YYYY-MM-DD`) cuja competência é `monthKey`: as datas do mês
 * de ciclo anterior com dia `> closingDay` já pertencem ao ciclo de
 * `monthKey` (fechamento inclusivo); se o mês anterior não tem dia além do
 * fechamento, a janela começa no dia 1 do mês de ciclo.
 */
function windowStartIso(monthKey: string, card: InvoiceImportCard): string {
  const cycle = shiftMonthKey(monthKey, -dueOffset(card.closingDay, card.dueDay));
  const previous = shiftMonthKey(cycle, -1);
  const [previousYear, previousMonth] = previous.split("-").map(Number);
  if (card.closingDay < daysInMonth(previousYear, previousMonth)) {
    return `${previous}-${pad2(card.closingDay + 1)}`;
  }
  return `${cycle}-01`;
}

/** Último dia (`YYYY-MM-DD`, inclusivo) cuja competência é `monthKey`. */
function windowEndIso(monthKey: string, card: InvoiceImportCard): string {
  const cycle = shiftMonthKey(monthKey, -dueOffset(card.closingDay, card.dueDay));
  const [year, month] = cycle.split("-").map(Number);
  return `${cycle}-${pad2(Math.min(card.closingDay, daysInMonth(year, month)))}`;
}

/**
 * Desloca a data para dentro de `[startIso, endIso]` com o menor deslocamento
 * possível: para datas anteriores à janela, a própria borda inicial já é o
 * ajuste mínimo (ex.: 13/08 com fechamento 13 → 14/08); para datas
 * posteriores, a borda final.
 */
function clampToWindow(
  isoDate: string,
  startIso: string,
  endIso: string,
): string {
  if (isoDate < startIso) return startIso;
  if (isoDate > endIso) return endIso;
  return isoDate;
}

/**
 * Competência da fatura pela **maioria** das linhas: moda de linhas; empate
 * de linhas → maior soma absoluta de valores; empate de soma → mês mais
 * recente. Sem linhas → `null`.
 */
export function detectInvoiceCompetence(
  lines: InvoiceCsvRow[],
  card: InvoiceImportCard,
): string | null {
  if (lines.length === 0) return null;

  const stats = new Map<string, { count: number; sumAbs: number }>();
  for (const line of lines) {
    const key = competenceOfIsoDate(line.date, card);
    const current = stats.get(key);
    if (current) {
      current.count += 1;
      current.sumAbs += Math.abs(line.amountCents);
    } else {
      stats.set(key, { count: 1, sumAbs: Math.abs(line.amountCents) });
    }
  }

  let best: string | null = null;
  let bestCount = -1;
  let bestSumAbs = -1;
  for (const [key, { count, sumAbs }] of stats) {
    const isBetter =
      count > bestCount ||
      (count === bestCount && sumAbs > bestSumAbs) ||
      (count === bestCount &&
        sumAbs === bestSumAbs &&
        (best === null || key > best));
    if (isBetter) {
      best = key;
      bestCount = count;
      bestSumAbs = sumAbs;
    }
  }
  return best;
}

/**
 * Casa uma linha `… - Parcela k/N` com uma parcelada existente (`N >= 2`) de
 * mesma descrição-base, mesmo N e valor igual à k-ésima parcela (rateio de
 * `allocateInstallments`). Cada parcelada casa no máximo uma linha.
 */
function matchInstallmentLine(
  line: InvoiceCsvRow,
  candidates: InvoiceImportExistingPurchase[],
  card: InvoiceImportCard,
  usedIds: Set<string>,
): InvoiceImportExistingPurchase | null {
  const suffix = PARCELA_SUFFIX.exec(line.title);
  if (!suffix) return null;

  const installmentNumber = Number(suffix[1]);
  const installmentsTotal = Number(suffix[2]);
  if (
    installmentNumber < 1 ||
    installmentsTotal < 2 ||
    installmentNumber > installmentsTotal
  ) {
    return null;
  }

  const base = line.title.slice(0, suffix.index).trim();
  if (!base) return null;

  for (const purchase of candidates) {
    if (usedIds.has(purchase.id)) continue;
    if (purchase.installmentsTotal !== installmentsTotal) continue;
    if (purchase.description.trim() !== base) continue;

    const installments = allocateInstallments(
      {
        purchaseDate: purchase.purchaseDate,
        amountCents: purchase.amountCents,
        installmentsTotal: purchase.installmentsTotal,
      },
      card.closingDay,
      card.dueDay,
    );
    const target = installments[installmentNumber - 1];
    if (target && target.amountCents === line.amountCents) return purchase;
  }
  return null;
}

/**
 * Monta o plano de substituição da competência detectada pela maioria das
 * `lines` (positivas) no cartão `card`. `existing` deve conter apenas as
 * compras do cartão escolhido; `ignored` é a contagem de negativas +
 * inválidas vinda do parser.
 *
 * Sem linhas válidas devolve `monthKey: null` e plano vazio (a rota responde
 * 400 antes de persistir qualquer coisa).
 */
export function planInvoiceImport(input: {
  lines: InvoiceCsvRow[];
  card: InvoiceImportCard;
  existing: InvoiceImportExistingPurchase[];
  ignored: number;
}): InvoiceImportPlan {
  const { lines, card, existing, ignored } = input;
  const monthKey = detectInvoiceCompetence(lines, card);
  if (monthKey === null) {
    return {
      monthKey: null,
      toDeleteIds: [],
      toInsert: [],
      toSkipMatched: [],
      ignored,
      adjustedRows: [],
    };
  }

  const startIso = windowStartIso(monthKey, card);
  const endIso = windowEndIso(monthKey, card);

  const toDeleteIds = existing
    .filter(
      (purchase) =>
        purchase.installmentsTotal === 1 &&
        competenceOfPurchase(purchase.purchaseDate, card) === monthKey,
    )
    .map((purchase) => purchase.id);

  const parceladaCandidates = existing.filter(
    (purchase) => purchase.installmentsTotal > 1,
  );
  const usedIds = new Set<string>();
  const toSkipMatched: InvoiceCsvRow[] = [];
  const pending: InvoiceCsvRow[] = [];

  for (const line of lines) {
    const matched = matchInstallmentLine(line, parceladaCandidates, card, usedIds);
    if (matched) {
      usedIds.add(matched.id);
      toSkipMatched.push(line);
    } else {
      pending.push(line);
    }
  }

  const adjustedRows: InvoiceImportAdjustedRow[] = [];
  const toInsert = pending.map((line) => {
    const date = clampToWindow(line.date, startIso, endIso);
    if (date !== line.date) {
      adjustedRows.push({ line: line.line, date: line.date, adjustedDate: date });
    }
    return { line: line.line, date, title: line.title, amountCents: line.amountCents };
  });

  return { monthKey, toDeleteIds, toInsert, toSkipMatched, ignored, adjustedRows };
}
