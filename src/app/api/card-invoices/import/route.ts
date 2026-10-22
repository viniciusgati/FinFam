import { NextResponse } from "next/server";
import { classifyInvoiceTitles } from "@/lib/ai/invoice-category";
import { loadCategorySuggestions } from "@/lib/category-suggestions";
import { prisma } from "@/lib/db";
import { parseNubankInvoiceCsv } from "@/lib/invoice-csv";
import {
  IMPORT_FAILURE_MESSAGE,
  planInvoiceImport,
} from "@/lib/invoice-import";
import { resolveTimeZone, zonedTimeToUtc } from "@/lib/time";
import { firstErrorMessage, invoiceImportSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Mensagem quando o CSV não tem nenhuma linha importável. */
const NO_VALID_ROWS_ERROR =
  "O CSV não tem nenhuma linha válida para importar.";

/**
 * Data de compra (`YYYY-MM-DD`) como meia-noite no fuso da família, mesma
 * convenção de `adjustmentPurchaseDate` (história #231): o dia calendário é
 * o do CSV em qualquer `TZ` de processo.
 */
function purchaseDateFromIso(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return zonedTimeToUtc(year, month, day, resolveTimeZone());
}

/**
 * Categorias para os títulos a inserir: match local primeiro (histórico de
 * compras categorizadas da família) e o restante em uma única chamada em lote
 * à DeepSeek. Qualquer falha vira `null` por título — a importação nunca é
 * bloqueada por causa da IA (exceção documentada à SPEC §7).
 */
async function classifyImportedTitles(
  titles: string[],
): Promise<(string | null)[]> {
  if (titles.length === 0) return [];
  try {
    const [suggestions, history] = await Promise.all([
      loadCategorySuggestions(),
      prisma.cardPurchase.findMany({
        where: { category: { not: null } },
        select: { description: true, category: true },
      }),
    ]);
    const existingByTitle = new Map(
      history.map((row) => [row.description, row.category]),
    );
    return await classifyInvoiceTitles(titles, suggestions, existingByTitle);
  } catch {
    return titles.map(() => null);
  }
}

/**
 * Importa o CSV da fatura de um cartão (história #269).
 *
 * `dryRun: true` responde com o plano (competência, contagens e total) sem
 * nenhuma escrita. A confirmação classifica os títulos (best-effort) e troca
 * os lançamentos à vista da competência detectada numa **única transação**:
 * exclusão + inserção ou nada. Substitui apenas compras à vista — as
 * parceladas permanecem e as linhas `… - Parcela k/N` casadas não são
 * reinseridas (regras em `src/lib/invoice-import.ts`).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const parsed = invoiceImportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { cardId, csv, dryRun } = parsed.data;

  const parsedCsv = parseNubankInvoiceCsv(csv);
  if (parsedCsv.headerError) {
    return NextResponse.json(
      { error: parsedCsv.headerError },
      { status: 400 },
    );
  }
  if (parsedCsv.positives.length === 0) {
    return NextResponse.json({ error: NO_VALID_ROWS_ERROR }, { status: 400 });
  }

  const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
  if (!card) {
    return NextResponse.json({ error: "Cartão não encontrado" }, { status: 400 });
  }

  const existing = await prisma.cardPurchase.findMany({ where: { cardId } });
  const plan = planInvoiceImport({
    lines: parsedCsv.positives,
    card,
    existing,
    ignored: parsedCsv.negatives.length + parsedCsv.invalid.length,
  });

  if (plan.monthKey === null) {
    return NextResponse.json({ error: NO_VALID_ROWS_ERROR }, { status: 400 });
  }

  if (dryRun) {
    return NextResponse.json({
      monthKey: plan.monthKey,
      toImport: plan.toInsert.length,
      toRemove: plan.toDeleteIds.length,
      toMatch: plan.toSkipMatched.length,
      ignored: plan.ignored,
      totalCents: plan.toInsert.reduce(
        (total, row) => total + row.amountCents,
        0,
      ),
    });
  }

  try {
    const categories = await classifyImportedTitles(
      plan.toInsert.map((row) => row.title),
    );
    const data = plan.toInsert.map((row, index) => ({
      cardId,
      description: row.title,
      amountCents: row.amountCents,
      purchaseDate: purchaseDateFromIso(row.date),
      category: categories[index] ?? null,
      installmentNumber: 1,
      installmentsTotal: 1,
    }));

    const { removed, imported } = await prisma.$transaction(async (tx) => {
      const deleted = await tx.cardPurchase.deleteMany({
        where: { id: { in: plan.toDeleteIds } },
      });
      const created = await tx.cardPurchase.createMany({ data });
      return { removed: deleted.count, imported: created.count };
    });

    return NextResponse.json({
      monthKey: plan.monthKey,
      imported,
      removed,
      matched: plan.toSkipMatched.length,
      ignored: plan.ignored,
    });
  } catch {
    return NextResponse.json(
      { error: IMPORT_FAILURE_MESSAGE },
      { status: 500 },
    );
  }
}
