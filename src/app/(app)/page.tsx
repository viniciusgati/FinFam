import Link from "next/link";
import { loadCycleAllowance, loadDashboardData } from "@/lib/dashboard";
import {
  cycleEndCountdownLabel,
  dailyAllowanceCard,
  remainingCycleDays,
  type DailyAllowance,
} from "@/lib/cycle";
import { getSettings } from "@/lib/settings";
import {
  actionableBudgetMessage,
  computeFinanceStatus,
  dashboardView,
  emptyStateCopy,
  monthKey,
  type DashboardView,
  type FinanceLevel,
} from "@/lib/finance";
import { invoiceDueLabel, resolveReferenceDate } from "@/lib/invoices";
import type { DailySeries } from "@/lib/dashboard-series";
import FutureMonthNotice from "@/components/FutureMonthNotice";
import {
  buildMonthReviewData,
  localMonthReview,
  monthReviewSnapshotFrom,
} from "@/lib/ai/month-review";
import RetryButton from "@/components/RetryButton";
import MonthSelector from "@/components/MonthSelector";
import DailySpendChart from "@/components/DailySpendChart";
import IncomeVsExpenseChart from "@/components/IncomeVsExpenseChart";
import MonthReviewPanel from "@/components/MonthReviewPanel";
import PurchaseSimulator from "@/components/PurchaseSimulator";
import QuickExpenseCard from "@/components/QuickExpenseCard";
import MonthSpendCard from "@/components/MonthSpendCard";
import DailyAllowanceCard from "@/components/DailyAllowanceCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const params = await searchParams;
  const mes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const referenceDate = resolveReferenceDate(mes);
  const referenceMonthKey = monthKey(referenceDate);
  const currentMonthKey = monthKey(new Date());
  const isCurrentMonth = referenceMonthKey >= currentMonthKey;
  const isFutureMonth = referenceMonthKey > currentMonthKey;
  const isCalendarMonth = referenceMonthKey === currentMonthKey;
  const isClosedMonth = referenceMonthKey < currentMonthKey;

  let view: DashboardView = { state: "error" };
  let backgroundColor = "hsl(0 0% 45%)";
  let cycleDaysRemaining = 0;
  let level: FinanceLevel = "neutral";
  let series: DailySeries | null = null;
  let localMonthSummary = "Ainda não há dados suficientes para avaliar o mês.";
  let allowance: DailyAllowance | null = null;

  try {
    const data = await loadDashboardData(referenceDate);
    const status = computeFinanceStatus(data);
    backgroundColor = status.color;
    // O contador do card principal segue o **ciclo financeiro** (não o mês
    // calendário): dia 08 com o ciclo fechando no dia 15 ⇒ "8 dias para o fim
    // do ciclo", contando o próprio dia. `status.daysRemaining` é do mês
    // calendário e não serve aqui.
    const { cycleStartDay } = await getSettings();
    cycleDaysRemaining = remainingCycleDays(referenceDate, cycleStartDay);
    level = status.level;
    series = data.series;
    localMonthSummary = localMonthReview(
      buildMonthReviewData(
        monthReviewSnapshotFrom(data),
        data.previousMonthsCents,
      ),
    );
    view = dashboardView({
      dbError: false,
      isFutureMonth,
      incomeCents: status.incomeCents,
      hasMovements: data.hasMovements,
      consumedPercent: status.consumedPercent,
      projectedPercent: status.projectedPercent,
      previousPercents: data.previousPercents,
    });

    // O card de diária segue o ciclo real; só faz sentido no mês corrente.
    if (isCalendarMonth) {
      allowance = await loadCycleAllowance();
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

  // Ritmo recente de gastos avulsos por dia do ciclo — base do simulador
  // "posso comprar?" (avulsos dentro do ciclo ÷ dias decorridos).
  const usualDailySpendCents =
    allowance !== null && allowance.elapsedDays > 0
      ? Math.round(allowance.variableSpentCents / allowance.elapsedDays)
      : null;

  const actionableMessage =
    view.state === "ok" && allowance !== null
      ? actionableBudgetMessage({
          hasData: allowance.hasData,
          level,
          projectedPercent: view.projectedPercent,
          freeBudgetCents: allowance.freeBudgetCents,
          dailyCents: allowance.dailyCents,
          remainingDays: allowance.remainingDays,
        })
      : null;

  return (
    <div className="flex w-full flex-col gap-6">
      <MonthSelector
        monthKey={referenceMonthKey}
        isCurrentMonth={isCurrentMonth}
        basePath="/"
      />

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

      {view.state === "future" && <FutureMonthNotice />}

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
        <>
          <div className="grid items-stretch gap-6 md:grid-cols-2">
            <MonthSpendCard
              backgroundColor={backgroundColor}
              percent={view.percent}
              level={level}
              invoiceDue={invoiceDueLabel(referenceDate)}
              countdownLabel={cycleEndCountdownLabel(cycleDaysRemaining)}
              feedback={view.feedback}
              actionableMessage={actionableMessage}
              projectedPercent={view.projectedPercent}
              projectedRisk={view.projectedRisk}
              className={isCalendarMonth ? "" : "md:col-span-2"}
            />

            {isCalendarMonth && <QuickExpenseCard />}
          </div>

          {allowance !== null && (
            <DailyAllowanceCard card={dailyAllowanceCard(allowance)} />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <IncomeVsExpenseChart
                entriesCents={series.entriesCents}
                expensesCents={series.totalExpensesCents}
              />
            </section>

            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <DailySpendChart
                dailyExpensesCents={series.dailyExpensesCents}
                cumulativeExpensesCents={series.cumulativeExpensesCents}
                elapsedDay={series.elapsedDay}
                highlightDay={isCalendarMonth ? series.elapsedDay : undefined}
              />
            </section>
          </div>

          <MonthReviewPanel
            key={referenceMonthKey}
            monthKey={referenceMonthKey}
            eligible={isClosedMonth}
            localSummary={localMonthSummary}
          />

          {allowance !== null && (
            <PurchaseSimulator
              key={referenceMonthKey}
              freeBudgetCents={allowance.freeBudgetCents}
              dailyCents={allowance.dailyCents}
              remainingDays={allowance.remainingDays}
              usualDailySpendCents={usualDailySpendCents}
            />
          )}
        </>
      )}
    </div>
  );
}
