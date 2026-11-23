import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  deleteShoppingItem,
  updateShoppingItem,
  updateShoppingItemSchema,
} from "@/lib/shopping-items";
import { firstErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const notFound = () =>
  NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

/**
 * Atualiza só os campos enviados. `addedOn` nunca é aceito aqui; marcar como
 * comprado (`purchased: true`) preenche `purchasedAt`.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateShoppingItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: firstErrorMessage(parsed.error),
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const existing = await prisma.shoppingItem.findUnique({ where: { id } });
  if (!existing) return notFound();

  const updated = await updateShoppingItem(id, parsed.data);
  if (!updated) return notFound();

  return NextResponse.json(updated);
}

/** Remove o item definitivamente. */
export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;

  const existing = await prisma.shoppingItem.findUnique({ where: { id } });
  if (!existing) return notFound();

  await deleteShoppingItem(id);

  return new NextResponse(null, { status: 204 });
}
