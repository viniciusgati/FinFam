/**
 * Núcleo puro da lista de compras e do planejamento de gasto futuro.
 *
 * Nada aqui acessa banco de dados, rede ou relógio real: o "hoje" é sempre
 * injetado (`referenceDate`/`today` em `YYYY-MM-DD`) e a diária do ciclo é
 * recebida pronta. As funções apenas ordenam, agregam e formatam os números.
 */

import { formatCents } from "./money";

/** Classificação do item: consumível básico ou desejo adiável. */
export type ShoppingItemKind = "ESSENCIAL" | "DESEJAVEL";

/** Dias em que um desejo passa a ser considerado "adiado". */
export const STALE_DESIRABLE_DAYS = 30;

/** Máximo de itens exibidos no card do dashboard. */
export const DASHBOARD_ITEM_LIMIT = 8;

/**
 * Item da lista de compras, espelhando o modelo persistido. Datas de instante
 * aceitam `Date` ou string ISO; `addedOn` é sempre `YYYY-MM-DD` no fuso da
 * família.
 */
export interface ShoppingItem {
  id: string;
  name: string;
  kind: ShoppingItemKind;
  category: string | null;
  quantity: number;
  estimatedUnitPriceCents: number | null;
  priceSource?: string | null;
  priceSampleCount?: number;
  priceFetchedAt?: Date | string | null;
  purchased: boolean;
  purchasedAt?: Date | string | null;
  addedOn: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/** Resultado do planejamento da lista ativa. */
export interface ShoppingPlan {
  /** Soma de todos os itens com preço (unitário × quantidade). */
  totalCents: number;
  /** Parcela dos itens essenciais com preço. */
  essentialCents: number;
  /** Parcela dos itens desejáveis com preço. */
  desirableCents: number;
  /** Itens ativos (comprados não entram). */
  itemCount: number;
  /** Itens ativos sem preço válido. */
  unpricedCount: number;
  /** `ceil(total / diária)` quando a diária é positiva; senão `null`. */
  daysOfAllowance: number | null;
  /** Texto pronto: "Se comprar tudo agora: R$ … (≈ N dias da diária do ciclo)." */
  summary: string;
  /** "N itens sem preço" quando houver, senão `null`. */
  unpricedLabel: string | null;
}

const MILLISECONDS_PER_DAY = 86_400_000;

function parseIsoDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day);
}

/**
 * Converte um preço (número em reais ou texto pt-BR) para centavos inteiros.
 *
 * Aceita `12.5` → `1250` e `"R$ 1.234,56"` → `123456`. Texto vazio, malformado
 * ou negativo retorna `null`. Preço `0` é válido aqui (`0` centavos) e quem
 * consome trata `0` como "sem preço".
 */
