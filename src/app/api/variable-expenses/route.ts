import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createVariableExpenseSchema,
  currentMonthParam,
  isValidMonthParam,
  monthRange,
} from "@/lib/variable-expenses";

export const runtime = "nodejs";

/**
 * Lista os gastos avulsos de um mês (`?mes=YYYY-MM`, padrão: mês corrente).
 * A comparação é feita em UTC com intervalo semiaberto `[início, início+1mês)`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes");

  if (mes !== null && !isValidMonthParam(mes)) {
    return NextResponse.json(
      { error: "O parâmetro 'mes' deve estar no formato YYYY-MM" },
      { status: 400 },
    );
  }

  const month = isValidMonthParam(mes) ? mes : currentMonthParam();
  const { gte, lt } = monthRange(month);

  const expenses = await prisma.variableExpense.findMany({
    where: { date: { gte, lt } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(expenses);
}

/** Cria um gasto avulso. Retorna 201 com `Location` apontando para o item. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = createVariableExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const created = await prisma.variableExpense.create({ data: parsed.data });

  return NextResponse.json(created, {
    status: 201,
    headers: { Location: `/api/variable-expenses/${created.id}` },
  });
}
