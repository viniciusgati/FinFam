import { captureClosedMonths, prisma } from "./db";
import {
  buildConsumptionSummary,
  buildDailySeries,
  type ConsumptionSummary,
  type DailySeries,
} from "./dashboard-series";
import {
  cycleWindow,
  dailyAllowanceCents,
  type DailyAllowance,
} from "./cycle";
import {
  buildCategoryBreakdown,
  type CategoryBreakdown,
} from "./category-breakdown";
import type { FinanceInput } from "./finance";
import {
  hasComparisonData,
  isActiveInMonth,
  monthKey,
  shiftMonthKey,
} from "./finance";
import {
  invoiceLinesForSeries,
  sumCardExpensesForMonth,
} from "./invoices";
import {
  buildDashboardDataFromSnapshot,
  isCompleteSnapshot,
} from "./snapshot-month";
import { getSettings } from "./settings";
import { resolveTimeZone, zonedDateParts, zonedTimeToUtc } from "./time";
import { isCountedInBudget, PAYMENT_METHODS } from "./variable-expenses";

/** Formas de pagamento de gasto avulso que entram no orçamento (SPEC §3.3). */
const budgetPaymentMethods = PAYMENT_METHODS.filter(isCountedInBudget);

/** Snapshot de um mês fechado, com os campos necessários para rotular a lista. */
export interface DashboardSnapshot {
  monthKey: string;
  incomeCents: number;
  consumedCents: number;
  consumedPercent: number;
  /** Gastos do mês por categoria (rótulo exibido + valor). */
  categories: { category: string; amountCents: number }[];
}

