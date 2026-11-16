import Link from "next/link";
import { monthLabel } from "@/lib/finance";
import type { FutureCommitmentMonth } from "@/lib/future-commitments";
import { formatCents } from "@/lib/money";
import {
  billLineLabel,
  endingSoonLabel,
  type UpcomingBill,
  type UpcomingEndingSoon,
} from "@/lib/upcoming";

export interface FutureCommitmentsCardProps {
  months: FutureCommitmentMonth[];
  bills?: UpcomingBill[];
  endingSoon?: UpcomingEndingSoon[];
  className?: string;
}

/**
 * Bloco "Compromissos futuros": parcelas dos próximos meses, vencimentos do
 * ciclo e contas perto de terminar, em um único lugar. Os textos de cada linha
 * vêm das funções puras `billLineLabel`/`endingSoonLabel` (testadas sem DOM);
 * aqui só há a apresentação e os links para detalhar.
 */
export default function FutureCommitmentsCard({
  months,
  bills = [],
  endingSoon = [],
  className = "",
}: FutureCommitmentsCardProps) {
  const hasInstallments = months.some((month) => month.totalCents > 0);
  const isEmpty =
    !hasInstallments && bills.length === 0 && endingSoon.length === 0;

  return (
    <section
      aria-label="Compromissos futuros"
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm ${className}`.trim()}
    >
      <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
        Compromissos futuros
      </h2>

      {isEmpty ? (
        <p className="mt-4 text-foreground-muted">
          Nenhum compromisso futuro nos próximos 3 meses.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {months.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-3">
              {months.map((month) => (
                <div
                  key={month.monthKey}
                  className="rounded-xl bg-surface-strong px-4 py-3"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                    {monthLabel(month.monthKey)}
                  </dt>
                  <dd className="text-xl font-bold tabular-nums text-foreground">
                    {formatCents(month.totalCents)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {bills.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                Vencimentos do ciclo
              </h3>
              <ul className="mt-2 divide-y divide-border">
                {bills.map((bill) => (
                  <li
                    key={`${bill.name}-${bill.dueDate}`}
                    className="flex justify-between gap-4 py-1 text-sm text-foreground"
                  >
                    <span>{billLineLabel(bill)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {endingSoon.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                Perto de terminar
              </h3>
              <ul className="mt-2 space-y-1">
                {endingSoon.map((warning) => (
                  <li
                    key={`${warning.name}-${warning.endMonth}`}
                    className="text-sm text-foreground-muted"
                  >
                    {endingSoonLabel(warning)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm font-medium">
        <Link
          href="/cartoes"
          className="text-emerald-700 transition hover:text-emerald-800"
        >
          Ver cartões
        </Link>
        <Link
          href="/saidas"
          className="text-emerald-700 transition hover:text-emerald-800"
        >
          Ver saídas fixas
        </Link>
      </footer>
    </section>
  );
}
