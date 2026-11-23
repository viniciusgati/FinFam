import { NextResponse } from "next/server";
import {
  createShoppingItem,
  createShoppingItemSchema,
  loadActiveShoppingItems,
} from "@/lib/shopping-items";
import { firstErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

/** Lista ativa já ordenada: essenciais primeiro, depois desejáveis. */
export async function GET(): Promise<NextResponse> {
  const items = await loadActiveShoppingItems();
  return NextResponse.json(items);
}

/** Cria um item. Retorna 201 com `Location` apontando para o item. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = createShoppingItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: firstErrorMessage(parsed.error),
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const created = await createShoppingItem(parsed.data);

  return NextResponse.json(created, {
    status: 201,
    headers: { Location: `/api/shopping-items/${created.id}` },
  });
}