export interface DashboardData extends FinanceInput {
  /** Entradas fixas vigentes no mês. */
  fixedIncomeCents: number;
  /** Entradas avulsas (venda/saldo) do mês. */
  variableIncomeCents: number;
  /**
   * Há qualquer movimentação no mês de referência: despesa fixa, avulsa ou de
   * cartão, ou entrada avulsa. Distingue "sem renda" de "renda sem gastos".
   */
  hasMovements: boolean;
  /**
   * Percentuais dos meses fechados anteriores **com dados** (entrada e saída),
   * mais recente por último. Meses só com renda ou só com gasto ficam de fora.
   */
  previousPercents: number[];
  /** Totais gastos nos meses fechados com dados (mais recente por último). */
  previousMonthsCents: number[];
  /** Snapshots (com categorias) dos meses fechados com dados, em ordem. */
  snapshots: DashboardSnapshot[];
  /** Série diária do mês de referência (gráficos e avaliação do dia). */
  series: DailySeries;
  /**
   * Consumo disponível (`entradas − gastos fixos`) e média diária. Leitura
   * informativa; não substitui o `%` nem o orçamento livre do ciclo.
   */
  consumption: ConsumptionSummary;
  /**
   * Gasto do mês por categoria (fixas vigentes + avulsos no orçamento +
   * parcelas de cartão por competência). Invariante: a soma das fatias coincide
   * com `consumedCents`.
   */
  categoryBreakdown: CategoryBreakdown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sumByAmount(items: { amountCents: number }[]): number {
  return items.reduce((total, item) => total + item.amountCents, 0);
}

/**
 * Dashboard de um mês fechado a partir do snapshot imutável. Devolve `null`
 * quando o mês não tem snapshot ou ele é anterior à série diária (captura
 * antiga) — nesse caso o chamador tenta capturar e, em último caso, calcula ao
 * vivo (comportamento transitório até um `db:snapshots --force`).
 *
 * A comparação ("melhores/piores que os últimos N meses") continua vindo dos
 * snapshots dos 4 meses anteriores, como no ramo ao vivo.
 */
async function loadClosedMonthData(
  referenceMonthKey: string,
  referenceDate: Date,
): Promise<DashboardData | null> {
  const startMonthKey = shiftMonthKey(referenceMonthKey, -4);

  const [snapshot, previous] = await Promise.all([
    prisma.monthlySnapshot.findUnique({
      where: { monthKey: referenceMonthKey },
      include: { categories: true },
    }),
    prisma.monthlySnapshot.findMany({
      where: { monthKey: { gte: startMonthKey, lt: referenceMonthKey } },
      orderBy: { monthKey: "asc" },
      take: 4,
      include: { categories: { orderBy: { amountCents: "desc" } } },
    }),
  ]);

  if (!snapshot || !isCompleteSnapshot(snapshot)) return null;

  // Comparações e médias só usam meses com dados (entrada e saída).
  const previousSnapshots = previous
    .map((row) => ({
      monthKey: row.monthKey,
      incomeCents: row.incomeCents,
      consumedCents: row.consumedCents,
      consumedPercent: row.consumedPercent,
      categories: row.categories.map((category) => ({
        category: category.categoryLabel,
        amountCents: category.amountCents,
      })),
    }))
    .filter(hasComparisonData);

  const monthData = buildDashboardDataFromSnapshot(
    {
      monthKey: snapshot.monthKey,
      incomeCents: snapshot.incomeCents,
      fixedIncomeCents: snapshot.fixedIncomeCents,
      variableIncomeCents: snapshot.variableIncomeCents,
      fixedExpensesCents: snapshot.fixedExpensesCents,
      variableExpensesCents: snapshot.variableExpensesCents,
      cardExpensesCents: snapshot.cardExpensesCents,
      consumedCents: snapshot.consumedCents,
      consumedPercent: snapshot.consumedPercent,
      consumptionAvailableCents: snapshot.consumptionAvailableCents,
      dailyAverageCents: snapshot.dailyAverageCents,
      daysInMonth: snapshot.daysInMonth,
      variableDailyCents: snapshot.variableDailyCents,
      obligationDailyCents: snapshot.obligationDailyCents,
      categories: snapshot.categories.map((category) => ({
        category: category.categoryLabel,
        amountCents: category.amountCents,
      })),
    },
    referenceDate,
  );

  return {
    ...monthData,
    previousPercents: previousSnapshots.map((row) => row.consumedPercent),
    previousMonthsCents: previousSnapshots.map((row) => row.consumedCents),
    snapshots: previousSnapshots,
  };
}

/**
 * Carrega os dados agregados do mês a partir do banco.
 *
 * Mês fechado (anterior ao corrente) lê o snapshot imutável; se ainda não
 * houver, tenta capturar e, em último caso, calcula ao vivo. O mês corrente é
 * sempre ao vivo.
 *
 * As entradas e saídas fixas respeitam a vigência (startMonth/endMonth) além
 * do flag `active`. Entradas avulsas (venda/saldo) do mês somam à renda mensal.
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
  const referenceMonthKey = monthKey(referenceDate);
  if (referenceMonthKey < monthKey(new Date())) {
    const fromSnapshot = await loadClosedMonthData(
      referenceMonthKey,
      referenceDate,
    );
    if (fromSnapshot) return fromSnapshot;

    // Sem snapshot completo: tenta capturar agora (idempotente) e reler.
    await captureClosedMonths();
    const retried = await loadClosedMonthData(
      referenceMonthKey,
      referenceDate,
    );
    if (retried) return retried;
  }

  const timeZone = resolveTimeZone();
  const { year, month } = zonedDateParts(referenceDate, timeZone);
  const start = zonedTimeToUtc(year, month, 1, timeZone);
  const end = zonedTimeToUtc(year, month + 1, 1, timeZone);

  const currentMonthKey = monthKey(referenceDate);
  const startMonthKey = shiftMonthKey(currentMonthKey, -4);

  const [
    incomes,
    fixedExpenses,
    variableExpenses,
    variableIncomes,
    cardPurchases,
    snapshots,
  ] = await Promise.all([
    prisma.income.findMany({ where: { active: true } }),
    prisma.fixedExpense.findMany({ where: { active: true } }),
    prisma.variableExpense.findMany({
      where: {
        date: { gte: start, lt: end },
        paymentMethod: { in: budgetPaymentMethods },
      },
    }),
    prisma.variableIncome.findMany({ where: { date: { gte: start, lt: end } } }),
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
      include: { categories: { orderBy: { amountCents: "desc" } } },
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

  // Comparações e médias só usam meses fechados com dados (entrada e saída).
  const previousSnapshots = snapshots
    .map((snapshot) => ({
      monthKey: snapshot.monthKey,
      incomeCents: snapshot.incomeCents,
      consumedCents: snapshot.consumedCents,
      consumedPercent: snapshot.consumedPercent,
      categories: snapshot.categories.map((category) => ({
        category: category.categoryLabel,
        amountCents: category.amountCents,
      })),
    }))
    .filter(hasComparisonData);

  // Parcelas cuja competência cai no mês, com o dia de vencimento do cartão e o
  // dia da compra (só quando a compra é do próprio mês — usada no gráfico de
  // consumo diário; parcelas anteriores são obrigação no vencimento).
  const cardInvoiceLines = invoiceLinesForSeries(
    cardPurchases,
    currentMonthKey,
    timeZone,
  );

  // Entradas avulsas do mês (venda/saldo) somam à renda, como as fixas.
  const fixedIncomeCents = sumByAmount(activeIncomes);
  const variableIncomeCents = sumByAmount(variableIncomes);
  const monthlyIncomeCents = fixedIncomeCents + variableIncomeCents;
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

  // Movimentação = qualquer saída (fixa/avulsa/cartão) ou entrada avulsa no mês.
  const hasMovements =
    activeFixedExpenses.length > 0 ||
    variableExpenses.length > 0 ||
    cardInvoiceLines.length > 0 ||
    variableIncomes.length > 0;

  // Total de dias do ciclo (entre `start` e `nextStart`) só faz sentido no mês
  // corrente; fora dele a janela do ciclo é omitida (`cycleDays: null`).
  // Atenção: `remainingCycleDays` devolve apenas os dias restantes e daria
  // divisor errado — usamos a janela completa.
  let cycleDays: number | null = null;
  if (currentMonthKey === monthKey(new Date())) {
    const { cycleStartDay } = await getSettings();
    const cycle = cycleWindow(referenceDate, cycleStartDay, timeZone);
    cycleDays = Math.round(
      (cycle.nextStart.getTime() - cycle.start.getTime()) / DAY_MS,
    );
  }

  const consumption = buildConsumptionSummary({
    incomeCents: monthlyIncomeCents,
    fixedExpensesCents,
    daysInMonth: series.daysInMonth,
    daysElapsed: series.elapsedDay,
    cycleDays,
  });

  return {
    monthlyIncomeCents,
    fixedIncomeCents,
    variableIncomeCents,
    fixedExpensesCents,
    variableExpensesCents,
    cardExpensesCents,
    hasMovements,
    previousPercents: previousSnapshots.map(
      (snapshot) => snapshot.consumedPercent,
    ),
    previousMonthsCents: previousSnapshots.map(
      (snapshot) => snapshot.consumedCents,
    ),
    snapshots: previousSnapshots,
    series,
    consumption,
    categoryBreakdown: buildCategoryBreakdown({
      monthKey: currentMonthKey,
      fixedExpenses,
      variableExpenses,
      cardPurchases,
    }),
    referenceDate,
  };
}

/**
 * Agrega os dados do **ciclo financeiro** atual para o card "Pode gastar por
 * dia" (história #225).
 *
 * - Renda e obrigações seguem o **mês calendário corrente** (`monthKey(now)`),
 *   o mesmo mês usado pelo percentual consumido do dashboard (invariante #231:
 *   mês com percentual < 100% ⇒ diária > R$ 0,00). Antes seguiam o mês de
 *   início do ciclo (`cycleKey`), o que desalinhava as obrigações de cartão em
 *   `cycleStartDay ≠ 1` e zerava a diária mesmo com orçamento livre.
 * - Gastos avulsos contam por `date` dentro de `[início do ciclo, hoje]`, apenas
 *   nas formas de pagamento do orçamento (mesma regra de `loadDashboardData`).
 * - Entradas avulsas contam por `date` dentro da mesma janela do ciclo e são
 *   somadas à renda que forma o orçamento livre.
 */
export async function loadCycleAllowance(
  now: Date = new Date(),
): Promise<DailyAllowance> {
  const timeZone = resolveTimeZone();
  const { cycleStartDay } = await getSettings();
  const window = cycleWindow(now, cycleStartDay, timeZone);
  const currentMonthKey = monthKey(now);

  // Limite superior dos gastos avulsos: fim de hoje, sem ultrapassar o ciclo.
  const today = zonedDateParts(now, timeZone);
  const tomorrow = zonedTimeToUtc(today.year, today.month, today.day + 1, timeZone);
  const upperBound =
    tomorrow.getTime() < window.nextStart.getTime() ? tomorrow : window.nextStart;

  const [incomes, fixedExpenses, variableExpenses, variableIncomes, cardPurchases] =
    await Promise.all([
      prisma.income.findMany({ where: { active: true } }),
      prisma.fixedExpense.findMany({ where: { active: true } }),
      prisma.variableExpense.findMany({
        where: {
          date: { gte: window.start, lt: upperBound },
          paymentMethod: { in: budgetPaymentMethods },
        },
      }),
      prisma.variableIncome.findMany({
        where: { date: { gte: window.start, lt: upperBound } },
      }),
      prisma.cardPurchase.findMany({
        where: { purchaseDate: { lt: window.nextStart } },
        include: { card: true },
      }),
    ]);

  const incomeCents =
    sumByAmount(incomes.filter((item) => isActiveInMonth(item, currentMonthKey))) +
    sumByAmount(variableIncomes);
  const fixedCents = sumByAmount(
    fixedExpenses.filter((item) => isActiveInMonth(item, currentMonthKey)),
  );
  const cardCents = sumCardExpensesForMonth(cardPurchases, currentMonthKey);
  const variableSpentCents = sumByAmount(variableExpenses);

  return dailyAllowanceCents({
    incomeCents,
    obligationsCents: fixedCents + cardCents,
    variableSpentCents,
    cycleStartDay,
    now,
    timeZone,
  });
}
