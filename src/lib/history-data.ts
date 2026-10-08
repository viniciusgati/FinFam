/**
 * Carga dos snapshots mensais usados por `/historico`.
 *
 * A página é só orquestração: esta função consulta o banco e devolve os
 * snapshots da janela já no formato puro de `history.ts` (com categorias). A
 * lógica de apresentação fica nas funções puras, testáveis sem banco.
 */

import { prisma } from "./db";
import type { MonthHistorySnapshot } from "./history";
import { monthRange } from "./snapshots";

/**
 * Carrega os últimos 4 meses fechados estritamente anteriores ao mês de
 * `referenceDate`, com as categorias de cada mês.
 */
export async function loadMonthHistory(
  referenceDate: Date = new Date(),
): Promise<MonthHistorySnapshot[]> {
  const keys = monthRange(referenceDate, 4);

  const rows = await prisma.monthlySnapshot.findMany({
    where: { monthKey: { in: keys } },
    include: {
      categories: { orderBy: { amountCents: "desc" } },
    },
    orderBy: { monthKey: "asc" },
  });

  return rows.map((row) => ({
    monthKey: row.monthKey,
    incomeCents: row.incomeCents,
    consumedCents: row.consumedCents,
    consumedPercent: row.consumedPercent,
    consumptionAvailableCents: row.consumptionAvailableCents,
    dailyAverageCents: row.dailyAverageCents,
    categories: row.categories.map((category) => ({
      category: category.categoryLabel,
      amountCents: category.amountCents,
    })),
  }));
}
