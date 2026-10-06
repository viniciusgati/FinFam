import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { firstErrorMessage, incomeCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

const ORDER_BY = [{ name: "asc" }, { id: "asc" }] as const;

export async function GET(): Promise<NextResponse> {
  const incomes = await prisma.income.findMany({ orderBy: [...ORDER_BY] });
  return NextResponse.json(incomes);
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = incomeCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const income = await prisma.income.create({ data: parsed.data });
  return NextResponse.json(income, { status: 201 });
}
