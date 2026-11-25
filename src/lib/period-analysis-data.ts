/**
 * Carregador do diagnóstico de período para o dashboard.
 *
 * A análise em si é pura (`period-analysis.ts`). Este módulo só faz o recorte
 * que o dashboard já usa (snapshots fechados + ciclo de referência) virar
 * `PeriodAnalysisInput`: consulta os lançamentos crus da janela de análise,
 * fixas/entradas/cartões ativos e delega o cálculo.
 *
 * O dashboard chama este carregador apenas no ciclo corrente. Assim como os
 * outros blocos opcionais (lista de compras, histórico da meta), falha de
 * leitura não derruba a página — o chamador engole o erro e esconde o card.
 */

import type { CycleReference, DashboardData } from "./dashboard";
import { prisma } from "./db";
import { isActiveInMonth, monthKey } from "./finance";
import {
  buildPeriodAnalysis,
  type PeriodAnalysis,
  type PeriodCard,
  type PeriodCardPurchase,
  type PeriodFixedExpense,
  type PeriodIncome,
  type PeriodMonth,
  type PeriodReserveSnapshot,
  type PeriodTransaction,
} from "./period-analysis";
import {
  resolveTimeZone,
  zonedDateParts,
  zonedTimeToUtc,
} from "./time";

export interface LoadPeriodAnalysisInput {
  /** Dados já carregados por `loadCycleDashboardData` para o ciclo exibido. */
  data: DashboardData;
  reference: CycleReference;
  now?: Date;
  baselineMonths?: number;
  monthsAhead?: number;
  emergencyMonths?: number;
}

function startOfMonth(monthKey: string, timeZone: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return zonedTimeToUtc(year, month, 1, timeZone);
}

/**
 * Limite superior dos lançamentos: o fim do dia de hoje (ciclo corrente) ou o
 * fim da janela (ciclo fechado/futuro), o que vier primeiro.
 */
function analysisEnd(
  reference: CycleReference,
  now: Date,
  timeZone: string,
): Date {
  if (!reference.isCurrent) return reference.window.nextStart;
  const parts = zonedDateParts(now, timeZone);
  const tomorrow = zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day + 1,
    timeZone,
  );
  return tomorrow.getTime() < reference.window.nextStart.getTime()
    ? tomorrow
    : reference.window.nextStart;
}

/**
 * Monta a análise do ciclo atual. A janela de lançamentos começa no primeiro
 * snapshot fechado (base de comparação) e termina no fim do ciclo/dia atual.
 */
