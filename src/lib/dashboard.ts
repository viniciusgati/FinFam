import { prisma } from "./db";
import {
  buildDailySeries,
  type DailySeries,
} from "./dashboard-series";
import type { FinanceInput } from "./finance";
import { isActiveInMonth, monthKey, shiftMonthKey } from "./finance";
import { allocateInstallments, sumCardExpensesForMonth } from "./invoices";
import { resolveTimeZone, zonedDateParts, zonedTimeToUtc } from "./time";
import { isCountedInBudget, PAYMENT_METHODS } from "./variable-expenses";

/** Formas de pagamento de gasto avulso que entram no orçamento (SPEC §3.3). */
const budgetPaymentMethods = PAYMENT_METHODS.filter(isCountedInBudget);

export interface DashboardData extends FinanceInput {
  previousPercents: number[];
  /** Totais gastos nos meses fechados (mais recente por último). */
  previousMonthsCents: number[];
  /** Série diária do mês de referência (gráficos e avaliação do dia). */
  series: DailySeries;
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
 *
 * Além dos agregados, monta a `series` diária via `buildDailySeries` (função
 * pura), distribuindo cada despesa pelo dia em que ocorre.
 */
export async function loadDashboardData(
  referenceDate: Date = new Date(),
): Promise<DashboardData> {
  const timeZone = resolveTimeZone();
  const { year, month } = zonedDateParts(referenceDate, timeZone);
  const start = zonedTimeToUtc(year, month, 1, timeZone);
  const end = zonedTimeToUtc(year, month + 1, 1, timeZone);

  const currentMonthKey = monthKey(referenceDate);
  const startMonthKey = shiftMonthKey(currentMonthKey, -4);

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

  const activeIncomes = incomes.filter((item) =>
    isActiveInMonth(item, currentMonthKey),
  );
  const activeFixedExpenses = fixedExpenses.filter((item) =>
    isActiveInMonth(item, currentMonthKey),
  );

  // Parcelas cuja competência cai no mês, com o dia de vencimento do cartão.
  const cardInvoiceLines = cardPurchases.flatMap((purchase) =>
    allocateInstallments(
      purchase,
      purchase.card.closingDay,
      purchase.card.dueDay,
    )
      .filter((installment) => installment.monthKey === currentMonthKey)
      .map((installment) => ({
        amountCents: installment.amountCents,
        dueDay: purchase.card.dueDay,
      })),
  );

  const monthlyIncomeCents = sumByAmount(activeIncomes);
  const fixedExpensesCents = sumByAmount(activeFixedExpenses);
  const variableExpensesCents = sumByAmount(variableExpenses);
  const cardExpensesCents = sumCardExpensesForMonth(
    cardPurchases,
    currentMonthKey,
  );

  const series = buildDailySeries({
    referenceDate,
    incomeCents: monthlyIncomeCents,
    fixedExpenses: activeFixedExpenses.map((item) => ({
      amountCents: item.amountCents,
      dueDay: item.dueDay,
    })),
    variableExpenses: variableExpenses.map((item) => ({
      amountCents: item.amountCents,
      date: item.date,
      paymentMethod: item.paymentMethod,
    })),
    cardInvoiceLines,
  });

  return {
    monthlyIncomeCents,
    fixedExpensesCents,
    variableExpensesCents,
    cardExpensesCents,
    previousPercents: snapshots.map((snapshot) => snapshot.consumedPercent),
    previousMonthsCents: snapshots.map((snapshot) => snapshot.consumedCents),
    series,
    referenceDate,
  };
}
