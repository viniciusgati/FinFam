import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  adjustmentPurchaseDate,
  computeInvoiceAdjustment,
} from "@/lib/invoice-adjustment";
import { formatCents } from "@/lib/money";
import { firstErrorMessage, invoiceSetTotalSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Define o total da fatura de um cartão num mês (história #231).
 *
 * O ajuste é somente para cima: se `totalCents` for maior que o total já
 * lançado no mês, cria um `CardPurchase` à vista com a diferença (descrição
 * "Ajuste de fatura", categoria "Ajuste"); se for igual, é no-op; se for
 * menor, responde 400 sem criar nada.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = invoiceSetTotalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { cardId, monthKey, totalCents } = parsed.data;

  const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
  if (!card) {
    return NextResponse.json({ error: "Cartão não encontrado" }, { status: 400 });
  }

  const purchases = await prisma.cardPurchase.findMany({
    where: { cardId },
    include: { card: true },
  });

  const { currentCents, diffCents } = computeInvoiceAdjustment(
    purchases,
    cardId,
    monthKey,
    totalCents,
  );

  if (diffCents < 0) {
    return NextResponse.json(
      {
        error: `O total-alvo (${formatCents(totalCents)}) é menor que o total já lançado (${formatCents(currentCents)}). Para corrigir para baixo, exclua/edite lançamentos existentes.`,
      },
      { status: 400 },
    );
  }

  if (diffCents === 0) {
    return NextResponse.json({ created: false, currentCents });
  }

  const purchaseDate = adjustmentPurchaseDate(
    { closingDay: card.closingDay, dueDay: card.dueDay },
    monthKey,
  );

  const purchase = await prisma.cardPurchase.create({
    data: {
      cardId,
      description: "Ajuste de fatura",
      amountCents: diffCents,
      purchaseDate,
      category: "Ajuste",
      installmentNumber: 1,
      installmentsTotal: 1,
    },
    include: { card: true },
  });

  return NextResponse.json(purchase, { status: 201 });
}
