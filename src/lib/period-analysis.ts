/**
 * Motor puro de análise de período (histórias #258/#269 e evolução do
 * diagnóstico).
 *
 * Cruza os snapshots mensais com os dados já disponíveis (categorias, série
 * diária, fixas, entradas, cartões e transações) e devolve um diagnóstico
 * estruturado em seis dimensões:
 *
 * 1. **Fluxo** — renda, consumo, sobra, taxa de poupança e tendência.
 * 2. **Ritmo** — gasto variável no mesmo dia do ciclo vs. ciclos anteriores.
 * 3. **Composição** — fixas/variáveis/cartão, categorias e maiores desvios.
 * 4. **Compromissos** — custo fixo, vencimentos e parcelas futuras.
 * 5. **Comportamento** — merchants, tickets, recorrência e compras atípicas.
 * 6. **Qualidade** — categorização, crédito sem cartão e confiança da base.
 *
 * A análise é **determinística e local**: nenhuma função aqui acessa banco,
 * rede ou relógio. A IA (quando existir) recebe este resultado pronto e apenas
 * narra/prioriza — nunca calcula. A reserva confirmada é opcional e entra como
 * reconciliação (`ReserveSnapshot` ainda não existe no schema).
 *
 * Regras completas em docs/SPEC.md e docs/ARCHITECTURE.md.
 */

import {
  categoryKey,
  categoryLabel,
  NO_CATEGORY_LABEL,
} from "./categories";
import { monthKey, monthLabel, shiftMonthKey } from "./finance";
import { allocateInstallments } from "./invoices";
import { formatCents } from "./money";
import {
  isCountedInBudget,
  type PaymentMethod,
} from "./variable-expenses";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BASELINE_MONTHS = 4;
const DEFAULT_MONTHS_AHEAD = 6;
const DEFAULT_EMERGENCY_MONTHS = 6;
const DEFAULT_LARGE_PURCHASE_MIN_CENTS = 10000;
const MAX_LIST_ITEMS = 5;

const NO_CATEGORY_KEY = categoryKey(NO_CATEGORY_LABEL);

/* -------------------------------------------------------------------------- */
/* Entrada                                                                     */
/* -------------------------------------------------------------------------- */

/** Gasto de um mês por categoria, na mesma forma do breakdown do dashboard. */
export interface PeriodCategoryAmount {
  category: string;
  amountCents: number;
}

/**
 * Agregado de um mês/ciclo. Meses fechados vêm do snapshot; o ciclo corrente
 * pode ser passado em `current` ou marcado com `isCurrent`.
 */
export interface PeriodMonth {
  /** `YYYY-MM` (mês de início do ciclo no dashboard, mês calendário fora dele). */
  monthKey: string;
  incomeCents: number;
  consumedCents: number;
  fixedExpensesCents: number;
  variableExpensesCents: number;
  cardExpensesCents: number;
  categories: PeriodCategoryAmount[];
  /**
   * Série do gasto variável no eixo do gráfico "Consumo por dia" (1-based).
   * No dashboard por ciclo inclui avulsos + cartão do próprio mês; snapshots
   * antigos/seed podem trazer só avulsos. A projeção usa o resíduo de
   * `consumedCents`, então as duas convenções não duplicam nem perdem valor.
   */
  variableDailyCents?: number[];
  /** Obrigações por dia 1-based (informativo). */
  obligationDailyCents?: number[];
  /** Dias do mês/ciclo; default: tamanho da série diária. */
  daysInMonth?: number;
  /** Dias decorridos; default: `daysInMonth` (mês fechado). */
  elapsedDay?: number;
  /** Marca o ciclo corrente quando `current` não é passado. */
  isCurrent?: boolean;
}

export type PeriodTransactionSource = "variable" | "card";

/** Transação crua (avulso ou compra de cartão) para comportamento/qualidade. */
export interface PeriodTransaction {
  description: string;
  amountCents: number;
  date: Date;
  category?: string | null;
  source: PeriodTransactionSource;
  paymentMethod?: PaymentMethod;
  creditCardId?: string | null;
  cardId?: string | null;
  installmentsTotal?: number;
  installmentNumber?: number;
}

export interface PeriodFixedExpense {
  name: string;
  amountCents: number;
  dueDay: number;
  category?: string | null;
  active?: boolean;
}

export interface PeriodIncome {
  name: string;
  amountCents: number;
  receiveDay: number;
  active?: boolean;
}

export interface PeriodCard {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  limitCents?: number | null;
}

/** Compra de cartão com a regra de competência do cartão embutida. */
export interface PeriodCardPurchase {
  description: string;
  amountCents: number;
  purchaseDate: Date;
  category?: string | null;
  cardId?: string;
  card: { closingDay: number; dueDay: number };
  installmentsTotal?: number;
  installmentNumber?: number;
}

export interface PeriodReserveSnapshot {
  monthKey: string;
  amountCents: number;
}

export interface PeriodGoal {
  id: string;
  name: string;
  targetCents: number;
  /** Quanto da reserva já está earmarked para esta meta. */
  allocatedCents?: number;
  priority?: number;
}

export interface PeriodAnalysisInput {
  /** Meses fechados, em ordem cronológica. O corrente pode estar aqui. */
  months: PeriodMonth[];
  /** Ciclo corrente (alternativa a `months[].isCurrent`). */
  current?: PeriodMonth;
  /**
   * Transações dos últimos meses; inclua as compras de cartão para dedupe.
   * Por padrão são recortadas pelos `monthKey` de `months`/`current`.
   */
  transactions?: PeriodTransaction[];
  /**
   * Quando `true`, `transactions` já vem recortada pelo chamador (necessário
   * quando o ciclo financeiro cruza dois meses civis). O motor não filtra.
   */
  transactionsPreFiltered?: boolean;
  fixedExpenses?: PeriodFixedExpense[];
  incomes?: PeriodIncome[];
  cards?: PeriodCard[];
  cardPurchases?: PeriodCardPurchase[];
  reserveSnapshots?: PeriodReserveSnapshot[];
  goals?: PeriodGoal[];
  /** Meses esperados (para detectar buracos no histórico). */
  expectedMonthKeys?: string[];
  /** Mês de referência das parcelas futuras; default: mês em exibição. */
  referenceMonthKey?: string;
  /** Meses de parcelas futuras a projetar. Default: 6. */
  monthsAhead?: number;
  /** Meses fechados usados como base. Default: 4. */
  baselineMonths?: number;
  /** Reserva de emergência em meses de custo fixo. Default: 6. */
  emergencyMonths?: number;
  /** Categorias que não devem receber sugestão de corte. */
  essentialCategories?: string[];
}

/* -------------------------------------------------------------------------- */
/* Saída                                                                       */
/* -------------------------------------------------------------------------- */

export type PeriodConfidence = "low" | "medium" | "high";
export type SurplusTrend = "improving" | "worsening" | "stable" | "unknown";

export interface PeriodMonthFlow {
  monthKey: string;
  incomeCents: number;
  consumedCents: number;
  surplusCents: number;
  savingsRatePercent: number;
  consumedPercent: number;
  isCurrent: boolean;
}

export interface PeriodFlowAnalysis {
  months: PeriodMonthFlow[];
  closedMonthsCount: number;
  averageIncomeCents: number;
  averageConsumedCents: number;
  averageSurplusCents: number;
  medianSurplusCents: number;
  savingsRatePercent: number;
  positiveMonths: number;
  negativeMonths: number;
  bestMonth: PeriodMonthFlow | null;
  worstMonth: PeriodMonthFlow | null;
  trend: SurplusTrend;
  trendDeltaCents: number;
}

export interface PeriodPaceAnalysis {
  elapsedDay: number;
  daysInPeriod: number;
  currentVariableSpendCents: number;
  typicalVariableSpendAtSameDayCents: number;
  deltaCents: number;
  deltaPercent: number | null;
  currentFixedExpensesCents: number;
  currentCardExpensesCents: number;
  projectedVariableSpendCents: number;
  projectedConsumedCents: number;
  projectedConsumedPercent: number;
  baselineMonthsCount: number;
}

export interface PeriodCategoryAnalysis {
  category: string;
  currentCents: number;
  averageCents: number;
  medianCents: number;
  deltaCents: number;
  deltaPercent: number | null;
  shareOfConsumedPercent: number;
  monthsPresent: number;
}

export interface PeriodCompositionAnalysis {
  totalConsumedCents: number;
  incomeCents: number;
  fixedCents: number;
  variableCents: number;
  cardCents: number;
  fixedSharePercent: number;
  variableSharePercent: number;
  cardSharePercent: number;
  fixedCostRatioPercent: number;
  averageFixedCostRatioPercent: number;
  categories: PeriodCategoryAnalysis[];
  topCategories: PeriodCategoryAnalysis[];
  topMovers: PeriodCategoryAnalysis[];
  uncategorizedCents: number;
  uncategorizedSharePercent: number;
}

