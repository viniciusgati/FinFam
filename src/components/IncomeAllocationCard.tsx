import {
  buildIncomeAllocationView,
  type IncomeAllocationInput,
} from "@/lib/dashboard-charts";
import { formatCents } from "@/lib/money";

/**
 * Card "Para onde vai a renda": barra empilhada + lista com o destino de cada
 * real (contas fixas, fatura, avulsos e o que sobra). Todo o texto/número vem
 * de `buildIncomeAllocationView` (testável sem DOM).
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
        <p className="mt-4 text-sm text-subtle">{view.emptyMessage}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-foreground-muted">
            Renda do mês:{" "}
            <strong className="text-base font-bold tabular-nums text-foreground">
              {view.incomeLabel}
            </strong>
          </p>

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

          {view.overspent && view.overspentLabel !== null && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm font-medium text-red-200"
            >
              {view.overspentLabel}
            </p>
          )}
        </>
      )}
    </section>
  );
}
