import { collectCategorySuggestions } from "@/lib/categories";
import { prisma } from "@/lib/db";

/**
 * Carrega as categorias já usadas na família a partir das três tabelas de
 * despesas (avulsos, fixos e compras de cartão), deduplicadas e ordenadas.
 *
 * Falha de leitura devolve `[]` para nunca derrubar o dashboard — as telas
 * seguem funcionando com o campo de categoria como texto livre.
 */
export async function loadCategorySuggestions(): Promise<string[]> {
  try {
    const [variableExpenses, fixedExpenses, cardPurchases] = await Promise.all([
      prisma.variableExpense.findMany({
        where: { category: { not: null } },
        select: { category: true },
      }),
      prisma.fixedExpense.findMany({
        where: { category: { not: null } },
        select: { category: true },
      }),
      prisma.cardPurchase.findMany({
        where: { category: { not: null } },
        select: { category: true },
      }),
    ]);

    return collectCategorySuggestions([
      ...variableExpenses.map((row) => row.category),
      ...fixedExpenses.map((row) => row.category),
      ...cardPurchases.map((row) => row.category),
    ]);
  } catch {
    return [];
  }
}
