import Link from "next/link";
import {
  categoryBreakdownView,
  type CategoryBreakdown,
} from "@/lib/category-breakdown";

export interface CategoryBreakdownCardProps {
  breakdown: CategoryBreakdown;
  className?: string;
}

/**
 * Seção "Gastos por categoria": lista cada fatia como `Rótulo — R$ valor`, da
 * maior para a menor, e a linha de total. Todo o texto vem da função pura
 * `categoryBreakdownView` (testável sem DOM); aqui só há apresentação.
 */
export default function CategoryBreakdownCard({
  breakdown,
  className = "",
}: CategoryBreakdownCardProps) {
  const view = categoryBreakdownView(breakdown);

  return (
    <section
      aria-label={view.title}
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm ${className}`.trim()}
    >
      <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
        {view.title}
      </h2>

      {view.isEmpty ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-foreground-muted">{view.emptyMessage}</p>
          <Link
            href={view.emptyCtaHref}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {view.emptyCtaLabel}
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <ul className="space-y-2">
            {view.itemLabels.map((label) => (
              <li
                key={label}
                className="flex items-center justify-between gap-4 text-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
          <p className="border-t border-border pt-3 text-lg font-semibold text-foreground">
            {view.totalLabel}
          </p>
        </div>
      )}
    </section>
  );
}
