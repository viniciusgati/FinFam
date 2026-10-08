import Link from "next/link";
import FutureMonthNotice from "@/components/FutureMonthNotice";
import RetryButton from "@/components/RetryButton";
import { HISTORY_TITLE, type CategoryTrend, type HistoryViewState } from "@/lib/history";
import { formatCents } from "@/lib/money";

export interface HistoryViewProps {
  view: HistoryViewState;
}

const TREND_LABELS: Record<CategoryTrend, string> = {
  maior: "maior",
  menor: "menor",
  igual: "igual",
};

/**
 * Apresentação de `/historico` a partir do view model puro de `history.ts`
 * (testável sem DOM). Aqui só há HTML/estilo.
 */
export default function HistoryView({ view }: HistoryViewProps) {
  if (view.state === "error") {
    return (
      <section
        role="alert"
        className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
      >
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-subtle">
            FinFam
          </p>
          <h1 className="text-3xl font-bold text-foreground">{view.message}</h1>
        </header>

        <RetryButton />
      </section>
    );
  }

  if (view.state === "future") {
    return <FutureMonthNotice />;
  }

  if (view.state === "empty") {
    return (
      <section className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-subtle">
            {HISTORY_TITLE}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{view.message}</h1>
        </header>

        <Link
          href={view.ctaHref}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          {view.ctaLabel}
        </Link>
      </section>
    );
  }

  const {
    title,
    selectedMonthLabel,
    entries,
    chart,
    comparison,
    comparisonTitle,
    tableHeaders,
  } = view;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center gap-1 rounded-2xl border border-border-strong bg-surface p-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-subtle">
          {title}
        </p>
        <h1 className="text-3xl font-bold text-foreground">
          {selectedMonthLabel}
        </h1>
      </section>

      <section
        aria-label="Meses anteriores"
        className="overflow-x-auto rounded-2xl border border-border-strong bg-surface"
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-subtle">
              <th scope="col" className="px-3 py-2 font-medium">
                {tableHeaders.month}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {tableHeaders.consumption}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {tableHeaders.dailyAverage}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {tableHeaders.percent}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {tableHeaders.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.monthKey}
                className="border-b border-border last:border-b-0"
              >
                <th
                  scope="row"
                  className="px-3 py-2 text-left font-normal text-foreground"
                >
                  {entry.label}
                  <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    {entry.levelLabel}
                  </span>
                </th>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatCents(entry.consumptionAvailableCents)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatCents(entry.dailyAverageCents)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">
                  {entry.percent}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatCents(entry.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section
        aria-label={chart.bars.length > 0 ? "Evolução dos meses" : undefined}
        className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface p-6"
      >
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          Evolução dos meses
        </h2>

        {chart.message && (
          <p className="text-foreground-muted">{chart.message}</p>
        )}

        {!chart.isEmpty && (
          <div
            role="img"
            aria-label={chart.ariaLabel}
            className="flex h-40 items-end gap-2"
          >
            {chart.bars.map((bar) => (
              <div
                key={bar.monthKey}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <span className="text-xs tabular-nums text-foreground-muted">
                  {bar.amountLabel}
                </span>
                <div
                  className="w-full rounded-t-md bg-emerald-500"
                  style={{ height: `${bar.heightPercent}%` }}
                />
                <span className="text-xs text-foreground-muted">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        aria-label={comparisonTitle}
        className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface p-6"
      >
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          {comparisonTitle}
        </h2>

        {comparison.isEmpty ? (
          <p className="text-foreground-muted">{comparison.emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-subtle">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Categoria
                  </th>
                  {comparison.months.map((month) => (
                    <th
                      key={month.monthKey}
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      {month.label}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Variação
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr
                    key={row.categoryKey}
                    className="border-b border-border last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-3 py-2 text-left font-normal text-foreground"
                    >
                      {row.category}
                    </th>
                    {row.values.map((value) => (
                      <td
                        key={value.monthKey}
                        className="px-3 py-2 text-right tabular-nums text-foreground"
                      >
                        {value.amountLabel}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {row.deltaLabel}
                      {row.trend && (
                        <span className="ml-1 text-xs uppercase tracking-wide text-foreground-muted">
                          {TREND_LABELS[row.trend]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
