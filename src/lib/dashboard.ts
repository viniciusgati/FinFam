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
import { defaultSettings, getSettings } from "./settings";
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
  /**
   * Entradas avulsas (venda/saldo) que formam a renda: no período corrente com
   * `cycleStartDay ≠ 1`, as da janela do ciclo (SPEC §4.1); nos demais casos,
   * as do mês calendário.
   */
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
 * Mantém apenas os itens cuja `date` cai em `[start, end)`. `window` nulo
 * devolve a lista intacta — é o caminho do mês calendário, sem particionamento.
 */
function withinWindow<T extends { date: Date }>(
  items: T[],
  window: { start: Date; end: Date } | null,
): T[] {
  if (window === null) return items;
  return items.filter(
    (item) => item.date >= window.start && item.date < window.end,
  );
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
 * do flag `active`. Entradas avulsas (venda/saldo) da janela aplicável somam à
 * renda mensal (ver "Janela dos avulsos" abaixo).
 *
 * As compras de cartão são alocadas pela regra de fechamento/vencimento
 * (SPEC §3.4, `sumCardExpensesForMonth`), de modo que cada mês de referência
 * recebe apenas as parcelas cuja competência cai nele — inclusive parcelas de
 * compras feitas em meses anteriores.
 *
 * Além dos agregados, monta a `series` diária via `buildDailySeries` (função
 * pura), distribuindo cada despesa pelo dia em que ocorre.
 *
 * Janela dos avulsos (SPEC §4.1): no mês corrente com `cycleStartDay ≠ 1`, os
 * gastos **e** entradas avulsos são particionados pela janela do ciclo — a
 * partição do ciclo alimenta `variableExpensesCents`/`variableIncomeCents` (e
 * portanto `monthlyIncomeCents`) e o `categoryBreakdown`; a do mês calendário
 * alimenta `hasMovements` e a `series` diária, que permanece no eixo civil.
 * Fixas, vigência e faturas seguem o mês calendário (SPEC §5). Com
 * `cycleStartDay = 1` ou fora do mês corrente, os avulsos seguem o mês
 * calendário, como antes.
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

  // Ciclo financeiro no mês corrente: usado para particionar os avulsos e para
  // o total de dias do ciclo. Fora do mês corrente (mês fechado sem snapshot),
  // a janela de avulsos permanece a do mês calendário.
  const isCurrentMonth = currentMonthKey === monthKey(new Date());
  const { cycleStartDay } = isCurrentMonth
    ? await getSettings()
    : defaultSettings();
  const cycle = isCurrentMonth
    ? cycleWindow(referenceDate, cycleStartDay, timeZone)
    : null;

  // No mês corrente com ciclo ≠ mês, a consulta de avulsos cobre a união da
  // janela do ciclo com a do mês calendário; em memória, `cycleVariableWindow`
  // (limites idênticos aos de `loadCycleAllowance`: do início do ciclo até
  // min(amanhã, próximo início), derivados de `referenceDate`) alimenta o `%`,
  // a renda e o breakdown, e `civilVariableWindow` alimenta `hasMovements` e a
  // série diária (gráfico no eixo civil). Com `cycleStartDay = 1`, as duas
  // janelas são a do mês — caminho anterior, inalterado.
  let variableQuery: { start: Date; end: Date } = { start, end };
  let cycleVariableWindow: { start: Date; end: Date } | null = null;
  if (cycle !== null && cycleStartDay !== 1) {
    const today = zonedDateParts(referenceDate, timeZone);
    const tomorrow = zonedTimeToUtc(
      today.year,
      today.month,
      today.day + 1,
      timeZone,
    );
    const upperBound =
      tomorrow.getTime() < cycle.nextStart.getTime()
        ? tomorrow
        : cycle.nextStart;
    cycleVariableWindow = { start: cycle.start, end: upperBound };
    variableQuery = {
      start: cycle.start < start ? cycle.start : start,
      end: upperBound > end ? upperBound : end,
    };
  }

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
        date: { gte: variableQuery.start, lt: variableQuery.end },
        paymentMethod: { in: budgetPaymentMethods },
      },
    }),
    prisma.variableIncome.findMany({
      where: { date: { gte: variableQuery.start, lt: variableQuery.end } },
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

  // Partição dos avulsos entre a janela do ciclo e a do mês calendário. Sem
  // janela de ciclo as duas coincidem com a consulta do mês (caminho
  // anterior); com ciclo ≠ mês, fixas e faturas seguem o mês civil (SPEC §5).
  const civilVariableWindow =
    cycleVariableWindow === null ? null : { start, end };
  const cycleVariableExpenses = withinWindow(
    variableExpenses,
    cycleVariableWindow,
  );
  const civilVariableExpenses = withinWindow(
    variableExpenses,
    civilVariableWindow,
  );
  const cycleVariableIncomes = withinWindow(
    variableIncomes,
    cycleVariableWindow,
  );
  const civilVariableIncomes = withinWindow(
    variableIncomes,
    civilVariableWindow,
  );

  // Entradas avulsas da janela do ciclo (venda/saldo) somam à renda, como as
  // fixas; sem ciclo distinto do mês, é a janela do próprio mês.
  const fixedIncomeCents = sumByAmount(activeIncomes);
  const variableIncomeCents = sumByAmount(cycleVariableIncomes);
  const monthlyIncomeCents = fixedIncomeCents + variableIncomeCents;
  const fixedExpensesCents = sumByAmount(activeFixedExpenses);
  const variableExpensesCents = sumByAmount(cycleVariableExpenses);
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
    variableExpenses: civilVariableExpenses.map((item) => ({
      amountCents: item.amountCents,
      date: item.date,
      paymentMethod: item.paymentMethod,
    })),
    cardInvoiceLines,
  });

  // Movimentação = qualquer saída (fixa/avulsa/cartão) ou entrada avulsa no
  // mês calendário corrente — é o gatilho do estado vazio "renda sem gastos".
  const hasMovements =
    activeFixedExpenses.length > 0 ||
    civilVariableExpenses.length > 0 ||
    cardInvoiceLines.length > 0 ||
    civilVariableIncomes.length > 0;

  // Total de dias do ciclo (entre `start` e `nextStart`) só faz sentido no mês
  // corrente; fora dele a janela do ciclo é omitida (`cycleDays: null`).
  // Atenção: `remainingCycleDays` devolve apenas os dias restantes e daria
  // divisor errado — usamos a janela completa.
  const cycleDays: number | null =
    cycle === null
      ? null
      : Math.round(
          (cycle.nextStart.getTime() - cycle.start.getTime()) / DAY_MS,
        );

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
      variableExpenses: cycleVariableExpenses,
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
