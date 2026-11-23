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
import { z } from "zod";
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

/** Mensagens de validação compartilhadas com a UI (textos exatos). */
export const SHOPPING_NAMES = {
  nameRequired: "Informe um nome",
  quantityRange: "Informe uma quantidade entre 1 e 999",
  kindRequired: "Escolha essencial ou desejável",
  priceInvalid: "Informe um preço válido",
} as const;

const shoppingKindSchema = z.enum(["ESSENCIAL", "DESEJAVEL"], {
  errorMap: () => ({ message: SHOPPING_NAMES.kindRequired }),
});

const shoppingNameSchema = z
  .string()
  .trim()
  .min(1, SHOPPING_NAMES.nameRequired)
  .max(120, "O nome deve ter no máximo 120 caracteres");

const shoppingQuantitySchema = z
  .number({
    invalid_type_error: SHOPPING_NAMES.quantityRange,
  })
  .int(SHOPPING_NAMES.quantityRange)
  .min(1, SHOPPING_NAMES.quantityRange)
  .max(999, SHOPPING_NAMES.quantityRange);

const shoppingCategorySchema = z
  .string()
  .trim()
  .max(120, "A categoria deve ter no máximo 120 caracteres")
  .nullish();

const shoppingPriceSchema = z
  .number({ invalid_type_error: SHOPPING_NAMES.priceInvalid })
  .int(SHOPPING_NAMES.priceInvalid)
  .min(0, SHOPPING_NAMES.priceInvalid)
  .nullish();

const shoppingItemFields = {
  name: shoppingNameSchema,
  kind: shoppingKindSchema,
  category: shoppingCategorySchema,
  quantity: shoppingQuantitySchema,
  estimatedUnitPriceCents: shoppingPriceSchema,
};

/** Corpo aceito no `POST /api/shopping-items` (quantidade default 1). */
export const createShoppingItemSchema = z.object({
  ...shoppingItemFields,
  quantity: shoppingQuantitySchema.default(1),
});

/**
 * Corpo aceito no `PATCH /api/shopping-items/[id]`: todos os campos opcionais e
 * nenhum `addedOn` (o dia de inclusão é imutável).
 */
export const updateShoppingItemSchema = z
  .object({
    ...shoppingItemFields,
    purchased: z.boolean(),
  })
  .partial();

export type CreateShoppingItemPayload = z.infer<
  typeof createShoppingItemSchema
>;
export type UpdateShoppingItemPayload = z.infer<
  typeof updateShoppingItemSchema
>;

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
