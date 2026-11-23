import { NextResponse } from "next/server";
import { getShoppingItem, updateShoppingItem } from "@/lib/shopping-items";
import { modePriceCents } from "@/lib/shopping-list";
import {
  PRICE_SOURCE_NAME,
  PriceSearchError,
  PriceSourceUnavailableError,
  searchGoogleShoppingPrices,
} from "@/lib/shopping/price-source";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const notFound = () =>
  NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

/**
 * Pesquisa o preço unitário do item no Google Shopping (via SerpAPI).
 *
 * Só o nome do item é enviado ao provedor. Contrato de resposta:
 * - `200 { updated: true, item }` — preço atualizado (moda das amostras);
 * - `200 { updated: false, item }` — nenhuma amostra válida; preço anterior
 *   preservado (a UI trata como "Não encontramos preços para este item.");
 * - `503 { error: "price_source_unavailable" }` — sem `PRICE_SEARCH_API_KEY`,
 *   sem chamar o provedor;
 * - `502 { error: "price_source_failed" }` — falha/timeout do provedor, sem
 *   alterar o item;
 * - `404 { error: "Item não encontrado" }`.
 */
export async function POST(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;

  const item = await getShoppingItem(id);
  if (!item) return notFound();

  let prices: number[];
  try {
    prices = await searchGoogleShoppingPrices(item.name);
  } catch (error) {
    if (error instanceof PriceSourceUnavailableError) {
      return NextResponse.json(
        { error: "price_source_unavailable" },
        { status: 503 },
      );
    }
    if (error instanceof PriceSearchError) {
      return NextResponse.json(
        { error: "price_source_failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "price_source_failed" }, { status: 502 });
  }

  const mode = modePriceCents(prices);
  if (mode === null) {
    return NextResponse.json({ updated: false, item });
  }

  const updated = await updateShoppingItem(id, {
    estimatedUnitPriceCents: mode,
    priceSampleCount: prices.length,
    priceSource: PRICE_SOURCE_NAME,
    priceFetchedAt: new Date(),
  });
  if (!updated) return notFound();

  return NextResponse.json({ updated: true, item: updated });
}
