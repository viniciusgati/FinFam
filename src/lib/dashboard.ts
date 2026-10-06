import { prisma } from "./db";
import type { FinanceInput } from "./finance";
import { monthKey } from "./finance";

export interface DashboardData extends FinanceInput {
  previousPercents: number[];
}

function sumByAmount(items: { amountCents: number }[]): number {
  return items.reduce((total, item) => total + item.amountCents, 0);
}

/**
 * Carrega os dados agregados do mês a partir do banco.
 *
 * TODO (próximas fases):
 * - Respeitar a vigência (startMonth/endMonth) das entradas e saídas fixas.
 * - Alocar compras de cartão pela regra de fechamento/vencimento (SPEC §3.4)
 *   em vez de usar apenas o mês da compra.
 */
export async function loadDashboardData(
  referenceDate: Date = new Date(),
): Promise<DashboardData> {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const currentMonthKey = monthKey(referenceDate);
  const rawStartMonth = new Date(year, month - 4, 1);
  const startMonthKey = monthKey(rawStartMonth);

  const [incomes, fixedExpenses, variableExpenses, cardPurchases, snapshots] =
    await Promise.all([
      prisma.income.findMany({ where: { active: true } }),
      prisma.fixedExpense.findMany({ where: { active: true } }),
      prisma.variableExpense.findMany({
        where: {
          date: { gte: start, lt: end },
          paymentMethod: { not: "CREDIT" },
        },
      }),
      prisma.cardPurchase.findMany({
        where: { purchaseDate: { gte: start, lt: end } },
      }),
      prisma.monthlySnapshot.findMany({
        where: {
          monthKey: { gte: startMonthKey, lt: currentMonthKey },
        },
        orderBy: { monthKey: "asc" },
        take: 4,
      }),
    ]);

  return {
    monthlyIncomeCents: sumByAmount(incomes),
    fixedExpensesCents: sumByAmount(fixedExpenses),
    variableExpensesCents: sumByAmount(variableExpenses),
    cardExpensesCents: sumByAmount(cardPurchases),
    previousPercents: snapshots.map((snapshot) => snapshot.consumedPercent),
    referenceDate,
  };
}
