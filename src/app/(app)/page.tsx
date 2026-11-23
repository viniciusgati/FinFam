import Link from "next/link";
import {
  loadCycleDashboardData,
  loadOpenCycleExpenses,
  loadSavingsGoalHistory,
  resolveCycleReference,
} from "@/lib/dashboard";
import type { OpenExpensesSummary } from "@/lib/open-expenses";
import {
  cycleEndCountdownLabel,
  cycleLengthDays,
  cycleRangeLabel,
  cycleStartCountdownLabel,
  dailyAllowanceCard,
  dailyAllowanceScenarios,
  daysUntilCycleStart,
  remainingCycleDays,
  usualDailySpendCents,
  type CycleWindow,
  type DailyAllowance,
} from "@/lib/cycle";
import { defaultSettings, getSettings } from "@/lib/settings";
import {
  savingsGoalHistory,
  savingsGoalProgress,
  savingsGoalSavedCents,
  type SavingsGoalHistory,
} from "@/lib/savings-goal";
import {
  computeFinanceStatus,
  dashboardView,
  emptyStateCopy,
  monthKey,
  monthLabel,
  type DashboardView,
  type FinanceLevel,
} from "@/lib/finance";
import { cycleInvoicePaymentLabel } from "@/lib/invoices";
import { invoiceMonthKeyForCycle } from "@/lib/card-adjustment";
import {
  loadCardAdjustmentData,
  type CardAdjustmentData,
} from "@/lib/card-adjustment-data";
import { loadCategorySuggestions } from "@/lib/category-suggestions";
import {
  buildDashboardLayout,
  type DashboardBlock,
} from "@/lib/dashboard-layout";
import type { DailySeries } from "@/lib/dashboard-series";
import CyclePreviewNotice from "@/components/CyclePreviewNotice";
import DashboardZones from "@/components/DashboardZones";
import {
  buildMonthReviewData,
  localMonthReview,
  monthReviewSnapshotFrom,
} from "@/lib/ai/month-review";
import {
  buildFamilyHelpData,
  buildFamilyInsightInput,
  localFamilyHelp,
} from "@/lib/ai/family-help";
import {
  buildFamilyInsights,
  type FamilyInsight,
} from "@/lib/family-insights";
import { buildSpendAdvice, type SpendAdvice } from "@/lib/spend-advice";
import RetryButton from "@/components/RetryButton";
import MonthNavigation from "@/components/MonthNavigation";
import DailyConsumptionChart from "@/components/DailyConsumptionChart";
import IncomeAllocationCard from "@/components/IncomeAllocationCard";
import MonthReviewPanel from "@/components/MonthReviewPanel";
import QuickCardAdjustmentCard from "@/components/QuickCardAdjustmentCard";
import PurchaseSimulator from "@/components/PurchaseSimulator";
import QuickExpenseCard from "@/components/QuickExpenseCard";
import MonthSpendCard from "@/components/MonthSpendCard";
import DailyAllowanceCard from "@/components/DailyAllowanceCard";
import ShoppingListCard from "@/components/ShoppingListCard";
import { buildShoppingPlan, type ShoppingItem } from "@/lib/shopping-list";
import { loadActiveShoppingItems } from "@/lib/shopping-items";
import SpendAdviceCard from "@/components/SpendAdviceCard";
import CategoryBreakdownCard from "@/components/CategoryBreakdownCard";
import FutureCommitmentsCard from "@/components/FutureCommitmentsCard";
import OpenExpensesCard from "@/components/OpenExpensesCard";
import SavingsGoalCard from "@/components/SavingsGoalCard";
import FamilyHelpCard from "@/components/FamilyHelpCard";
import type { CategoryBreakdown } from "@/lib/category-breakdown";
import type { FutureCommitmentMonth } from "@/lib/future-commitments";
import type {
  UpcomingBill,
  UpcomingEndingSoon,
} from "@/lib/upcoming";
import { resolveTimeZone, zonedDateParts } from "@/lib/time";

export const dynamic = "force-dynamic";

function isoDateInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(date, timeZone);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * O dashboard usa o **ciclo financeiro** como moldura: `?mes=YYYY-MM` é o mês
 * de início do ciclo (ex.: `2026-10` = 15/10–14/11), exibido pelo **mês da
 * fatura** (`novembro de 2026`). Renda, obrigações, avulsos, série e categorias
 * contam pela janela; o cartão entra pelas **compras** (parcela k no ciclo da
 * compra + k−1 meses) e as faturas que **vencem** na janela aparecem numa linha
 * informativa (caixa), fora do consumo. Ciclos futuros podem ser pré-visualizados
 * (previsão com o que já está lançado).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const params = await searchParams;
  const mes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const now = new Date();

  let view: DashboardView = { state: "error" };
  let backgroundColor = "hsl(0 0% 45%)";
  let countdownLabel = cycleEndCountdownLabel(0);
  let level: FinanceLevel = "neutral";
  let series: DailySeries | null = null;
  let incomeCents = 0;
  let fixedIncomeCents = 0;
  let variableIncomeCents = 0;
  let consumedCents = 0;
  let projectedCents = 0;
  let fixedExpensesCents = 0;
  let variableExpensesCents = 0;
  let cardExpensesCents = 0;
  let invoicePaymentLabel: string | null = null;
  let localMonthSummary = "Ainda não há dados suficientes para avaliar o mês.";
  let allowance: DailyAllowance | null = null;
  let allowanceWithoutGoal: DailyAllowance | null = null;
  let cycleIncomeCents = 0;
  let spendAdvice: SpendAdvice | null = null;
  let categoryBreakdown: CategoryBreakdown | null = null;
  let cardAdjustmentData: CardAdjustmentData | null = null;
  let futureCommitments: FutureCommitmentMonth[] = [];
  let upcomingBills: UpcomingBill[] = [];
  let endingSoon: UpcomingEndingSoon[] = [];
  let hasFutureCommitments = false;
  let openExpenses: OpenExpensesSummary = { totalCents: 0, count: 0 };
  let shoppingItems: ShoppingItem[] = [];
  let shoppingLoadFailed = false;
  let familyInsights: FamilyInsight[] = [];
  let familyHelpFallback = "";
  let cycleStartDay = defaultSettings().cycleStartDay;
  let savingsGoalCents = defaultSettings().savingsGoalCents ?? 0;
  let referenceMonthKey = monthKey(now);
  let referenceWindow: CycleWindow | null = null;
  let isCurrentCycle = false;
  let isClosedCycle = false;
  let isFutureCycle = false;
  let isNextDisabled = true;

  try {
    const settings = await getSettings();
    cycleStartDay = settings.cycleStartDay;
    savingsGoalCents = settings.savingsGoalCents ?? 0;
    const reference = resolveCycleReference(mes, now, cycleStartDay);
    referenceMonthKey = reference.cycleKey;
    referenceWindow = reference.window;
    isCurrentCycle = reference.isCurrent;
    isClosedCycle = !reference.isCurrent && !reference.isFuture;
    isFutureCycle = reference.isFuture;
    isNextDisabled = reference.isFuture;

    const data = await loadCycleDashboardData(reference, now);
    openExpenses = await loadOpenCycleExpenses(now);
    const status = computeFinanceStatus(data);
    backgroundColor = status.color;
    // O contador do card principal segue o estado do ciclo: no corrente, dias
    // até o fim; no futuro, dias até começar; em ciclo fechado, encerrado.
    countdownLabel = reference.isCurrent
      ? cycleEndCountdownLabel(remainingCycleDays(now, cycleStartDay))
      : reference.isFuture
        ? cycleStartCountdownLabel(daysUntilCycleStart(reference.window, now))
        : cycleEndCountdownLabel(0);
    level = status.level;
    series = data.series;
    incomeCents = status.incomeCents;
    fixedIncomeCents = data.fixedIncomeCents;
    variableIncomeCents = data.variableIncomeCents;
    consumedCents = status.consumedCents;
    projectedCents = status.projectedCents;
    fixedExpensesCents = data.fixedExpensesCents;
    variableExpensesCents = data.variableExpensesCents;
    cardExpensesCents = data.cardExpensesCents;
    invoicePaymentLabel = cycleInvoicePaymentLabel(
      data.invoicePaymentCents ?? 0,
    );
    categoryBreakdown = data.categoryBreakdown;
    futureCommitments = data.futureCommitments ?? [];
    upcomingBills = data.upcoming?.bills ?? [];
    endingSoon = data.upcoming?.endingSoon ?? [];
    hasFutureCommitments =
      futureCommitments.some((month) => month.totalCents > 0) ||
      upcomingBills.length > 0 ||
      endingSoon.length > 0;
    localMonthSummary = localMonthReview(
      buildMonthReviewData(
        monthReviewSnapshotFrom(data),
        data.previousMonthsCents,
      ),
    );
    // Ciclo futuro também mostra os números — como previsão (o aviso acima
    // explica); o estado "future" do view model fica só no histórico.
    view = dashboardView({
      dbError: false,
      isFutureMonth: false,
      incomeCents: status.incomeCents,
      hasMovements: data.hasMovements,
      consumedPercent: status.consumedPercent,
      projectedPercent: status.projectedPercent,
      previousPercents: data.previousPercents,
    });

    // O card de diária segue o ciclo real; só faz sentido no ciclo corrente ou
    // na previsão do próximo (com a janela inteira por decorrer). O cartão
    // entra como consumo (compras pela data), não como obrigação. Com meta
    // configurada, o cenário principal reserva a meta antes da diária; o
    // comparativo sem meta fica disponível para o card.
    if (isCurrentCycle || reference.isFuture) {
      const scenarios = dailyAllowanceScenarios({
        incomeCents: data.monthlyIncomeCents,
        fixedExpensesCents: data.fixedExpensesCents,
        savingsGoalCents,
        variableSpentCents:
          data.variableExpensesCents + data.cardExpensesCents,
        cycleStartDay,
        now: isCurrentCycle ? now : reference.asOf,
      });
      allowance = scenarios.withGoal;
      allowanceWithoutGoal =
        scenarios.goalCents !== null ? scenarios.withoutGoal : null;
      cycleIncomeCents = data.monthlyIncomeCents;
    }

    // Um único bloco de recomendação no ciclo corrente: compara o consumo
    // variável do ciclo com o orçamento variável (renda − contas fixas − meta
    // de economia). Sem movimentação não há ritmo a avaliar.
    spendAdvice = data.hasMovements
      ? buildSpendAdvice({
          windowDays: data.series.daysInMonth,
          elapsedDays: data.series.elapsedDay,
          incomeCents: data.monthlyIncomeCents,
          fixedExpensesCents: data.fixedExpensesCents,
          variableConsumedCents:
            data.variableExpensesCents + data.cardExpensesCents,
          savingsGoalCents,
          isCurrentCycle,
        })
      : null;

    if (view.state === "ok") {
      const familyInput = buildFamilyInsightInput({
        referenceMonthKey,
        isCurrentCycle,
        data,
      });
      familyInsights = buildFamilyInsights(familyInput);
      familyHelpFallback = localFamilyHelp(buildFamilyHelpData(familyInput));
    }

    // O bloco de ajuste só existe no ciclo corrente: carrega os cartões e o
    // total de competência do mês de fatura exibido (mesmo deslocamento do
    // seletor de mês). Ajustes em ciclos fechado/futuro ficam fora de escopo.
    if (isCurrentCycle) {
      cardAdjustmentData = await loadCardAdjustmentData(
        invoiceMonthKeyForCycle(referenceMonthKey, cycleStartDay),
        now,
      );
    }
  } catch {
    view = dashboardView({
      dbError: true,
      isFutureMonth: false,
      incomeCents: 0,
      hasMovements: false,
      consumedPercent: 0,
      projectedPercent: 0,
      previousPercents: [],
    });
  }

  // A lista de compras é lida fora do bloco principal: uma falha nela não pode
  // derrubar o dashboard — o bloco apenas vai para `failed`.
  if (view.state === "ok") {
    try {
      shoppingItems = await loadActiveShoppingItems();
    } catch {
      shoppingLoadFailed = true;
    }
  }

  const todayIso = isoDateInTimeZone(now, resolveTimeZone());
  // O plano usa a diária já calculada do ciclo, sem novas consultas financeiras.
  const shoppingPlan =
    shoppingItems.length > 0
      ? buildShoppingPlan(shoppingItems, allowance?.dailyCents ?? 0)
      : null;

  // Sugestões de categoria para o lançamento rápido: só fazem sentido no ciclo
  // corrente (quando o card aparece); falha de leitura cai para [].
  const categorySuggestions = isCurrentCycle
    ? await loadCategorySuggestions()
    : [];

  // Guardado realizado do ciclo até hoje (não o orçamento variável inteiro):
  // `max(0, round(B × dias_decorridos / dias_da_janela) − consumo variável)`.
  // Sem diária calculada não há progresso para acompanhar.
  const savingsGoal =
    allowance !== null
      ? savingsGoalProgress({
          goalCents: savingsGoalCents,
          savedCents: savingsGoalSavedCents({
            incomeCents: cycleIncomeCents,
            fixedExpensesCents,
            variableSpentCents: variableExpensesCents + cardExpensesCents,
            elapsedDays: allowance.elapsedDays,
            windowDays: cycleLengthDays(allowance.window),
          }),
          remainingDays: allowance.remainingDays,
        })
      : null;

  // Histórico dos meses fechados que bateram a meta: só faz sentido com meta
  // configurada. Uma falha na leitura não pode derrubar o dashboard — o card
  // continua sem a seção de histórico.
  let savingsGoalHistoryResult: SavingsGoalHistory | null = null;
  if (savingsGoal !== null && savingsGoalCents > 0) {
    try {
      const months = await loadSavingsGoalHistory(now);
      savingsGoalHistoryResult = savingsGoalHistory(months, savingsGoalCents);
    } catch {
      savingsGoalHistoryResult = null;
    }
  }

  // Ritmo recente de consumo do ciclo — base do simulador "Posso comprar?":
  // avulsos + compras do cartão do ciclo, ÷ dias decorridos.
  const usualDailySpend =
    allowance !== null && series !== null
      ? usualDailySpendCents({
          variableSpentCents: variableExpensesCents + cardExpensesCents,
          cardExpensesCents: 0,
          elapsedDays: series.elapsedDay,
        })
      : null;

  // Os blocos disponíveis viram zonas de decisão (Resumo → Ações →
  // Compromissos → Explorar). Cada condicional de exibição vira o estado do
  // bloco: o que não pode ser exibido entra como `error` e fica fora das zonas.
  const blocks: DashboardBlock[] = [
    { id: "month-spend", state: "ok" },
    ...(shoppingPlan !== null
      ? [{ id: "shopping-list" as const, state: "ok" as const }]
      : shoppingLoadFailed
        ? [{ id: "shopping-list" as const, state: "error" as const }]
        : []),
    { id: "spend-advice", state: spendAdvice !== null ? "ok" : "error" },
    { id: "quick-expense", state: isCurrentCycle ? "ok" : "error" },
    { id: "daily-allowance", state: allowance !== null ? "ok" : "error" },
    {
      id: "card-adjustment",
      state: cardAdjustmentData !== null ? "ok" : "error",
    },
    { id: "income-allocation", state: "ok" },
    { id: "daily-consumption", state: "ok" },
    {
      id: "category-breakdown",
      state: categoryBreakdown !== null ? "ok" : "error",
    },
    { id: "savings-goal", state: savingsGoal !== null ? "ok" : "error" },
    {
      id: "future-commitments",
      state: hasFutureCommitments ? "ok" : "empty",
    },
    {
      id: "purchase-simulator",
      state: isCurrentCycle && allowance !== null ? "ok" : "error",
    },
    { id: "open-expenses", state: "ok" },
    { id: "family-help", state: "ok" },
    { id: "month-review", state: "ok" },
  ];
  const { zones } = buildDashboardLayout(blocks);

  const monthSpendCard =
    view.state === "ok" ? (
      <MonthSpendCard
        backgroundColor={backgroundColor}
        percent={view.percent}
        level={level}
        invoiceDue={invoicePaymentLabel ?? ""}
        countdownLabel={countdownLabel}
        feedback={view.feedback}
        projectedPercent={view.projectedPercent}
        projectedRisk={view.projectedRisk}
        incomeCents={incomeCents}
        consumedCents={consumedCents}
        projectedCents={projectedCents}
      />
    ) : null;

  return (
    <div className="flex w-full flex-col gap-6">
      <MonthNavigation
        monthKey={referenceMonthKey}
        isCurrentMonth={isNextDisabled}
        basePath="/"
        rangeLabel={
          referenceWindow ? cycleRangeLabel(referenceWindow) : undefined
        }
        queryMonthShift={cycleStartDay === 1 ? 0 : 1}
      >
        {isFutureCycle && <CyclePreviewNotice />}

        {view.state === "error" && (
          <section
            role="alert"
            aria-live="assertive"
            className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
          >
            <header className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-widest text-subtle">
                FinFam
              </p>
              <h1 className="text-3xl font-bold text-foreground">
                Não foi possível carregar seus dados. Tente novamente.
              </h1>
            </header>

            <RetryButton />
          </section>
        )}

        {view.state === "empty" && (
          <section className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
            <header className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-widest text-subtle">
                FinFam
              </p>
              <h1 className="text-3xl font-bold text-foreground">
                {emptyStateCopy(view.reason).title}
              </h1>
            </header>

            <p className="text-lg text-foreground-muted">
              {emptyStateCopy(view.reason).body}
            </p>

            <Link
              href={emptyStateCopy(view.reason).ctaHref}
              className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              {emptyStateCopy(view.reason).ctaLabel}
            </Link>
          </section>
        )}

        {view.state === "ok" && series !== null && (
          <DashboardZones
            zones={zones}
            renderZone={(zone) => {
              switch (zone.id) {
                case "summary":
                  return (
                    <>
                      {shoppingPlan !== null ? (
                        <div className="grid gap-6 md:grid-cols-2 items-stretch">
                          {monthSpendCard}
                          <ShoppingListCard
                            plan={shoppingPlan}
                            items={shoppingItems}
                            referenceDate={todayIso}
                          />
                        </div>
                      ) : (
                        monthSpendCard
                      )}

                      {spendAdvice !== null && (
                        <SpendAdviceCard advice={spendAdvice} />
                      )}
                    </>
                  );
                case "actions":
                  return (
                    <>
                      {(isCurrentCycle || allowance !== null) && (
                        <div
                          className={
                            isCurrentCycle
                              ? "grid items-stretch gap-6 md:grid-cols-2"
                              : "grid gap-6"
                          }
                        >
                          {isCurrentCycle && (
                            <QuickExpenseCard
                              categorySuggestions={categorySuggestions}
                              cards={cardAdjustmentData?.cards ?? []}
                              referenceMonthKey={referenceMonthKey}
                              windowStart={
                                referenceWindow
                                  ? isoDateInTimeZone(
                                      referenceWindow.start,
                                      resolveTimeZone(),
                                    )
                                  : undefined
                              }
                              windowNextStart={
                                referenceWindow
                                  ? isoDateInTimeZone(
                                      referenceWindow.nextStart,
                                      resolveTimeZone(),
                                    )
                                  : undefined
                              }
                            />
                          )}
                          {allowance !== null && (
                            <DailyAllowanceCard
                              card={dailyAllowanceCard(allowance, {
                                showToday: isCurrentCycle,
                                withoutGoal: allowanceWithoutGoal ?? undefined,
                              })}
                            />
                          )}
                        </div>
                      )}

                      {cardAdjustmentData !== null && (
                        <QuickCardAdjustmentCard
                          key={referenceMonthKey}
                          cards={cardAdjustmentData.cards}
                          totalsByCard={cardAdjustmentData.totalsByCard}
                          monthKey={cardAdjustmentData.monthKey}
                        />
                      )}
                    </>
                  );
                case "commitments":
                  return (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <IncomeAllocationCard
                          incomeCents={incomeCents}
                          fixedIncomeCents={fixedIncomeCents}
                          variableIncomeCents={variableIncomeCents}
                          fixedExpensesCents={fixedExpensesCents}
                          cardExpensesCents={cardExpensesCents}
                          variableExpensesCents={variableExpensesCents}
                        />

                        <DailyConsumptionChart
                          variableDailyCents={series.variableDailyCents}
                          obligationDailyCents={series.obligationDailyCents}
                          elapsedDay={series.elapsedDay}
                          highlightDay={
                            isCurrentCycle ? series.elapsedDay : undefined
                          }
                        />
                      </div>

                      {categoryBreakdown !== null && (
                        <CategoryBreakdownCard breakdown={categoryBreakdown} />
                      )}

                      {savingsGoal !== null && (
                        <SavingsGoalCard
                          progress={savingsGoal}
                          history={savingsGoalHistoryResult}
                        />
                      )}

                      <FutureCommitmentsCard
                        months={futureCommitments}
                        bills={upcomingBills}
                        endingSoon={endingSoon}
                      />

                      {isCurrentCycle &&
                        allowance !== null &&
                        series !== null && (
                          <PurchaseSimulator
                            key={referenceMonthKey}
                            freeBudgetCents={allowance.freeBudgetCents}
                            dailyCents={allowance.dailyCents}
                            remainingDays={allowance.remainingDays}
                            usualDailySpendCents={usualDailySpend}
                            savingsGoalCents={savingsGoalCents}
                            savingsGoalSavedCents={
                              savingsGoal?.savedCents ?? 0
                            }
                          />
                        )}

                      <OpenExpensesCard
                        summary={openExpenses}
                        emptyLabel={monthLabel(referenceMonthKey)}
                      />
                    </>
                  );
                case "explore":
                  return (
                    <>
                      <FamilyHelpCard
                        insights={familyInsights}
                        fallback={familyHelpFallback}
                        monthKey={referenceMonthKey}
                      />

                      <MonthReviewPanel
                        key={referenceMonthKey}
                        monthKey={referenceMonthKey}
                        eligible={isClosedCycle}
                        localSummary={localMonthSummary}
                      />
                    </>
                  );
                default:
                  return null;
              }
            }}
          />
        )}
      </MonthNavigation>
    </div>
  );
}
