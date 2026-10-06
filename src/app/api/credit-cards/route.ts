import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { creditCardCreateSchema, firstErrorMessage } from "@/lib/validation";

export const runtime = "nodejs";

const ORDER_BY = [{ name: "asc" }, { id: "asc" }] as const;

export async function GET(): Promise<NextResponse> {
  const cards = await prisma.creditCard.findMany({ orderBy: [...ORDER_BY] });
  return NextResponse.json(cards);
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = creditCardCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const card = await prisma.creditCard.create({ data: parsed.data });
  return NextResponse.json(card, { status: 201 });
}
