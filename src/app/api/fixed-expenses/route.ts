import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { firstErrorMessage, fixedExpenseCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

const ORDER_BY = [{ name: "asc" }, { id: "asc" }] as const;

export async function GET(): Promise<NextResponse> {
  const fixedExpenses = await prisma.fixedExpense.findMany({
    orderBy: [...ORDER_BY],
  });
  return NextResponse.json(fixedExpenses);
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = fixedExpenseCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const fixedExpense = await prisma.fixedExpense.create({ data: parsed.data });
  return NextResponse.json(fixedExpense, { status: 201 });
}
