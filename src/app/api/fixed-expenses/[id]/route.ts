import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  firstErrorMessage,
  fixedExpenseUpdateSchema,
  isPeriodValid,
} from "@/lib/validation";

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
  const parsed = fixedExpenseUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.fixedExpense.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Saída não encontrada" }, { status: 404 });
  }

  const nextStart =
    "startMonth" in parsed.data ? parsed.data.startMonth : existing.startMonth;
  const nextEnd =
    "endMonth" in parsed.data ? parsed.data.endMonth : existing.endMonth;
  if (!isPeriodValid(nextStart, nextEnd)) {
    return NextResponse.json(
      { error: "Mês final não pode ser anterior ao inicial" },
      { status: 400 },
    );
  }

  const fixedExpense = await prisma.fixedExpense.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(fixedExpense);
}
