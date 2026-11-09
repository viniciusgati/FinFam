import { collectCategorySuggestions } from "@/lib/categories";
import { prisma } from "@/lib/db";

/**
 * Carrega as categorias já usadas na família a partir das três tabelas de
 * despesas (avulsos, fixos e compras de cartão), deduplicadas e ordenadas.
 *
 * Falha de leitura devolve `[]` para nunca derrubar o dashboard — as telas
 * seguem funcionando com o campo de categoria como texto livre.
 *
 * A agregação por `category` roda no banco (`groupBy`): só as categorias
 * distintas trafegam para o processo, independente do volume de lançamentos.
 */
export async function loadCategorySuggestions(): Promise<string[]> {
  try {
    const where = { category: { not: null } };
    const [variableExpenses, fixedExpenses, cardPurchases] = await Promise.all([
      prisma.variableExpense.groupBy({ by: ["category"], where }),
      prisma.fixedExpense.groupBy({ by: ["category"], where }),
      prisma.cardPurchase.groupBy({ by: ["category"], where }),
    ]);

    return collectCategorySuggestions([
      ...variableExpenses.map((group) => group.category),
      ...fixedExpenses.map((group) => group.category),
      ...cardPurchases.map((group) => group.category),
    ]);
  } catch {
    return [];
  }
}
