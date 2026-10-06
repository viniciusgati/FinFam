import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cardPurchaseCreateSchema, firstErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const ORDER_BY = [{ purchaseDate: "asc" }, { id: "asc" }] as const;

/** Limite [início, fim) do mês `YYYY-MM`, ou `undefined` sem filtro. */
function purchaseDateFilter(mes: string | null) {
  if (!mes || !MONTH_REGEX.test(mes)) return undefined;
  const [year, month] = mes.split("-").map(Number);
  return {
    purchaseDate: {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    },
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const where = purchaseDateFilter(searchParams.get("mes"));

  const purchases = await prisma.cardPurchase.findMany({
    where,
    orderBy: [...ORDER_BY],
    include: { card: true },
  });
  return NextResponse.json(purchases);
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = cardPurchaseCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const card = await prisma.creditCard.findUnique({
    where: { id: parsed.data.cardId },
  });
  if (!card) {
    return NextResponse.json({ error: "Cartão não encontrado" }, { status: 400 });
  }

  const purchase = await prisma.cardPurchase.create({
    data: parsed.data,
    include: { card: true },
  });
  return NextResponse.json(purchase, { status: 201 });
}