export async function loadPeriodAnalysis(
  input: LoadPeriodAnalysisInput,
): Promise<PeriodAnalysis> {
  const { data, reference } = input;
  const now = input.now ?? new Date();
  const timeZone = resolveTimeZone();

  const firstSnapshotKey = data.snapshots[0]?.monthKey;
  const analysisStart =
    firstSnapshotKey === undefined
      ? reference.window.start
      : startOfMonth(firstSnapshotKey, timeZone);
  const end = analysisEnd(reference, now, timeZone);

  const [
    variableExpenses,
    cardPurchases,
    fixedExpenses,
    incomes,
    cards,
    reserveSnapshots,
  ] = await Promise.all([
    prisma.variableExpense.findMany({
      where: { date: { gte: analysisStart, lt: end } },
    }),
    prisma.cardPurchase.findMany({
      where: { purchaseDate: { gte: analysisStart, lt: end } },
      include: { card: true },
    }),
    prisma.fixedExpense.findMany({ where: { active: true } }),
    prisma.income.findMany({ where: { active: true } }),
    prisma.creditCard.findMany({ where: { active: true } }),
    prisma.reserveSnapshot.findMany({
      orderBy: { monthKey: "desc" },
      take: 12,
    }),
  ]);

  const closedMonths: PeriodMonth[] = data.snapshots.map((snapshot) => ({
    monthKey: snapshot.monthKey,
    incomeCents: snapshot.incomeCents,
    consumedCents: snapshot.consumedCents,
    fixedExpensesCents: snapshot.fixedExpensesCents ?? 0,
    variableExpensesCents: snapshot.variableExpensesCents ?? 0,
    cardExpensesCents: snapshot.cardExpensesCents ?? 0,
    categories: snapshot.categories,
    variableDailyCents: snapshot.variableDailyCents,
    obligationDailyCents: snapshot.obligationDailyCents,
    daysInMonth: snapshot.daysInMonth,
    elapsedDay: snapshot.daysInMonth,
  }));

  const current: PeriodMonth = {
    monthKey: reference.cycleKey,
    incomeCents: data.monthlyIncomeCents,
    consumedCents:
      data.fixedExpensesCents +
      data.variableExpensesCents +
      data.cardExpensesCents,
    fixedExpensesCents: data.fixedExpensesCents,
    variableExpensesCents: data.variableExpensesCents,
    cardExpensesCents: data.cardExpensesCents,
    categories: data.categoryBreakdown.items,
    variableDailyCents: data.series.variableDailyCents,
    obligationDailyCents: data.series.obligationDailyCents,
    daysInMonth: data.series.daysInMonth,
    elapsedDay: data.series.elapsedDay,
    isCurrent: reference.isCurrent,
  };

  const transactions: PeriodTransaction[] = [
    ...variableExpenses.map((expense) => ({
      description: expense.description,
      amountCents: expense.amountCents,
      date: expense.date,
      category: expense.category,
      source: "variable" as const,
      paymentMethod: expense.paymentMethod,
      creditCardId: expense.creditCardId,
    })),
    ...cardPurchases.map((purchase) => ({
      description: purchase.description,
      amountCents: purchase.amountCents,
      date: purchase.purchaseDate,
      category: purchase.category,
      source: "card" as const,
      cardId: purchase.cardId,
      installmentsTotal: purchase.installmentsTotal,
      installmentNumber: purchase.installmentNumber,
    })),
  ];

  // `active` não basta: a vigência (`startMonth`/`endMonth`) pode excluir o
  // item do mês corrente. O dashboard principal já faz esse recorte por
  // ocorrência; aqui usamos o mês civil de hoje como aproximação.
  const currentMonth = monthKey(now);
  const periodFixedExpenses: PeriodFixedExpense[] = fixedExpenses
    .filter((expense) => isActiveInMonth(expense, currentMonth))
    .map((expense) => ({
      name: expense.name,
      amountCents: expense.amountCents,
      dueDay: expense.dueDay,
      category: expense.category,
      active: expense.active,
    }));
  const periodIncomes: PeriodIncome[] = incomes
    .filter((income) => isActiveInMonth(income, currentMonth))
    .map((income) => ({
      name: income.name,
      amountCents: income.amountCents,
      receiveDay: income.receiveDay,
      active: income.active,
    }));
  const periodCards: PeriodCard[] = cards.map((card) => ({
    id: card.id,
    name: card.name,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    limitCents: card.limitCents,
  }));
  const periodCardPurchases: PeriodCardPurchase[] = cardPurchases.map(
    (purchase) => ({
      description: purchase.description,
      amountCents: purchase.amountCents,
      purchaseDate: purchase.purchaseDate,
      category: purchase.category,
      cardId: purchase.cardId,
      card: {
        closingDay: purchase.card.closingDay,
        dueDay: purchase.card.dueDay,
      },
      installmentsTotal: purchase.installmentsTotal,
      installmentNumber: purchase.installmentNumber,
    }),
  );

  // A consulta vem do mais recente para o mais antigo (para o `take` pegar os
  // últimos 12); o motor espera ordem cronológica crescente.
  const periodReserveSnapshots: PeriodReserveSnapshot[] = [
    ...reserveSnapshots,
  ]
    .reverse()
    .map((snapshot) => ({
      monthKey: snapshot.monthKey,
      amountCents: snapshot.amountCents,
    }));

  const essentialCategories = [
    ...new Set(
      periodFixedExpenses
        .map((expense) => expense.category)
        .filter((category): category is string => Boolean(category)),
    ),
  ];

  return buildPeriodAnalysis({
    months: closedMonths,
    current,
    transactions,
    transactionsPreFiltered: true,
    fixedExpenses: periodFixedExpenses,
    incomes: periodIncomes,
    cards: periodCards,
    cardPurchases: periodCardPurchases,
    referenceMonthKey: reference.cycleKey,
    baselineMonths: input.baselineMonths ?? 4,
    monthsAhead: input.monthsAhead ?? 6,
    emergencyMonths: input.emergencyMonths ?? 6,
    essentialCategories,
    reserveSnapshots: periodReserveSnapshots,
    goals: [],
  });
}
