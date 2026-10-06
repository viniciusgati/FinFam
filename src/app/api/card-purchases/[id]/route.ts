import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cardPurchaseUpdateSchema, firstErrorMessage } from "@/lib/validation";

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
  const parsed = cardPurchaseUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.cardPurchase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Compra não encontrada" },
      { status: 404 },
    );
  }

  if (parsed.data.cardId) {
    const card = await prisma.creditCard.findUnique({
      where: { id: parsed.data.cardId },
    });
    if (!card) {
      return NextResponse.json(
        { error: "Cartão não encontrado" },
        { status: 400 },
      );
    }
  }

  const nextNumber = parsed.data.installmentNumber ?? existing.installmentNumber;
  const nextTotal = parsed.data.installmentsTotal ?? existing.installmentsTotal;
  if (nextNumber > nextTotal) {
    return NextResponse.json(
      { error: "A parcela não pode ser maior que o total de parcelas" },
      { status: 400 },
    );
  }

  const purchase = await prisma.cardPurchase.update({
    where: { id },
    data: parsed.data,
    include: { card: true },
  });
  return NextResponse.json(purchase);
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  const existing = await prisma.cardPurchase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Compra não encontrada" },
      { status: 404 },
    );
  }

  await prisma.cardPurchase.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
