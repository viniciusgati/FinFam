import Link from "next/link";
import {
  openCycleSummaryText,
  type OpenExpensesSummary,
} from "@/lib/open-expenses";

export interface OpenExpensesCardProps {
  summary: OpenExpensesSummary;
  href?: string;
  className?: string;
}

/**
 * Bloco "A pagar" da zona Compromissos: total e quantidade de gastos em aberto
 * no ciclo corrente, com atalho para a lista já filtrada. Os textos vêm das
 * funções puras de `open-expenses.ts` (testadas sem DOM); aqui só há
 * apresentação.
 */
export default function OpenExpensesCard({
  summary,
  href = "/gastos?status=open",
  className = "",
}: OpenExpensesCardProps) {
  return (
    <section
      aria-label="A pagar"
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm ${className}`.trim()}
    >
      <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
        A pagar
      </h2>

      <p className="mt-2 text-lg font-semibold text-foreground">
        {openCycleSummaryText(summary)}
      </p>

      <Link
        href={href}
        className="mt-3 inline-block text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        Ver gastos em aberto
      </Link>
    </section>
  );
}
