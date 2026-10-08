import Link from "next/link";
import { loadCycleAllowance, loadDashboardData } from "@/lib/dashboard";
import { dailyAllowanceCard, type DailyAllowance } from "@/lib/cycle";
import {
  computeFinanceStatus,
  dashboardView,
  levelLabel,
  monthKey,
  type DashboardView,
  type FinanceLevel,
} from "@/lib/finance";
import { invoiceDueLabel, resolveReferenceDate } from "@/lib/invoices";
import { rateDay } from "@/lib/day-rating";
import type { DailySeries } from "@/lib/dashboard-series";
import {
  buildMonthReviewData,
  localMonthReview,
  monthReviewSnapshotFrom,
} from "@/lib/ai/month-review";
import RetryButton from "@/components/RetryButton";
import MonthSelector from "@/components/MonthSelector";
import DayRatingBadge from "@/components/DayRatingBadge";
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
  const isCalendarMonth = referenceMonthKey === currentMonthKey;
  const isClosedMonth = referenceMonthKey < currentMonthKey;

  let view: DashboardView = { state: "error" };
  let backgroundColor = "hsl(0 0% 45%)";
  let daysRemaining = 0;
  let level: FinanceLevel = "neutral";
  let incomeCents = 0;
  let series: DailySeries | null = null;
  let previousMonthsCents: number[] = [];
  let localMonthSummary = "Ainda não há dados suficientes para avaliar o mês.";
  let allowance: DailyAllowance | null = null;

  try {
    const data = await loadDashboardData(referenceDate);
    const status = computeFinanceStatus(data);
    backgroundColor = status.color;
    daysRemaining = status.daysRemaining;
    level = status.level;
    incomeCents = status.incomeCents;
    series = data.series;
    previousMonthsCents = data.previousMonthsCents;
    localMonthSummary = localMonthReview(
      buildMonthReviewData(
        monthReviewSnapshotFrom(data),
        data.previousMonthsCents,
      ),
    );
    view = dashboardView({
      dbError: false,
      incomeCents: status.incomeCents,
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
      incomeCents: 0,
      consumedPercent: 0,
      projectedPercent: 0,
      previousPercents: [],
    });
  }

  const rating =
    series !== null
      ? rateDay({
          dailyBudgetCents: series.dailyBudgetCents,
          todayExpensesCents: series.todayExpensesCents,
          incomeCents,
        })
      : { level, label: levelLabel(level) };

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

      {view.state === "empty" && (
        <section className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
          <header className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-widest text-subtle">
              FinFam
            </p>
            <h1 className="text-3xl font-bold text-foreground">Sem dados ainda</h1>
          </header>

          <p className="text-lg text-foreground-muted">
            Cadastre suas entradas fixas para ver o percentual de renda consumida.
          </p>

          <Link
            href="/entradas"
            className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            Cadastrar entradas
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
              daysRemaining={daysRemaining}
              feedback={view.feedback}
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

          <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              Avaliação do dia
            </h2>
            <DayRatingBadge
              level={rating.level}
              label={rating.label}
              ariaLabel={`Avaliação do dia: ${rating.label}`}
            />
          </section>

          <MonthReviewPanel
            key={referenceMonthKey}
            monthKey={referenceMonthKey}
            eligible={isClosedMonth}
            localSummary={localMonthSummary}
          />

          <PurchaseSimulator
            key={referenceMonthKey}
            incomeCents={incomeCents}
            spentCents={series.totalExpensesCents}
            elapsedDay={series.elapsedDay}
            daysInMonth={series.daysInMonth}
            previousMonthsCents={previousMonthsCents}
          />
        </>
      )}
    </div>
  );
}
