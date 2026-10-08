import type { Metadata } from "next";
import Link from "next/link";
import MonthSelector from "@/components/MonthSelector";
import RetryButton from "@/components/RetryButton";
import FutureMonthNotice from "@/components/FutureMonthNotice";
import { loadDashboardData } from "@/lib/dashboard";
import {
  compareWithHistory,
  computeFinanceStatus,
  dashboardView,
  emptyStateCopy,
  levelLabel,
  monthKey,
  monthLabel,
  type DashboardView,
  type FinanceLevel,
} from "@/lib/finance";
import {
  buildMonthHistory,
  type MonthHistoryEntry,
} from "@/lib/history";
import { formatCents } from "@/lib/money";
import { resolveReferenceDate } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Histórico — FinFam" };

export default async function HistoricoPage({
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

  let view: DashboardView = { state: "error" };
  let history: MonthHistoryEntry[] = [];
  let selectedPercent = 0;
  let selectedLevel: FinanceLevel = "neutral";
  let comparison = "";

  try {
    const data = await loadDashboardData(referenceDate);
    const status = computeFinanceStatus(data);
    view = dashboardView({
      dbError: false,
      isFutureMonth,
      incomeCents: status.incomeCents,
      hasMovements: data.hasMovements,
      consumedPercent: status.consumedPercent,
      projectedPercent: status.projectedPercent,
      previousPercents: data.previousPercents,
    });

    if (view.state === "ok") {
      selectedPercent = status.consumedPercent;
      selectedLevel = status.level;
      comparison = compareWithHistory(
        status.consumedPercent,
        data.previousPercents,
      );
      history = buildMonthHistory(data.snapshots);
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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <MonthSelector
        monthKey={referenceMonthKey}
        isCurrentMonth={isCurrentMonth}
      />

      {view.state === "error" && (
        <section
          role="alert"
          className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
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
        <section className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
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

      {view.state === "ok" && (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col items-center gap-2 rounded-2xl border border-border-strong bg-surface p-6 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-subtle">
              {monthLabel(referenceMonthKey)}
            </p>
            <p className="text-5xl font-black tabular-nums text-foreground sm:text-6xl">
              {Math.round(selectedPercent)}
              <span className="align-top text-2xl sm:text-3xl">%</span>
            </p>
            <p className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              {levelLabel(selectedLevel)}
            </p>
          </section>

          <p
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-border-strong bg-surface-raised p-4 text-center text-lg text-foreground"
          >
            {comparison}
          </p>

          <section
            aria-label="Evolução dos meses"
            className="flex flex-col gap-2"
          >
            <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
              Evolução dos meses
            </h2>

            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center text-foreground-muted">
                Ainda não há meses anteriores registrados.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((entry) => (
                  <li
                    key={entry.monthKey}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border-strong bg-surface px-4 py-3"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {entry.label}
                    </span>
                    <span className="text-sm tabular-nums text-foreground-muted">
                      {formatCents(entry.totalCents)}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-foreground">
                      {entry.percent}%
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                      {entry.levelLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
