import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { creditCardUpdateSchema, firstErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = creditCardUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.creditCard.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
  }

  const card = await prisma.creditCard.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(card);
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  const existing = await prisma.creditCard.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });
  }

  const purchases = await prisma.cardPurchase.count({ where: { cardId: id } });
  if (purchases > 0) {
    return NextResponse.json(
      {
        error:
          "Cartão possui compras cadastradas. Desative-o em vez de excluir.",
      },
      { status: 409 },
    );
  }

  await prisma.creditCard.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
