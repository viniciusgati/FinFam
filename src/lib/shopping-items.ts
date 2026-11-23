/**
 * Persistência da lista de compras da família (história #376).
 *
 * A ordenação, a idade e o planejamento ficam em `shopping-list.ts` (puro);
 * aqui só há leitura/escrita no banco e a tradução da linha do Prisma para o
 * tipo de domínio. `addedOn` é `YYYY-MM-DD` no fuso da família e nunca é
 * alterado por `updateShoppingItem`.
 *
 * Preço `0` ou ausente é lido como "sem preço" (`null`), conforme o contrato
 * da UI e do planejamento.
 */

import type { ShoppingItem as ShoppingItemRow } from "@prisma/client";
import { prisma } from "./db";
import { todayISO } from "./quick-expense";
import {
  sortShoppingItems,
  type ShoppingItem,
  type ShoppingItemKind,
} from "./shopping-list";
import { resolveTimeZone } from "./time";

export interface CreateShoppingItemInput {
  name: string;
  kind: ShoppingItemKind;
  category?: string | null;
  quantity?: number;
  estimatedUnitPriceCents?: number | null;
  /** Sobrescreve o default (`hoje` no fuso da família); útil em importações. */
  addedOn?: string;
}

export interface UpdateShoppingItemInput {
  name?: string;
  kind?: ShoppingItemKind;
  category?: string | null;
  quantity?: number;
  estimatedUnitPriceCents?: number | null;
  priceSource?: string | null;
  priceSampleCount?: number;
  priceFetchedAt?: Date | null;
  purchased?: boolean;
  purchasedAt?: Date | null;
}

/** `0`, negativo, `NaN` ou ausente significa "sem preço". */
function readPriceCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Converte a linha do Prisma no item de domínio (preço sem valor vira null). */
export function toShoppingItem(row: ShoppingItemRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ShoppingItemKind,
    category: row.category,
    quantity: row.quantity,
    estimatedUnitPriceCents: readPriceCents(row.estimatedUnitPriceCents),
    priceSource: row.priceSource,
    priceSampleCount: row.priceSampleCount,
    priceFetchedAt: row.priceFetchedAt,
    purchased: row.purchased,
    purchasedAt: row.purchasedAt,
    addedOn: row.addedOn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

/**
 * Itens ativos (não comprados) já na ordem de exibição: essenciais primeiro,
 * do mais antigo para o mais novo, com desempate por nome pt-BR.
 */
export async function loadActiveShoppingItems(): Promise<ShoppingItem[]> {
  const rows = await prisma.shoppingItem.findMany({
    where: { purchased: false },
    orderBy: [{ addedOn: "asc" }, { id: "asc" }],
  });
  return sortShoppingItems(rows.map(toShoppingItem));
}

/** Item pelo id, ou `null` quando não existe. */
export async function getShoppingItem(
  id: string,
): Promise<ShoppingItem | null> {
  const row = await prisma.shoppingItem.findUnique({ where: { id } });
  return row ? toShoppingItem(row) : null;
}

/**
 * Cria um item. Sem `addedOn` explícito, grava o dia corrente no fuso da
 * família (`now` é injetável para testes).
 */
export async function createShoppingItem(
  input: CreateShoppingItemInput,
  now: Date = new Date(),
): Promise<ShoppingItem> {
  const row = await prisma.shoppingItem.create({
    data: {
      name: input.name.trim(),
      kind: input.kind,
      category: trimOrNull(input.category),
      quantity: input.quantity ?? 1,
      estimatedUnitPriceCents: input.estimatedUnitPriceCents ?? null,
      addedOn: input.addedOn ?? todayISO(now, resolveTimeZone()),
    },
  });
  return toShoppingItem(row);
}

/**
 * Atualiza só os campos enviados. `addedOn` é imutável: mesmo que apareça no
 * input, é ignorado. Marcar como comprado preenche `purchasedAt` quando não
 * vier explicitamente. Devolve `null` se o id não existe.
 */
export async function updateShoppingItem(
  id: string,
  input: UpdateShoppingItemInput,
  now: Date = new Date(),
): Promise<ShoppingItem | null> {
  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.category !== undefined) data.category = trimOrNull(input.category);
  if (input.quantity !== undefined) data.quantity = input.quantity;
  if (input.estimatedUnitPriceCents !== undefined) {
    data.estimatedUnitPriceCents = input.estimatedUnitPriceCents;
  }
  if (input.priceSource !== undefined) data.priceSource = input.priceSource;
  if (input.priceSampleCount !== undefined) {
    data.priceSampleCount = input.priceSampleCount;
  }
  if (input.priceFetchedAt !== undefined) {
    data.priceFetchedAt = input.priceFetchedAt;
  }
  if (input.purchased !== undefined) {
    data.purchased = input.purchased;
    data.purchasedAt = input.purchased
      ? (input.purchasedAt ?? now)
      : null;
  } else if (input.purchasedAt !== undefined) {
    data.purchasedAt = input.purchasedAt;
  }

  if (Object.keys(data).length === 0) {
    return getShoppingItem(id);
  }

  try {
    const row = await prisma.shoppingItem.update({ where: { id }, data });
    return toShoppingItem(row);
  } catch (error) {
    if (isRecordNotFound(error)) return null;
    throw error;
  }
}

/** Remove o item; `false` quando o id não existe. */
export async function deleteShoppingItem(id: string): Promise<boolean> {
  try {
    await prisma.shoppingItem.delete({ where: { id } });
    return true;
  } catch (error) {
    if (isRecordNotFound(error)) return false;
    throw error;
  }
}