export function parsePriceToCents(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }

  const text = value
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(/^(R\$|\$)/i, "");
  if (!text || !/^[\d.,]+$/.test(text)) return null;

  const hasComma = text.includes(",");
  let normalized: string;
  if (hasComma) {
    // pt-BR: ponto é separador de milhar, vírgula é decimal.
    normalized = text.replace(/\./g, "").replace(/,/g, ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // Só pontos em grupos de milhar: "1.234" são mil duzentos e trinta e quatro.
    normalized = text.replace(/\./g, "");
  } else {
    normalized = text;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const cents = Math.round(Number(normalized) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/**
 * Preço representativo de uma lista de amostras em centavos.
 *
 * Usa a moda; empate de frequência fica com o menor preço. Se nenhum preço se
 * repete, usa a mediana (com contagem par, a menor das duas centrais). Preços
 * `<= 0` ou não finitos são ignorados; sem amostras válidas retorna `null`.
 */
export function modePriceCents(prices: readonly number[]): number | null {
  const valid = prices
    .filter((price) => Number.isFinite(price) && price > 0)
    .map((price) => Math.round(price));
  if (valid.length === 0) return null;

  const frequencies = new Map<number, number>();
  for (const price of valid) {
    frequencies.set(price, (frequencies.get(price) ?? 0) + 1);
  }

  const maxFrequency = Math.max(...frequencies.values());
  if (maxFrequency > 1) {
    return Math.min(
      ...[...frequencies.entries()]
        .filter(([, frequency]) => frequency === maxFrequency)
        .map(([price]) => price),
    );
  }

  // Nenhum preço repetido: mediana, com a menor das duas centrais no par.
  const sorted = [...valid].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : sorted[middle - 1];
}

/**
 * Dias completos entre `addedOn` e `referenceDate` (ambos `YYYY-MM-DD`).
 * Datas inválidas ou futuras resultam em `0`.
 */
export function daysOnList(addedOn: string, referenceDate: string): number {
  const start = parseIsoDay(addedOn);
  const end = parseIsoDay(referenceDate);
  if (start === null || end === null) return 0;

  const days = Math.floor((end - start) / MILLISECONDS_PER_DAY);
  return days > 0 ? days : 0;
}

/**
 * Rótulo de tempo na lista: "hoje", "há 1 dia", "há N dias" e, a partir de
 * `STALE_DESIRABLE_DAYS`, com o sufixo " · adiado".
 *
 * O sufixo é controlado por `stale` (por padrão, pelos próprios dias) para que
 * a UI só o aplique a itens desejáveis, via `isStaleDesirable`.
 */
export function ageLabel(
  days: number,
  stale: boolean = days >= STALE_DESIRABLE_DAYS,
): string {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  const base =
    safeDays === 0
      ? "hoje"
      : safeDays === 1
        ? "há 1 dia"
        : `há ${safeDays} dias`;
  return stale ? `${base} · adiado` : base;
}

/** `true` apenas para item desejável com `STALE_DESIRABLE_DAYS` ou mais dias. */
export function isStaleDesirable(
  item: ShoppingItem,
  referenceDate: string,
): boolean {
  if (item.kind !== "DESEJAVEL") return false;
  return daysOnList(item.addedOn, referenceDate) >= STALE_DESIRABLE_DAYS;
}

/**
 * Lista ativa ordenada: essenciais primeiro, desejáveis ao final; dentro de cada
 * grupo do mais antigo para o mais novo e, no empate, por nome pt-BR. Itens
 * comprados são excluídos. Não muta a entrada.
 */
export function sortShoppingItems(items: readonly ShoppingItem[]): ShoppingItem[] {
  return items
    .filter((item) => !item.purchased)
    .slice()
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "ESSENCIAL" ? -1 : 1;
      if (a.addedOn !== b.addedOn) return a.addedOn < b.addedOn ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

/**
 * Recorte para o dashboard: ordena, limita a `limit` itens e informa quantos
 * ficaram de fora.
 */
export function previewShoppingItems(
  items: readonly ShoppingItem[],
  limit: number = DASHBOARD_ITEM_LIMIT,
): { items: ShoppingItem[]; hiddenCount: number } {
  const active = sortShoppingItems(items);
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : DASHBOARD_ITEM_LIMIT;
  return {
    items: active.slice(0, safeLimit),
    hiddenCount: Math.max(0, active.length - safeLimit),
  };
}

function lineTotalCents(item: ShoppingItem): number | null {
  const unit = item.estimatedUnitPriceCents;
  if (unit === null || unit === undefined) return null;
  if (!Number.isFinite(unit) || unit <= 0) return null;

  const quantity =
    Number.isFinite(item.quantity) && item.quantity > 0
      ? Math.trunc(item.quantity)
      : 1;

  return Math.round(unit) * quantity;
}

/**
 * Agrega a lista ativa em um plano de gasto. Só itens com preço válido entram
 * nos totais; os demais contam em `unpricedCount`. Não reserva nem altera
 * cálculos financeiros — apenas informa o impacto (`daysOfAllowance`).
 */
export function buildShoppingPlan(
  items: readonly ShoppingItem[],
  dailyAllowanceCents: number,
): ShoppingPlan {
  let totalCents = 0;
  let essentialCents = 0;
  let desirableCents = 0;
  let unpricedCount = 0;
  let itemCount = 0;

  for (const item of items) {
    if (item.purchased) continue;
    itemCount += 1;

    const lineTotal = lineTotalCents(item);
    if (lineTotal === null) {
      unpricedCount += 1;
      continue;
    }

    totalCents += lineTotal;
    if (item.kind === "ESSENCIAL") {
      essentialCents += lineTotal;
    } else {
      desirableCents += lineTotal;
    }
  }

  const hasAllowance =
    Number.isFinite(dailyAllowanceCents) && dailyAllowanceCents > 0;
  const daysOfAllowance = hasAllowance
    ? Math.ceil(totalCents / dailyAllowanceCents)
    : null;

  const value = formatCents(totalCents);
  const summary =
    daysOfAllowance === null
      ? `Se comprar tudo agora: ${value}.`
      : `Se comprar tudo agora: ${value} (≈ ${daysOfAllowance} dias da diária do ciclo).`;

  const unpricedLabel =
    unpricedCount > 0
      ? `${unpricedCount} ${unpricedCount === 1 ? "item" : "itens"} sem preço`
      : null;

  return {
    totalCents,
    essentialCents,
    desirableCents,
    itemCount,
    unpricedCount,
    daysOfAllowance,
    summary,
    unpricedLabel,
  };
}
