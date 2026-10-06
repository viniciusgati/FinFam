import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateVariableExpenseSchema } from "@/lib/variable-expenses";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const notFound = () =>
  NextResponse.json({ error: "Gasto não encontrado" }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;
  const expense = await prisma.variableExpense.findUnique({ where: { id } });

  if (!expense) return notFound();
  return NextResponse.json(expense);
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateVariableExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const existing = await prisma.variableExpense.findUnique({ where: { id } });
  if (!existing) return notFound();

  const updated = await prisma.variableExpense.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;
  const existing = await prisma.variableExpense.findUnique({ where: { id } });
  if (!existing) return notFound();

  await prisma.variableExpense.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
