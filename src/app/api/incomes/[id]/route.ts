import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  firstErrorMessage,
  incomeUpdateSchema,
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
  const parsed = incomeUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.income.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
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

  const income = await prisma.income.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(income);
}