export interface PeriodDueDayBucket {
  label: "early" | "mid" | "late";
  count: number;
  amountCents: number;
}

export interface PeriodFutureInstallmentMonth {
  monthKey: string;
  amountCents: number;
  purchaseCount: number;
}

export interface PeriodCardCommitment {
  cardId: string;
  cardName: string;
  futureCents: number;
  limitCents: number | null;
  limitUsagePercent: number | null;
}

export interface PeriodCommitmentsAnalysis {
  fixedExpensesTotalCents: number;
  fixedExpenseCount: number;
  fixedCostRatioPercent: number;
  largestFixedExpenses: {
    name: string;
    amountCents: number;
    category: string | null;
  }[];
  dueDayBuckets: PeriodDueDayBucket[];
  firstIncomeDay: number | null;
  fixedBeforeFirstIncomeCents: number;
  fixedBeforeFirstIncomePercent: number;
  futureInstallments: PeriodFutureInstallmentMonth[];
  futureInstallmentsTotalCents: number;
  futureInstallmentsPeak: PeriodFutureInstallmentMonth | null;
  installmentPurchasesCount: number;
  installmentPurchasesSharePercent: number;
  cards: PeriodCardCommitment[];
}

export interface PeriodMerchantAnalysis {
  merchantKey: string;
  merchantName: string;
  category: string | null;
  purchaseCount: number;
  totalCents: number;
  averageTicketCents: number;
  medianTicketCents: number;
  monthsPresent: number;
  /** Compras por mês considerando todos os meses da janela. */
  monthlyFrequency: number;
}

export interface PeriodLargePurchase {
  description: string;
  merchantKey: string;
  amountCents: number;
  date: Date;
  category: string | null;
  installmentsTotal: number;
  source: PeriodTransactionSource;
}

export interface PeriodTicketBucket {
  label: string;
  minCents: number;
  maxCents: number | null;
  count: number;
  totalCents: number;
  countSharePercent: number;
  totalSharePercent: number;
}

export interface PeriodRecurringMerchant {
  merchantKey: string;
  merchantName: string;
  category: string | null;
  monthsPresent: number;
  averageMonthlyCount: number;
  averageTicketCents: number;
  amountVariationPercent: number;
  lastAmountCents: number;
  likelySubscription: boolean;
}

export interface PeriodBehaviorAnalysis {
  monthsCount: number;
  transactionCount: number;
  totalCents: number;
  merchants: PeriodMerchantAnalysis[];
  topMerchants: PeriodMerchantAnalysis[];
  largePurchases: PeriodLargePurchase[];
  ticketBuckets: PeriodTicketBucket[];
  recurringMerchants: PeriodRecurringMerchant[];
  weekendAmountCents: number;
  weekendSharePercent: number;
  /** Share do gasto variável na última quarta parte do período em exibição. */
  endOfPeriodVariableSharePercent: number | null;
  installmentPurchasesSharePercent: number;
}

export interface PeriodCreditWithoutCard {
  description: string;
  amountCents: number;
  date: Date;
  category: string | null;
}

export interface PeriodDataQualityAnalysis {
  transactionCount: number;
  uncategorizedCount: number;
  uncategorizedCents: number;
  uncategorizedSharePercent: number;
  creditExpensesCount: number;
  creditExpensesWithoutCardCount: number;
  creditExpensesWithoutCardCents: number;
  creditExpensesWithoutCard: PeriodCreditWithoutCard[];
  monthsWithoutDailySeries: string[];
  missingMonths: string[];
  confidence: PeriodConfidence;
}

export interface PeriodGoalAnalysis {
  id: string;
  name: string;
  targetCents: number;
  allocatedCents: number;
  gapCents: number;
  progressPercent: number;
}

export interface PeriodReserveAnalysis {
  confirmedCents: number | null;
  monthKey: string | null;
  ageMonths: number | null;
  averageFixedExpensesCents: number;
  targetMonths: number;
  emergencyTargetCents: number;
  emergencyCents: number | null;
  coverageMonths: number | null;
  gapCents: number | null;
  monthsToTarget: number | null;
  inferredAccumulatedSurplusCents: number;
  reserveDeltaCents: number | null;
  inferredBetweenSnapshotsCents: number | null;
  /** Positivo = sobra estimada que não apareceu na reserva (vazamento). */
  unaccountedCents: number | null;
  confirmsBaseline: boolean;
  goals: PeriodGoalAnalysis[];
}

export type PeriodAnomalyKind =
  | "negative-surplus"
  | "pace-above"
  | "category-spike"
  | "large-purchase"
  | "duplicate-charge"
  | "price-increase"
  | "installment-commitment"
  | "credit-without-card"
  | "uncategorized-data"
  | "reserve-unaccounted"
  | "short-history";

export type PeriodAnomalySeverity = "info" | "warning" | "critical";

export interface PeriodAnomaly {
  id: string;
  factId: string;
  kind: PeriodAnomalyKind;
  severity: PeriodAnomalySeverity;
  title: string;
  detail: string;
  amountCents?: number;
  deltaPercent?: number;
  monthKey?: string;
}

export type PeriodSavingsLeverKind =
  | "frequency"
  | "ticket"
  | "subscription"
  | "category";

export interface PeriodSavingsLever {
  id: string;
  kind: PeriodSavingsLeverKind;
  merchantKey?: string;
  merchantName?: string;
  category?: string;
  currentMonthlyCount?: number;
  currentAverageTicketCents?: number;
  proposedReduction?: number;
  monthlySavingsCents: number;
  confidence: PeriodConfidence;
  essential: boolean;
  reason: string;
}

export interface PeriodAnalysis {
  period: {
    from: string;
    to: string;
    monthsCount: number;
    closedMonthsCount: number;
    includesCurrent: boolean;
    confidence: PeriodConfidence;
  };
  flow: PeriodFlowAnalysis;
  pace: PeriodPaceAnalysis | null;
  composition: PeriodCompositionAnalysis;
  commitments: PeriodCommitmentsAnalysis;
  behavior: PeriodBehaviorAnalysis;
  dataQuality: PeriodDataQualityAnalysis;
  reserve: PeriodReserveAnalysis;
  anomalies: PeriodAnomaly[];
  levers: PeriodSavingsLever[];
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

function safePercent(part: number, total: number): number {
  return total > 0 ? roundPercent((part / total) * 100) : 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function monthIndex(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return year * 12 + (month - 1);
}

function monthsBetween(from: string, to: string): number {
  return Math.max(monthIndex(to) - monthIndex(from), 0);
}

function dayDiff(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / DAY_MS);
}

/** Chave estável de merchant: sem prefixo de adquirente, sem parcela, sem acento. */
export function normalizeMerchantKey(description: string): string {
  const base = cleanMerchantDisplay(description)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return base || description.trim().toLocaleLowerCase("pt-BR");
}

const PARCEL_SUFFIX = /\s*(?:-\s*)?parcela\s*\d+\s*\/\s*\d+\s*$/i;
const MERCHANT_PREFIX = /^(?:ifd|mp|pag|paypal|amzn|amazon)[\s*._-]+/i;

/** Rótulo exibido do merchant: remove prefixo de adquirente e sufixo de parcela. */
export function cleanMerchantDisplay(description: string): string {
  const withoutSuffix = description.replace(PARCEL_SUFFIX, "").trim();
  const withoutPrefix = withoutSuffix.replace(MERCHANT_PREFIX, "").trim();
  return (withoutPrefix || withoutSuffix).replace(/\s+/g, " ");
}

function categoryTotals(items: PeriodCategoryAmount[]): {
  totals: Map<string, number>;
  labels: Map<string, string>;
} {
  const totals = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const item of items) {
    const rawKey = categoryKey(item.category);
    // Categoria vazia/ausente é agrupada sob "Sem categoria" para o lookup de
    // `uncategorizedCents` não depender do texto original.
    const key = rawKey === "" ? NO_CATEGORY_KEY : rawKey;
    const amount = Math.max(item.amountCents, 0);
    totals.set(key, (totals.get(key) ?? 0) + amount);
    if (!labels.has(key)) labels.set(key, categoryLabel(item.category));
  }

  return { totals, labels };
}

function uniqueMonths(months: PeriodMonth[]): PeriodMonth[] {
  const byKey = new Map<string, PeriodMonth>();
  for (const month of months) byKey.set(month.monthKey, month);
  return [...byKey.values()].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
}

function filterTransactionsByMonths(
  transactions: PeriodTransaction[],
  months: PeriodMonth[],
): PeriodTransaction[] {
  if (months.length === 0) return [...transactions];
  const allowed = new Set(months.map((month) => month.monthKey));
  return transactions.filter((transaction) =>
    allowed.has(monthKey(transaction.date)),
  );
}

/* -------------------------------------------------------------------------- */
/* Fluxo                                                                       */
/* -------------------------------------------------------------------------- */

