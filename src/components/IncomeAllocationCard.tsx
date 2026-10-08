import Link from "next/link";
import {
  buildIncomeAllocationView,
  type IncomeAllocationInput,
} from "@/lib/dashboard-charts";
import { formatCents } from "@/lib/money";

/**
 * Card "Para onde vai a renda": entradas decompostas (fixas + variáveis +
 * total), barra empilhada das saídas e lista textual com o destino de cada real
 * (contas fixas, fatura, avulsos e saldo do mês), além do consumo disponível.
 * Todo o texto/número vem de `buildIncomeAllocationView` (testável sem DOM).
 */
export default function IncomeAllocationCard(input: IncomeAllocationInput) {
  const view = buildIncomeAllocationView(input);

  return (
    <section
      aria-label={view.title}
      className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-foreground-muted">
        {view.title}
      </h2>

      {view.isEmpty ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-sm text-subtle">{view.emptyMessage}</p>
          <Link
            href={view.emptyCtaHref}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {view.emptyCtaLabel}
          </Link>
        </div>
      ) : (
        <>
          <dl className="mt-2 space-y-1 text-sm">
            {view.entriesByType.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between gap-3">
                <dt className="text-foreground-muted">{entry.label}</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {entry.amountLabel}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-1">
              <dt className="font-medium text-foreground">Total de entradas</dt>
              <dd className="text-base font-bold tabular-nums text-foreground">
                {view.incomeLabel}
              </dd>
            </div>
          </dl>

          <div
            role="img"
            aria-label={view.ariaLabel}
            className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-surface-strong"
          >
            {view.rows.map((row) => (
              <div
                key={row.key}
                className={row.barClass}
                style={{ width: `${row.percent}%` }}
              />
            ))}
          </div>

          <ul className="mt-3 space-y-1">
            {view.rows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 text-foreground-muted">
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-sm ${row.barClass}`}
                  />
                  {row.label}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCents(row.amountCents)}{" "}
                  <span className="font-normal text-subtle">
                    ({row.percent}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <span className="text-foreground-muted">Consumo disponível</span>
            <span className="font-semibold tabular-nums text-foreground">
              {view.consumptionLabel}
            </span>
          </p>

          {view.overspent && (
            <>
              <p className="mt-1 flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground-muted">Saldo do mês</span>
                <span className="font-semibold tabular-nums text-red-300">
                  {view.balanceLabel}
                </span>
              </p>
              {view.overspentLabel !== null && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm font-medium text-red-200"
                >
                  {view.overspentLabel}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
