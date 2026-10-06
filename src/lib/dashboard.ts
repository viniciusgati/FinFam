import { prisma } from "./db";
import type { FinanceInput } from "./finance";
import { isActiveInMonth, monthKey } from "./finance";
import { sumCardExpensesForMonth } from "./invoices";
import { isCountedInBudget, PAYMENT_METHODS } from "./variable-expenses";

/** Formas de pagamento de gasto avulso que entram no orçamento (SPEC §3.3). */
const budgetPaymentMethods = PAYMENT_METHODS.filter(isCountedInBudget);

export interface DashboardData extends FinanceInput {
  previousPercents: number[];
}

function sumByAmount(items: { amountCents: number }[]): number {
  return items.reduce((total, item) => total + item.amountCents, 0);
}

/**
 * Carrega os dados agregados do mês a partir do banco.
 *
 * As entradas e saídas fixas respeitam a vigência (startMonth/endMonth) além
 * do flag `active`.
 *
 * As compras de cartão são alocadas pela regra de fechamento/vencimento
 * (SPEC §3.4, `sumCardExpensesForMonth`), de modo que cada mês de referência
 * recebe apenas as parcelas cuja competência cai nele — inclusive parcelas de
 * compras feitas em meses anteriores.
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
          paymentMethod: { in: budgetPaymentMethods },
        },
      }),
      prisma.cardPurchase.findMany({
        where: { purchaseDate: { lt: end } },
        include: { card: true },
      }),
      prisma.monthlySnapshot.findMany({
        where: {
          monthKey: { gte: startMonthKey, lt: currentMonthKey },
        },
        orderBy: { monthKey: "asc" },
        take: 4,
      }),
    ]);

  // Suposição (g): a relação CardPurchase → CreditCard é obrigatória; uma
  // compra órfã indica corrupção de dados e deve falhar o carregamento.
  if (cardPurchases.some((purchase) => !purchase.card)) {
    throw new Error("Compra de cartão sem cartão relacionado.");
  }

  return {
    monthlyIncomeCents: sumByAmount(
      incomes.filter((item) => isActiveInMonth(item, currentMonthKey)),
    ),
    fixedExpensesCents: sumByAmount(
      fixedExpenses.filter((item) => isActiveInMonth(item, currentMonthKey)),
    ),
    variableExpensesCents: sumByAmount(variableExpenses),
    cardExpensesCents: sumCardExpensesForMonth(
      cardPurchases,
      currentMonthKey,
    ),
    previousPercents: snapshots.map((snapshot) => snapshot.consumedPercent),
    referenceDate,
  };
}