function buildFlow(
  allMonths: PeriodMonth[],
  closedMonths: PeriodMonth[],
  currentKey: string | null,
): PeriodFlowAnalysis {
  const base = closedMonths.length > 0 ? closedMonths : allMonths;
  const monthFlows: PeriodMonthFlow[] = allMonths.map((month) => {
    const surplusCents = month.incomeCents - month.consumedCents;
    return {
      monthKey: month.monthKey,
      incomeCents: month.incomeCents,
      consumedCents: month.consumedCents,
      surplusCents,
      savingsRatePercent: safePercent(surplusCents, month.incomeCents),
      consumedPercent: safePercent(month.consumedCents, month.incomeCents),
      isCurrent: month.monthKey === currentKey,
    };
  });

  const averageIncomeCents = Math.round(
    average(base.map((month) => month.incomeCents)),
  );
  const averageConsumedCents = Math.round(
    average(base.map((month) => month.consumedCents)),
  );
  const averageSurplusCents = averageIncomeCents - averageConsumedCents;
  const medianSurplusCents = Math.round(
    median(base.map((month) => month.incomeCents - month.consumedCents)),
  );

  const baseFlows = monthFlows.filter((flow) =>
    base.some((month) => month.monthKey === flow.monthKey),
  );
  const positiveMonths = baseFlows.filter(
    (flow) => flow.surplusCents > 0,
  ).length;
  const negativeMonths = baseFlows.filter(
    (flow) => flow.surplusCents < 0,
  ).length;

  let bestMonth: PeriodMonthFlow | null = null;
  let worstMonth: PeriodMonthFlow | null = null;
  for (const flow of baseFlows) {
    if (
      bestMonth === null ||
      flow.surplusCents > bestMonth.surplusCents ||
      (flow.surplusCents === bestMonth.surplusCents &&
        flow.monthKey < bestMonth.monthKey)
    ) {
      bestMonth = flow;
    }
    if (
      worstMonth === null ||
      flow.surplusCents < worstMonth.surplusCents ||
      (flow.surplusCents === worstMonth.surplusCents &&
        flow.monthKey < worstMonth.monthKey)
    ) {
      worstMonth = flow;
    }
  }

  let trend: SurplusTrend = "unknown";
  let trendDeltaCents = 0;
  if (baseFlows.length >= 2) {
    const middle = Math.floor(baseFlows.length / 2);
    const first = average(
      baseFlows.slice(0, middle).map((flow) => flow.surplusCents),
    );
    const second = average(
      baseFlows.slice(middle).map((flow) => flow.surplusCents),
    );
    trendDeltaCents = Math.round(second - first);
    const threshold = Math.max(
      1000,
      Math.round(averageIncomeCents * 0.02),
    );
    if (Math.abs(trendDeltaCents) < threshold) trend = "stable";
    else trend = trendDeltaCents > 0 ? "improving" : "worsening";
  }

  return {
    months: monthFlows,
    closedMonthsCount: closedMonths.length,
    averageIncomeCents,
    averageConsumedCents,
    averageSurplusCents,
    medianSurplusCents,
    savingsRatePercent: safePercent(
      averageSurplusCents,
      averageIncomeCents,
    ),
    positiveMonths,
    negativeMonths,
    bestMonth,
    worstMonth,
    trend,
    trendDeltaCents,
  };
}

/* -------------------------------------------------------------------------- */
/* Ritmo                                                                       */
/* -------------------------------------------------------------------------- */

function sumFirst(values: number[], count: number): number {
  return sum(values.slice(0, Math.max(count, 0)));
}

