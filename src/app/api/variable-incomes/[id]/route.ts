import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateVariableIncomeSchema } from "@/lib/variable-incomes";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const notFound = () =>
  NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;
  const income = await prisma.variableIncome.findUnique({ where: { id } });

  if (!income) return notFound();
  return NextResponse.json(income);
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateVariableIncomeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const existing = await prisma.variableIncome.findUnique({ where: { id } });
  if (!existing) return notFound();

  const updated = await prisma.variableIncome.update({
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
  const existing = await prisma.variableIncome.findUnique({ where: { id } });
  if (!existing) return notFound();

  await prisma.variableIncome.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