function buildPace(
  current: PeriodMonth | null,
  closedMonths: PeriodMonth[],
): PeriodPaceAnalysis | null {
  if (current === null) return null;
  const daily = current.variableDailyCents;
  if (!daily || daily.length === 0) return null;

  const daysInPeriod = Math.max(
    current.daysInMonth ?? daily.length,
    0,
  );
  const elapsedDay = Math.min(
    Math.max(current.elapsedDay ?? daysInPeriod, 0),
    daysInPeriod,
  );
  if (elapsedDay <= 0 || daysInPeriod <= 0) return null;

  const currentVariableSpendCents = sumFirst(daily, elapsedDay);

  const baselineValues = closedMonths
    .filter(
      (month) =>
        month.variableDailyCents !== undefined &&
        month.variableDailyCents.length >= elapsedDay,
    )
    .map((month) => sumFirst(month.variableDailyCents ?? [], elapsedDay));

  const typicalVariableSpendAtSameDayCents = Math.round(
    median(baselineValues),
  );
  const deltaCents =
    currentVariableSpendCents - typicalVariableSpendAtSameDayCents;
  const deltaPercent =
    typicalVariableSpendAtSameDayCents > 0
      ? roundPercent(
          (deltaCents / typicalVariableSpendAtSameDayCents) * 100,
        )
      : null;

  const projectedVariableSpendCents = Math.round(
    (currentVariableSpendCents / elapsedDay) * daysInPeriod,
  );
  // Resíduo robusto às duas convenções de `variableDailyCents`: o que já foi
  // consumido e não está na série (fixas + cartão/parcelas fora dela) continua
  // comprometido; só o variável é projetado pelo ritmo.
  const nonVariableConsumedCents = Math.max(
    current.consumedCents - currentVariableSpendCents,
    0,
  );
  const projectedConsumedCents =
    nonVariableConsumedCents + projectedVariableSpendCents;

  return {
    elapsedDay,
    daysInPeriod,
    currentVariableSpendCents,
    typicalVariableSpendAtSameDayCents,
    deltaCents,
    deltaPercent,
    currentFixedExpensesCents: current.fixedExpensesCents,
    currentCardExpensesCents: current.cardExpensesCents,
    projectedVariableSpendCents,
    projectedConsumedCents,
    projectedConsumedPercent: safePercent(
      projectedConsumedCents,
      current.incomeCents,
    ),
    baselineMonthsCount: baselineValues.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Composição                                                                  */
/* -------------------------------------------------------------------------- */

function emptyComposition(): PeriodCompositionAnalysis {
  return {
    totalConsumedCents: 0,
    incomeCents: 0,
    fixedCents: 0,
    variableCents: 0,
    cardCents: 0,
    fixedSharePercent: 0,
    variableSharePercent: 0,
    cardSharePercent: 0,
    fixedCostRatioPercent: 0,
    averageFixedCostRatioPercent: 0,
    categories: [],
    topCategories: [],
    topMovers: [],
    uncategorizedCents: 0,
    uncategorizedSharePercent: 0,
  };
}

function buildComposition(
  display: PeriodMonth | null,
  closedMonths: PeriodMonth[],
  allMonths: PeriodMonth[],
  baselineMonths: number,
): PeriodCompositionAnalysis {
  if (display === null) return emptyComposition();

  const baseline = closedMonths
    .filter((month) => month.monthKey < display.monthKey)
    .slice(-baselineMonths);
  const baselineMaps = baseline.map((month) =>
    categoryTotals(month.categories),
  );
  const displayTotals = categoryTotals(display.categories);

  const keys = new Set<string>([
    ...displayTotals.totals.keys(),
    ...baselineMaps.flatMap((map) => [...map.totals.keys()]),
  ]);

  const labels = new Map<string, string>();
  for (const map of [...baselineMaps, displayTotals]) {
    for (const [key, label] of map.labels) {
      if (!labels.has(key)) labels.set(key, label);
    }
  }

  const categories: PeriodCategoryAnalysis[] = [...keys].map((key) => {
    const currentCents = displayTotals.totals.get(key) ?? 0;
    const baselineAmounts = baselineMaps.map(
      (map) => map.totals.get(key) ?? 0,
    );
    const averageCents =
      baselineAmounts.length > 0
        ? Math.round(average(baselineAmounts))
        : 0;
    const medianCents = Math.round(median(baselineAmounts));
    const deltaCents = currentCents - averageCents;
    const monthsPresent =
      baselineMaps.filter((map) => (map.totals.get(key) ?? 0) > 0).length +
      (currentCents > 0 ? 1 : 0);

    return {
      category:
        labels.get(key) ??
        (key === NO_CATEGORY_KEY ? NO_CATEGORY_LABEL : key),
      currentCents,
      averageCents,
      medianCents,
      deltaCents,
      deltaPercent:
        averageCents > 0
          ? roundPercent((deltaCents / averageCents) * 100)
          : null,
      shareOfConsumedPercent: safePercent(
        currentCents,
        display.consumedCents,
      ),
      monthsPresent,
    };
  });

  categories.sort(
    (a, b) =>
      b.currentCents - a.currentCents ||
      a.category.localeCompare(b.category, "pt-BR"),
  );

  const topMovers = [...categories]
    .filter((category) => category.deltaCents !== 0)
    .sort(
      (a, b) =>
        Math.abs(b.deltaCents) - Math.abs(a.deltaCents) ||
        a.category.localeCompare(b.category, "pt-BR"),
    )
    .slice(0, MAX_LIST_ITEMS);

  const averageFixedCostRatioPercent =
    baseline.length > 0
      ? roundPercent(
          average(
            baseline.map((month) =>
              month.incomeCents > 0
                ? (month.fixedExpensesCents / month.incomeCents) * 100
                : 0,
            ),
          ),
        )
      : safePercent(display.fixedExpensesCents, display.incomeCents);

  const uncategorizedCents =
    displayTotals.totals.get(NO_CATEGORY_KEY) ?? 0;

  return {
    totalConsumedCents: display.consumedCents,
    incomeCents: display.incomeCents,
    fixedCents: display.fixedExpensesCents,
    variableCents: display.variableExpensesCents,
    cardCents: display.cardExpensesCents,
    fixedSharePercent: safePercent(
      display.fixedExpensesCents,
      display.consumedCents,
    ),
    variableSharePercent: safePercent(
      display.variableExpensesCents,
      display.consumedCents,
    ),
    cardSharePercent: safePercent(
      display.cardExpensesCents,
      display.consumedCents,
    ),
    fixedCostRatioPercent: safePercent(
      display.fixedExpensesCents,
      display.incomeCents,
    ),
    averageFixedCostRatioPercent,
    categories,
    topCategories: categories.slice(0, MAX_LIST_ITEMS),
    topMovers,
    uncategorizedCents,
    uncategorizedSharePercent: safePercent(
      uncategorizedCents,
      display.consumedCents,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Compromissos                                                                */
/* -------------------------------------------------------------------------- */

function dueDayBucket(
  day: number,
): PeriodDueDayBucket["label"] {
  if (day <= 10) return "early";
  if (day <= 20) return "mid";
  return "late";
}

function buildCommitments(
  input: PeriodAnalysisInput,
  display: PeriodMonth | null,
  flow: PeriodFlowAnalysis,
): PeriodCommitmentsAnalysis {
  const fixedExpenses = (input.fixedExpenses ?? []).filter(
    (expense) => expense.active !== false,
  );
  const incomes = (input.incomes ?? []).filter(
    (income) => income.active !== false,
  );
  const fixedTotal = sum(fixedExpenses.map((expense) => expense.amountCents));

  const largestFixedExpenses = [...fixedExpenses]
    .sort(
      (a, b) =>
        b.amountCents - a.amountCents ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
    .slice(0, 3)
    .map((expense) => ({
      name: expense.name,
      amountCents: expense.amountCents,
      category: expense.category ?? null,
    }));

  const buckets: PeriodDueDayBucket[] = [
    { label: "early", count: 0, amountCents: 0 },
    { label: "mid", count: 0, amountCents: 0 },
    { label: "late", count: 0, amountCents: 0 },
  ];
  for (const expense of fixedExpenses) {
    const bucket = buckets.find(
      (item) => item.label === dueDayBucket(expense.dueDay),
    );
    if (bucket) {
      bucket.count += 1;
      bucket.amountCents += expense.amountCents;
    }
  }

  const firstIncomeDay =
    incomes.length > 0
      ? Math.min(...incomes.map((income) => income.receiveDay))
      : null;
  const fixedBeforeFirstIncomeCents =
    firstIncomeDay === null
      ? 0
      : sum(
          fixedExpenses
            .filter((expense) => expense.dueDay < firstIncomeDay)
            .map((expense) => expense.amountCents),
        );

  const referenceMonthKey =
    input.referenceMonthKey ??
    display?.monthKey ??
    input.current?.monthKey ??
    input.months[input.months.length - 1]?.monthKey ??
    null;

  const monthsAhead = Math.max(
    input.monthsAhead ?? DEFAULT_MONTHS_AHEAD,
    1,
  );
  const futureKeys =
    referenceMonthKey === null
      ? []
      : Array.from({ length: monthsAhead }, (_, index) =>
          shiftMonthKey(referenceMonthKey, index),
        );
  const futureByMonth = new Map<
    string,
    { amountCents: number; purchaseIndexes: Set<number> }
  >(futureKeys.map((key) => [key, { amountCents: 0, purchaseIndexes: new Set() }]));
  const futureByCard = new Map<string, number>();

  const purchases = input.cardPurchases ?? [];
  purchases.forEach((purchase, index) => {
    const installments = allocateInstallments(
      {
        purchaseDate: purchase.purchaseDate,
        amountCents: purchase.amountCents,
        installmentsTotal: purchase.installmentsTotal ?? 1,
      },
      purchase.card.closingDay,
      purchase.card.dueDay,
    );
    for (const installment of installments) {
      const bucket = futureByMonth.get(installment.monthKey);
      if (bucket === undefined) continue;
      bucket.amountCents += installment.amountCents;
      bucket.purchaseIndexes.add(index);
      if (purchase.cardId) {
        futureByCard.set(
          purchase.cardId,
          (futureByCard.get(purchase.cardId) ?? 0) + installment.amountCents,
        );
      }
    }
  });

  const futureInstallments = futureKeys
    .map((key) => {
      const bucket = futureByMonth.get(key);
      return {
        monthKey: key,
        amountCents: bucket?.amountCents ?? 0,
        purchaseCount: bucket?.purchaseIndexes.size ?? 0,
      };
    })
    .filter((month) => month.amountCents > 0);

  let futureInstallmentsPeak: PeriodFutureInstallmentMonth | null = null;
  for (const month of futureInstallments) {
    if (
      futureInstallmentsPeak === null ||
      month.amountCents > futureInstallmentsPeak.amountCents ||
      (month.amountCents === futureInstallmentsPeak.amountCents &&
        month.monthKey < futureInstallmentsPeak.monthKey)
    ) {
      futureInstallmentsPeak = month;
    }
  }

  const installmentPurchases = purchases.filter(
    (purchase) => (purchase.installmentsTotal ?? 1) > 1,
  );

  const cards: PeriodCardCommitment[] = (input.cards ?? []).map((card) => {
    const futureCents = futureByCard.get(card.id) ?? 0;
    const limitCents = card.limitCents ?? null;
    return {
      cardId: card.id,
      cardName: card.name,
      futureCents,
      limitCents,
      limitUsagePercent:
        limitCents !== null && limitCents > 0
          ? roundPercent((futureCents / limitCents) * 100)
          : null,
    };
  });

  return {
    fixedExpensesTotalCents: fixedTotal,
    fixedExpenseCount: fixedExpenses.length,
    fixedCostRatioPercent: safePercent(
      fixedTotal,
      flow.averageIncomeCents,
    ),
    largestFixedExpenses,
    dueDayBuckets: buckets,
    firstIncomeDay,
    fixedBeforeFirstIncomeCents,
    fixedBeforeFirstIncomePercent: safePercent(
      fixedBeforeFirstIncomeCents,
      fixedTotal,
    ),
    futureInstallments,
    futureInstallmentsTotalCents: sum(
      futureInstallments.map((month) => month.amountCents),
    ),
    futureInstallmentsPeak,
    installmentPurchasesCount: installmentPurchases.length,
    installmentPurchasesSharePercent: safePercent(
      installmentPurchases.length,
      purchases.length,
    ),
    cards,
  };
}

/* -------------------------------------------------------------------------- */
/* Comportamento                                                               */
/* -------------------------------------------------------------------------- */

function buildBehavior(
  transactions: PeriodTransaction[],
  allMonths: PeriodMonth[],
  display: PeriodMonth | null,
  flow: PeriodFlowAnalysis,
): PeriodBehaviorAnalysis {
  const monthsCount = Math.max(allMonths.length, 1);

  interface MerchantAccumulator {
    name: string;
    categoryCounts: Map<string, number>;
    amounts: number[];
    months: Set<string>;
  }

  const merchantMap = new Map<string, MerchantAccumulator>();
  let totalCents = 0;
  let weekendAmountCents = 0;
  let cardPurchasesCount = 0;
  let installmentPurchasesCount = 0;

  for (const transaction of transactions) {
    const amountCents = Math.max(transaction.amountCents, 0);
    totalCents += amountCents;

    const date = transaction.date;
    const day = date.getDay();
    if (day === 0 || day === 6) weekendAmountCents += amountCents;

    if (transaction.source === "card") {
      cardPurchasesCount += 1;
      if ((transaction.installmentsTotal ?? 1) > 1) {
        installmentPurchasesCount += 1;
      }
    }

    const merchantKey = normalizeMerchantKey(transaction.description);
    const existing = merchantMap.get(merchantKey);
    const accumulator: MerchantAccumulator =
      existing ?? {
        name: cleanMerchantDisplay(transaction.description),
        categoryCounts: new Map<string, number>(),
        amounts: [],
        months: new Set<string>(),
      };
    accumulator.amounts.push(amountCents);
    accumulator.months.add(monthKey(date));
    if (transaction.category) {
      const category = transaction.category.trim();
      if (category) {
        accumulator.categoryCounts.set(
          category,
          (accumulator.categoryCounts.get(category) ?? 0) + 1,
        );
      }
    }
    merchantMap.set(merchantKey, accumulator);
  }

  const merchants: PeriodMerchantAnalysis[] = [...merchantMap.entries()].map(
    ([merchantKey, accumulator]) => {
      const purchaseCount = accumulator.amounts.length;
      const merchantTotal = sum(accumulator.amounts);
      const category =
        [...accumulator.categoryCounts.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
        )[0]?.[0] ?? null;
      return {
        merchantKey,
        merchantName: accumulator.name,
        category,
        purchaseCount,
        totalCents: merchantTotal,
        averageTicketCents: Math.round(merchantTotal / purchaseCount),
        medianTicketCents: Math.round(median(accumulator.amounts)),
        monthsPresent: accumulator.months.size,
        monthlyFrequency: round1(purchaseCount / monthsCount),
      };
    },
  );

  const sortedMerchants = [...merchants].sort(
    (a, b) =>
      b.totalCents - a.totalCents ||
      a.merchantName.localeCompare(b.merchantName, "pt-BR"),
  );
  const topMerchants = sortedMerchants.slice(0, MAX_LIST_ITEMS);

  const allAmounts = transactions.map((transaction) =>
    Math.max(transaction.amountCents, 0),
  );
  const medianTicket = median(allAmounts);
  const largePurchaseThreshold = Math.max(
    Math.round(medianTicket * 3),
    Math.round(flow.averageIncomeCents * 0.05),
    DEFAULT_LARGE_PURCHASE_MIN_CENTS,
  );
  const largePurchases: PeriodLargePurchase[] = transactions
    .filter(
      (transaction) =>
        Math.max(transaction.amountCents, 0) >= largePurchaseThreshold,
    )
    .map((transaction) => ({
      description: cleanMerchantDisplay(transaction.description),
      merchantKey: normalizeMerchantKey(transaction.description),
      amountCents: transaction.amountCents,
      date: transaction.date,
      category: transaction.category ?? null,
      installmentsTotal: transaction.installmentsTotal ?? 1,
      source: transaction.source,
    }))
    .sort(
      (a, b) =>
        b.amountCents - a.amountCents ||
        a.date.getTime() - b.date.getTime() ||
        a.description.localeCompare(b.description, "pt-BR"),
    )
    .slice(0, MAX_LIST_ITEMS);

  const bucketDefinitions = [
    { label: "até R$ 50", minCents: 0, maxCents: 5000 },
    { label: "R$ 50 a R$ 200", minCents: 5001, maxCents: 20000 },
    { label: "acima de R$ 200", minCents: 20001, maxCents: null },
  ];
  const ticketBuckets: PeriodTicketBucket[] = bucketDefinitions.map(
    (bucket) => {
      const matches = transactions.filter((transaction) => {
        const amount = Math.max(transaction.amountCents, 0);
        return (
          amount >= bucket.minCents &&
          (bucket.maxCents === null || amount <= bucket.maxCents)
        );
      });
      const bucketTotal = sum(
        matches.map((transaction) => Math.max(transaction.amountCents, 0)),
      );
      return {
        label: bucket.label,
        minCents: bucket.minCents,
        maxCents: bucket.maxCents,
        count: matches.length,
        totalCents: bucketTotal,
        countSharePercent: safePercent(matches.length, transactions.length),
        totalSharePercent: safePercent(bucketTotal, totalCents),
      };
    },
  );

  const recurringMerchants: PeriodRecurringMerchant[] = merchants
    .filter(
      (merchant) =>
        merchant.monthsPresent >= 2 && merchant.purchaseCount >= 3,
    )
    .map((merchant) => {
      const accumulator = merchantMap.get(merchant.merchantKey);
      const amounts = accumulator?.amounts ?? [];
      const min = amounts.length > 0 ? Math.min(...amounts) : 0;
      const max = amounts.length > 0 ? Math.max(...amounts) : 0;
      const variation =
        merchant.averageTicketCents > 0
          ? ((max - min) / merchant.averageTicketCents) * 100
          : 0;
      const transactionsForMerchant = transactions
        .filter(
          (transaction) =>
            normalizeMerchantKey(transaction.description) ===
            merchant.merchantKey,
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const lastAmountCents =
        transactionsForMerchant[transactionsForMerchant.length - 1]
          ?.amountCents ?? 0;

      return {
        merchantKey: merchant.merchantKey,
        merchantName: merchant.merchantName,
        category: merchant.category,
        monthsPresent: merchant.monthsPresent,
        averageMonthlyCount: round1(
          merchant.purchaseCount / monthsCount,
        ),
        averageTicketCents: merchant.averageTicketCents,
        amountVariationPercent: roundPercent(variation),
        lastAmountCents,
        // Heurística conservadora: além de 1 compra/mês com valor estável,
        // limita o ticket para não confundir mercado/aluguel com assinatura.
        likelySubscription:
          merchant.monthsPresent >= 3 &&
          merchant.purchaseCount / monthsCount >= 0.8 &&
          merchant.purchaseCount / monthsCount <= 1.2 &&
          variation <= 15 &&
          merchant.averageTicketCents <= 10000,
      };
    })
    .sort(
      (a, b) =>
        Number(b.likelySubscription) - Number(a.likelySubscription) ||
        b.averageTicketCents - a.averageTicketCents ||
        a.merchantName.localeCompare(b.merchantName, "pt-BR"),
    );

  let endOfPeriodVariableSharePercent: number | null = null;
  if (
    display?.variableDailyCents !== undefined &&
    display.variableDailyCents.length > 0
  ) {
    const elapsedDay = Math.min(
      Math.max(display.elapsedDay ?? display.variableDailyCents.length, 0),
      display.variableDailyCents.length,
    );
    const periodTotal = sumFirst(display.variableDailyCents, elapsedDay);
    if (periodTotal > 0) {
      const lastQuarterStart = Math.floor(elapsedDay * 0.75);
      const lastQuarter = sum(
        display.variableDailyCents.slice(lastQuarterStart, elapsedDay),
      );
      endOfPeriodVariableSharePercent = safePercent(
        lastQuarter,
        periodTotal,
      );
    }
  }

  return {
    monthsCount,
    transactionCount: transactions.length,
    totalCents,
    merchants: sortedMerchants,
    topMerchants,
    largePurchases,
    ticketBuckets,
    recurringMerchants,
    weekendAmountCents,
    weekendSharePercent: safePercent(weekendAmountCents, totalCents),
    endOfPeriodVariableSharePercent,
    installmentPurchasesSharePercent: safePercent(
      installmentPurchasesCount,
      cardPurchasesCount,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Qualidade dos dados                                                         */
/* -------------------------------------------------------------------------- */

function creditMatchesCardPurchase(
  credit: PeriodTransaction,
  card: PeriodTransaction,
): boolean {
  if (
    credit.creditCardId &&
    card.cardId &&
    credit.creditCardId !== card.cardId
  ) {
    return false;
  }

  const days = dayDiff(credit.date, card.date);
  const totalInstallments = Math.max(card.installmentsTotal ?? 1, 1);
  const cardAmounts = [card.amountCents];
  if (totalInstallments > 1) {
    cardAmounts.push(Math.round(card.amountCents / totalInstallments));
  }
  const amountMatches = cardAmounts.some(
    (amount) => Math.abs(amount - credit.amountCents) <= 1,
  );
  if (!amountMatches) return false;
  if (days <= 3) return true;
  return (
    days <= 7 &&
    normalizeMerchantKey(credit.description) ===
      normalizeMerchantKey(card.description)
  );
}

function downgradeConfidence(
  confidence: PeriodConfidence,
): PeriodConfidence {
  return confidence === "high" ? "medium" : "low";
}

function buildDataQuality(
  transactions: PeriodTransaction[],
  allMonths: PeriodMonth[],
  closedMonthsCount: number,
  expectedMonthKeys: string[] | undefined,
): PeriodDataQualityAnalysis {
  const totalCents = sum(
    transactions.map((transaction) =>
      Math.max(transaction.amountCents, 0),
    ),
  );
  const uncategorized = transactions.filter((transaction) => {
    const key = categoryKey(transaction.category);
    return key === "" || key === NO_CATEGORY_KEY;
  });
  const uncategorizedCents = sum(
    uncategorized.map((transaction) =>
      Math.max(transaction.amountCents, 0),
    ),
  );

  const creditExpenses = transactions.filter(
    (transaction) =>
      transaction.source === "variable" &&
      transaction.paymentMethod === "CREDIT",
  );
  const cardTransactions = transactions.filter(
    (transaction) => transaction.source === "card",
  );
  const creditExpensesWithoutCard = creditExpenses
    .filter(
      (credit) =>
        !cardTransactions.some((card) =>
          creditMatchesCardPurchase(credit, card),
        ),
    )
    .map((credit) => ({
      description: cleanMerchantDisplay(credit.description),
      amountCents: credit.amountCents,
      date: credit.date,
      category: credit.category ?? null,
    }));

  const monthsWithoutDailySeries = allMonths
    .filter(
      (month) =>
        month.variableDailyCents === undefined ||
        month.variableDailyCents.length === 0,
    )
    .map((month) => month.monthKey);

  const presentMonths = new Set(allMonths.map((month) => month.monthKey));
  const missingMonths = (expectedMonthKeys ?? [])
    .filter((key) => !presentMonths.has(key))
    .sort((a, b) => a.localeCompare(b));

  const uncategorizedSharePercent = safePercent(
    uncategorizedCents,
    totalCents,
  );
  let confidence: PeriodConfidence =
    closedMonthsCount >= 6
      ? "high"
      : closedMonthsCount >= 3
        ? "medium"
        : "low";
  if (uncategorizedSharePercent > 20) {
    confidence = downgradeConfidence(confidence);
  }
  if (creditExpensesWithoutCard.length > 0) {
    confidence = downgradeConfidence(confidence);
  }
  if (closedMonthsCount < 2) confidence = "low";

  return {
    transactionCount: transactions.length,
    uncategorizedCount: uncategorized.length,
    uncategorizedCents,
    uncategorizedSharePercent,
    creditExpensesCount: creditExpenses.length,
    creditExpensesWithoutCardCount: creditExpensesWithoutCard.length,
    creditExpensesWithoutCardCents: sum(
      creditExpensesWithoutCard.map((credit) => credit.amountCents),
    ),
    creditExpensesWithoutCard,
    monthsWithoutDailySeries,
    missingMonths,
    confidence,
  };
}

/* -------------------------------------------------------------------------- */
/* Reserva e metas                                                             */
/* -------------------------------------------------------------------------- */

function buildReserve(
  input: PeriodAnalysisInput,
  display: PeriodMonth | null,
  flow: PeriodFlowAnalysis,
  commitments: PeriodCommitmentsAnalysis,
  closedMonths: PeriodMonth[],
): PeriodReserveAnalysis {
  const snapshotsByMonth = new Map<string, PeriodReserveSnapshot>();
  for (const snapshot of input.reserveSnapshots ?? []) {
    snapshotsByMonth.set(snapshot.monthKey, snapshot);
  }
  const snapshots = [...snapshotsByMonth.values()].sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
  const latest = snapshots[snapshots.length - 1] ?? null;
  const previous = snapshots[snapshots.length - 2] ?? null;

  const averageFixedExpensesCents = Math.round(
    closedMonths.length > 0
      ? average(closedMonths.map((month) => month.fixedExpensesCents))
      : commitments.fixedExpensesTotalCents,
  );
  const targetMonths = Math.max(
    input.emergencyMonths ?? DEFAULT_EMERGENCY_MONTHS,
    1,
  );
  const emergencyTargetCents = Math.round(
    averageFixedExpensesCents * targetMonths,
  );

  const goals: PeriodGoalAnalysis[] = (input.goals ?? [])
    .map((goal) => {
      const targetCents = Math.max(goal.targetCents, 0);
      const allocatedCents = Math.max(goal.allocatedCents ?? 0, 0);
      return {
        id: goal.id,
        name: goal.name,
        targetCents,
        allocatedCents,
        gapCents: Math.max(targetCents - allocatedCents, 0),
        progressPercent: Math.min(
          safePercent(allocatedCents, targetCents),
          100,
        ),
      };
    })
    .sort(
      (a, b) =>
        (input.goals?.find((goal) => goal.id === a.id)?.priority ?? 0) -
          (input.goals?.find((goal) => goal.id === b.id)?.priority ?? 0) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );

  const allocatedGoalsCents = sum(goals.map((goal) => goal.allocatedCents));
  const confirmedCents = latest?.amountCents ?? null;
  const emergencyCents =
    confirmedCents === null
      ? null
      : Math.max(confirmedCents - allocatedGoalsCents, 0);
  const coverageMonths =
    emergencyCents !== null && averageFixedExpensesCents > 0
      ? roundPercent(emergencyCents / averageFixedExpensesCents)
      : null;
  const gapCents =
    emergencyCents === null
      ? null
      : Math.max(emergencyTargetCents - emergencyCents, 0);

  const monthlySavingsCents = Math.max(flow.medianSurplusCents, 0);
  const monthsToTarget =
    gapCents === null
      ? null
      : gapCents === 0
        ? 0
        : monthlySavingsCents > 0
          ? Math.ceil(gapCents / monthlySavingsCents)
          : null;

  const inferredAccumulatedSurplusCents = sum(
    closedMonths.map(
      (month) => month.incomeCents - month.consumedCents,
    ),
  );

  const reserveDeltaCents =
    latest !== null && previous !== null
      ? latest.amountCents - previous.amountCents
      : null;

  const inferredBetweenSnapshotsCents =
    latest !== null && previous !== null
      ? sum(
          flow.months
            .filter(
              (month) =>
                !month.isCurrent &&
                month.monthKey > previous.monthKey &&
                month.monthKey <= latest.monthKey,
            )
            .map((month) => month.surplusCents),
        )
      : null;

  const unaccountedCents =
    reserveDeltaCents !== null &&
    inferredBetweenSnapshotsCents !== null
      ? inferredBetweenSnapshotsCents - reserveDeltaCents
      : null;

  const referenceMonthKey =
    input.referenceMonthKey ?? display?.monthKey ?? null;

  return {
    confirmedCents,
    monthKey: latest?.monthKey ?? null,
    ageMonths:
      latest !== null && referenceMonthKey !== null
        ? monthsBetween(latest.monthKey, referenceMonthKey)
        : null,
    averageFixedExpensesCents,
    targetMonths,
    emergencyTargetCents,
    emergencyCents,
    coverageMonths,
    gapCents,
    monthsToTarget,
    inferredAccumulatedSurplusCents,
    reserveDeltaCents,
    inferredBetweenSnapshotsCents,
    unaccountedCents,
    confirmsBaseline: previous !== null,
    goals,
  };
}

/* -------------------------------------------------------------------------- */
/* Anomalias                                                                   */
/* -------------------------------------------------------------------------- */

function anomalySeverityRank(severity: PeriodAnomalySeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function buildAnomalies(
  transactions: PeriodTransaction[],
  flow: PeriodFlowAnalysis,
  pace: PeriodPaceAnalysis | null,
  composition: PeriodCompositionAnalysis,
  commitments: PeriodCommitmentsAnalysis,
  behavior: PeriodBehaviorAnalysis,
  dataQuality: PeriodDataQualityAnalysis,
  reserve: PeriodReserveAnalysis,
): PeriodAnomaly[] {
  const anomalies: PeriodAnomaly[] = [];

  for (const month of flow.months) {
    if (month.isCurrent || month.surplusCents >= 0) continue;
    const missing = -month.surplusCents;
    const severity: PeriodAnomalySeverity =
      missing >= month.incomeCents * 0.1 ? "critical" : "warning";
    anomalies.push({
      id: `negative-surplus-${month.monthKey}`,
      factId: `flow-${month.monthKey}`,
      kind: "negative-surplus",
      severity,
      title: "Mês fechado no negativo",
      detail:
        `Em ${monthLabel(month.monthKey)}, o consumo passou da renda em ` +
        `${formatCents(missing)}.`,
      amountCents: missing,
      monthKey: month.monthKey,
    });
  }

  if (
    pace !== null &&
    pace.deltaPercent !== null &&
    pace.deltaPercent >= 15 &&
    pace.deltaCents >= 5000
  ) {
    anomalies.push({
      id: "pace-above",
      factId: "pace",
      kind: "pace-above",
      severity: "warning",
      title: "Ritmo acima do habitual",
      detail:
        `No dia ${pace.elapsedDay} do ciclo, o gasto variável está ` +
        `${formatCents(pace.deltaCents)} acima do habitual ` +
        `(+${pace.deltaPercent}%).`,
      amountCents: pace.deltaCents,
      deltaPercent: pace.deltaPercent,
    });
  }

  const categorySpikes = composition.categories
    .filter(
      (category) =>
        categoryKey(category.category) !== NO_CATEGORY_KEY &&
        category.deltaCents >= 5000 &&
        category.deltaPercent !== null &&
        category.deltaPercent >= 20,
    )
    .sort(
      (a, b) =>
        b.deltaCents - a.deltaCents ||
        a.category.localeCompare(b.category, "pt-BR"),
    )
    .slice(0, 3);
  for (const category of categorySpikes) {
    anomalies.push({
      id: `category-spike-${categoryKey(category.category)}`,
      factId: `category-${categoryKey(category.category)}`,
      kind: "category-spike",
      severity: "warning",
      title: "Categoria acima da base",
      detail:
        `${category.category} está ${formatCents(category.deltaCents)} ` +
        `acima da média dos últimos meses ` +
        `(+${category.deltaPercent}%).`,
      amountCents: category.deltaCents,
      deltaPercent: category.deltaPercent ?? undefined,
    });
  }

  for (const purchase of behavior.largePurchases.slice(0, 3)) {
    anomalies.push({
      id: `large-purchase-${purchase.merchantKey}-${purchase.date
        .toISOString()
        .slice(0, 10)}-${purchase.amountCents}`,
      factId: `large-purchase-${purchase.merchantKey}`,
      kind: "large-purchase",
      severity: "info",
      title: "Compra atípica",
      detail:
        `${purchase.description}: ${formatCents(purchase.amountCents)} em ` +
        `${monthLabel(monthKey(purchase.date))}.`,
      amountCents: purchase.amountCents,
      monthKey: monthKey(purchase.date),
    });
  }

  const duplicateKeys = new Set<string>();
  const byMerchantAmount = new Map<string, PeriodTransaction[]>();
  for (const transaction of transactions) {
    if (transaction.amountCents <= 0) continue;
    const key = `${normalizeMerchantKey(transaction.description)}|${
      transaction.amountCents
    }`;
    const list = byMerchantAmount.get(key) ?? [];
    list.push(transaction);
    byMerchantAmount.set(key, list);
  }
  for (const [key, list] of byMerchantAmount) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index];
      const previous = sorted[index - 1];
      const days = dayDiff(current.date, previous.date);
      if (days > 3) continue;
      const pairKey = `${key}|${previous.date.toISOString()}|${current.date.toISOString()}`;
      if (duplicateKeys.has(pairKey)) continue;
      duplicateKeys.add(pairKey);
      anomalies.push({
        id: `duplicate-${duplicateKeys.size}`,
        factId: `duplicate-${normalizeMerchantKey(current.description)}`,
        kind: "duplicate-charge",
        severity: "warning",
        title: "Possível cobrança duplicada",
        detail:
          `${cleanMerchantDisplay(current.description)}: duas compras de ` +
          `${formatCents(current.amountCents)} em ${days} ${
            days === 1 ? "dia" : "dias"
          }.`,
        amountCents: current.amountCents,
      });
      if (duplicateKeys.size >= 3) break;
    }
    if (duplicateKeys.size >= 3) break;
  }

  const priceIncreases: {
    merchantKey: string;
    merchantName: string;
    previousCents: number;
    lastCents: number;
  }[] = [];
  const merchantTransactions = new Map<string, PeriodTransaction[]>();
  for (const transaction of transactions) {
    const key = normalizeMerchantKey(transaction.description);
    const list = merchantTransactions.get(key) ?? [];
    list.push(transaction);
    merchantTransactions.set(key, list);
  }
  for (const [merchantKey, list] of merchantTransactions) {
    if (list.length < 3) continue;
    const sorted = [...list].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    const last = sorted[sorted.length - 1];
    const previousMedian = median(
      sorted.slice(0, -1).map((transaction) => transaction.amountCents),
    );
    if (
      last.amountCents > previousMedian * 1.1 &&
      last.amountCents - previousMedian >= 500
    ) {
      priceIncreases.push({
        merchantKey,
        merchantName: cleanMerchantDisplay(last.description),
        previousCents: Math.round(previousMedian),
        lastCents: last.amountCents,
      });
    }
  }
  for (const increase of priceIncreases
    .sort((a, b) => b.lastCents - b.previousCents - (a.lastCents - a.previousCents))
    .slice(0, 3)) {
    const delta = increase.lastCents - increase.previousCents;
    anomalies.push({
      id: `price-increase-${increase.merchantKey}`,
      factId: `price-increase-${increase.merchantKey}`,
      kind: "price-increase",
      severity: "info",
      title: "Preço aumentou",
      detail:
        `${increase.merchantName}: de ${formatCents(
          increase.previousCents,
        )} para ${formatCents(increase.lastCents)} ` +
        `(+${formatCents(delta)}).`,
      amountCents: delta,
    });
  }

  if (
    commitments.futureInstallmentsPeak !== null &&
    flow.averageIncomeCents > 0 &&
    commitments.futureInstallmentsPeak.amountCents /
      flow.averageIncomeCents >=
      0.25
  ) {
    anomalies.push({
      id: "installment-commitment",
      factId: "commitments-installments",
      kind: "installment-commitment",
      severity: "warning",
      title: "Parcelas comprometem o orçamento",
      detail:
        `O pico de parcelas é ${formatCents(
          commitments.futureInstallmentsPeak.amountCents,
        )} em ${monthLabel(
          commitments.futureInstallmentsPeak.monthKey,
        )}, ${safePercent(
          commitments.futureInstallmentsPeak.amountCents,
          flow.averageIncomeCents,
        )}% da renda média.`,
      amountCents: commitments.futureInstallmentsPeak.amountCents,
      monthKey: commitments.futureInstallmentsPeak.monthKey,
    });
  }

  if (dataQuality.creditExpensesWithoutCardCount > 0) {
    anomalies.push({
      id: "credit-without-card",
      factId: "data-quality-credit-without-card",
      kind: "credit-without-card",
      severity: "warning",
      title: "Crédito sem compra de cartão",
      detail:
        `${dataQuality.creditExpensesWithoutCardCount} lançamento(s) no ` +
        `crédito, ${formatCents(
          dataQuality.creditExpensesWithoutCardCents,
        )}, sem compra de cartão correspondente.`,
      amountCents: dataQuality.creditExpensesWithoutCardCents,
    });
  }

  if (dataQuality.uncategorizedSharePercent > 20) {
    anomalies.push({
      id: "uncategorized-data",
      factId: "data-quality-uncategorized",
      kind: "uncategorized-data",
      severity: "info",
      title: "Muitos gastos sem categoria",
      detail:
        `${dataQuality.uncategorizedSharePercent}% do valor analisado ` +
        `está sem categoria (${formatCents(
          dataQuality.uncategorizedCents,
        )}).`,
      amountCents: dataQuality.uncategorizedCents,
      deltaPercent: dataQuality.uncategorizedSharePercent,
    });
  }

  if (reserve.unaccountedCents !== null && reserve.unaccountedCents > 0) {
    anomalies.push({
      id: "reserve-unaccounted",
      factId: "reserve-unaccounted",
      kind: "reserve-unaccounted",
      severity: "warning",
      title: "Reserva não acompanhou a sobra",
      detail:
        `A reserva cresceu ${formatCents(
          reserve.reserveDeltaCents ?? 0,
        )}, mas a sobra estimada no período foi ` +
        `${formatCents(reserve.inferredBetweenSnapshotsCents ?? 0)}; ` +
        `faltam ${formatCents(reserve.unaccountedCents)}.`,
      amountCents: reserve.unaccountedCents,
    });
  }

  if (flow.closedMonthsCount < 2) {
    anomalies.push({
      id: "short-history",
      factId: "flow-short-history",
      kind: "short-history",
      severity: "info",
      title: "Base de análise curta",
      detail:
        `Há apenas ${flow.closedMonthsCount} mês(es) fechado(s); ` +
        "as conclusões têm baixa confiança.",
    });
  }

  return anomalies.sort(
    (a, b) =>
      anomalySeverityRank(a.severity) - anomalySeverityRank(b.severity) ||
      (b.amountCents ?? 0) - (a.amountCents ?? 0) ||
      a.id.localeCompare(b.id),
  );
}

/* -------------------------------------------------------------------------- */
/* Levers                                                                      */
/* -------------------------------------------------------------------------- */

function buildLevers(
  input: PeriodAnalysisInput,
  composition: PeriodCompositionAnalysis,
  behavior: PeriodBehaviorAnalysis,
): PeriodSavingsLever[] {
  const essential = new Set(
    (input.essentialCategories ?? []).map((category) =>
      categoryKey(category),
    ),
  );
  const levers: PeriodSavingsLever[] = [];
  const merchantLeverCategories = new Set<string>();
  const merchantLeverKeys = new Set<string>();

  const isEssential = (category: string | null | undefined): boolean =>
    category !== null &&
    category !== undefined &&
    essential.has(categoryKey(category));

  for (const merchant of behavior.merchants) {
    if (
      merchant.monthlyFrequency < 4 ||
      merchant.averageTicketCents < 2000 ||
      isEssential(merchant.category)
    ) {
      continue;
    }
    const monthlySpend = Math.round(
      merchant.totalCents / behavior.monthsCount,
    );
    const desiredReduction = merchant.monthlyFrequency >= 6 ? 2 : 1;
    const maxReduction = Math.max(
      1,
      Math.floor((monthlySpend * 0.3) / merchant.averageTicketCents),
    );
    const proposedReduction = Math.min(desiredReduction, maxReduction);
    const monthlySavingsCents =
      proposedReduction * merchant.averageTicketCents;
    if (monthlySavingsCents <= 0) continue;

    levers.push({
      id: `frequency-${merchant.merchantKey}`,
      kind: "frequency",
      merchantKey: merchant.merchantKey,
      merchantName: merchant.merchantName,
      category: merchant.category ?? undefined,
      currentMonthlyCount: merchant.monthlyFrequency,
      currentAverageTicketCents: merchant.averageTicketCents,
      proposedReduction,
      monthlySavingsCents,
      confidence:
        merchant.monthsPresent >= 3
          ? "high"
          : merchant.monthsPresent >= 2
            ? "medium"
            : "low",
      essential: false,
      reason:
        `${merchant.merchantName}: ${merchant.monthlyFrequency} ` +
        `compras/mês, ticket médio ${formatCents(
          merchant.averageTicketCents,
        )}. Cortar ${proposedReduction} por mês libera ` +
        `${formatCents(monthlySavingsCents)}/mês.`,
    });
    merchantLeverKeys.add(merchant.merchantKey);
    if (merchant.category) {
      merchantLeverCategories.add(categoryKey(merchant.category));
    }
  }

  for (const merchant of behavior.merchants) {
    if (
      merchantLeverKeys.has(merchant.merchantKey) ||
      merchant.monthlyFrequency < 3 ||
      merchant.averageTicketCents - merchant.medianTicketCents < 1000 ||
      merchant.averageTicketCents < merchant.medianTicketCents * 1.2 ||
      isEssential(merchant.category)
    ) {
      continue;
    }
    const monthlySavingsCents = Math.round(
      merchant.monthlyFrequency *
        (merchant.averageTicketCents - merchant.medianTicketCents),
    );
    if (monthlySavingsCents <= 0) continue;

    levers.push({
      id: `ticket-${merchant.merchantKey}`,
      kind: "ticket",
      merchantKey: merchant.merchantKey,
      merchantName: merchant.merchantName,
      category: merchant.category ?? undefined,
      currentMonthlyCount: merchant.monthlyFrequency,
      currentAverageTicketCents: merchant.averageTicketCents,
      monthlySavingsCents,
      confidence: "medium",
      essential: false,
      reason:
        `${merchant.merchantName}: ticket médio ` +
        `${formatCents(merchant.averageTicketCents)} vs. mediana ` +
        `${formatCents(merchant.medianTicketCents)}. Segurar no valor ` +
        `mediano libera ${formatCents(monthlySavingsCents)}/mês.`,
    });
    merchantLeverKeys.add(merchant.merchantKey);
    if (merchant.category) {
      merchantLeverCategories.add(categoryKey(merchant.category));
    }
  }

  for (const recurring of behavior.recurringMerchants) {
    if (
      !recurring.likelySubscription ||
      merchantLeverKeys.has(recurring.merchantKey) ||
      isEssential(recurring.category)
    ) {
      continue;
    }
    const monthlySavingsCents = Math.round(
      recurring.averageTicketCents * recurring.averageMonthlyCount,
    );
    if (monthlySavingsCents <= 0) continue;

    levers.push({
      id: `subscription-${recurring.merchantKey}`,
      kind: "subscription",
      merchantKey: recurring.merchantKey,
      merchantName: recurring.merchantName,
      category: recurring.category ?? undefined,
      currentMonthlyCount: recurring.averageMonthlyCount,
      currentAverageTicketCents: recurring.averageTicketCents,
      monthlySavingsCents,
      confidence: "medium",
      essential: false,
      reason:
        `${recurring.merchantName}: possível assinatura de ` +
        `${formatCents(monthlySavingsCents)}/mês. Revisar libera ` +
        `${formatCents(monthlySavingsCents)}/mês.`,
    });
    merchantLeverKeys.add(recurring.merchantKey);
    if (recurring.category) {
      merchantLeverCategories.add(categoryKey(recurring.category));
    }
  }

  for (const category of composition.categories) {
    if (
      categoryKey(category.category) === NO_CATEGORY_KEY ||
      category.deltaCents < 5000 ||
      category.deltaPercent === null ||
      category.deltaPercent < 20 ||
      isEssential(category.category) ||
      merchantLeverCategories.has(categoryKey(category.category))
    ) {
      continue;
    }
    const monthlySavingsCents = Math.min(
      category.deltaCents,
      category.currentCents,
    );
    if (monthlySavingsCents <= 0) continue;

    levers.push({
      id: `category-${categoryKey(category.category)}`,
      kind: "category",
      category: category.category,
      monthlySavingsCents,
      confidence: "medium",
      essential: false,
      reason:
        `${category.category}: ${formatCents(
          category.currentCents,
        )} vs. média ${formatCents(category.averageCents)}. Voltar à ` +
        `base libera ${formatCents(monthlySavingsCents)}/mês.`,
    });
  }

  return levers.sort(
    (a, b) =>
      b.monthlySavingsCents - a.monthlySavingsCents ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  );
}

/* -------------------------------------------------------------------------- */
/* Entrada principal                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Monta o diagnóstico do período. Nunca lança para dados vazios: devolve
 * zeros, listas vazias e confiança baixa.
 */
export function buildPeriodAnalysis(
  input: PeriodAnalysisInput,
): PeriodAnalysis {
  const months = uniqueMonths(input.months);
  const current =
    input.current ??
    [...months].reverse().find((month) => month.isCurrent === true) ??
    null;
  const allMonths =
    current === null
      ? months
      : uniqueMonths(
          months.map((month) =>
            month.monthKey === current.monthKey ? current : month,
          ).concat(
            months.some((month) => month.monthKey === current.monthKey)
              ? []
              : [current],
          ),
        );
  const closedMonths =
    current === null
      ? allMonths
      : allMonths.filter((month) => month.monthKey !== current.monthKey);
  const display =
    current ??
    closedMonths[closedMonths.length - 1] ??
    allMonths[allMonths.length - 1] ??
    null;
  const currentKey = current?.monthKey ?? null;

  const flow = buildFlow(allMonths, closedMonths, currentKey);
  const pace = buildPace(current, closedMonths);
  const composition = buildComposition(
    display,
    closedMonths,
    allMonths,
    input.baselineMonths ?? DEFAULT_BASELINE_MONTHS,
  );
  const commitments = buildCommitments(input, display, flow);

  const transactions = input.transactionsPreFiltered
    ? [...(input.transactions ?? [])]
    : filterTransactionsByMonths(input.transactions ?? [], allMonths);
  // Comportamento usa só o que entra no orçamento (CREDIT fica para a
  // conciliação com a fatura, em `dataQuality`), evitando dupla contagem.
  const behaviorTransactions = transactions.filter(
    (transaction) =>
      transaction.source === "card" ||
      transaction.paymentMethod === undefined ||
      isCountedInBudget(transaction.paymentMethod),
  );
  const behavior = buildBehavior(
    behaviorTransactions,
    allMonths,
    display,
    flow,
  );
  const dataQuality = buildDataQuality(
    transactions,
    allMonths,
    flow.closedMonthsCount,
    input.expectedMonthKeys,
  );
  const reserve = buildReserve(
    input,
    display,
    flow,
    commitments,
    closedMonths,
  );
  const anomalies = buildAnomalies(
    behaviorTransactions,
    flow,
    pace,
    composition,
    commitments,
    behavior,
    dataQuality,
    reserve,
  );
  const levers = buildLevers(input, composition, behavior);

  const from = allMonths[0]?.monthKey ?? "";
  const to = display?.monthKey ?? "";

  return {
    period: {
      from,
      to,
      monthsCount: allMonths.length,
      closedMonthsCount: closedMonths.length,
      includesCurrent: current !== null,
      confidence: dataQuality.confidence,
    },
    flow,
    pace,
    composition,
    commitments,
    behavior,
    dataQuality,
    reserve,
    anomalies,
    levers,
  };
}

/** Soma das economias mensais propostas pelos levers (atalho para a UI/IA). */
export function totalMonthlySavingsCents(
  analysis: Pick<PeriodAnalysis, "levers">,
): number {
  return sum(analysis.levers.map((lever) => lever.monthlySavingsCents));
}

/** Rótulo de confiança em pt-BR (texto exato testado). */
export function periodConfidenceLabel(
  confidence: PeriodConfidence,
): string {
  if (confidence === "high") return "Base confiável";
  if (confidence === "medium") return "Base parcial";
  return "Base curta";
}

/** Rótulo da tendência de sobra em pt-BR (texto exato testado). */
export function surplusTrendLabel(trend: SurplusTrend): string {
  if (trend === "improving") return "Sobra crescendo";
  if (trend === "worsening") return "Sobra caindo";
  if (trend === "stable") return "Sobra estável";
  return "Sem tendência";
}

/** Mês anterior mais recente a um `monthKey`, útil para buracos no histórico. */
export function previousMonthKey(monthKey: string): string {
  return shiftMonthKey(monthKey, -1);
}

/** Meses esperados entre `from` e `to`, inclusive (para `expectedMonthKeys`). */
export function monthKeysBetween(from: string, to: string): string[] {
  const start = monthIndex(from);
  const end = monthIndex(to);
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => {
    const total = start + index;
    const year = Math.floor(total / 12);
    const month = total - year * 12 + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
}
