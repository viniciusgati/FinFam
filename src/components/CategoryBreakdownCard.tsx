import Link from "next/link";
import {
  categoryBreakdownView,
  type CategoryBreakdown,
} from "@/lib/category-breakdown";

export interface CategoryBreakdownCardProps {
  breakdown: CategoryBreakdown;
  className?: string;
}

/** Paleta fixa, ciclada pelo índice da fatia. */
const SLICE_PALETTE = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
];

function sliceColor(index: number): string {
  return SLICE_PALETTE[index % SLICE_PALETTE.length];
}

/**
 * Seção "Gastos por categoria": barra horizontal 100% empilhada (segmentos
 * proporcionais em CSS) e a tabela Categoria/Valor/% como alternativa textual,
 * da maior para a menor, mais a linha de total. Os textos vêm da função pura
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
        <div className="mt-4 space-y-4">
          <div
            role="img"
            aria-label={view.ariaLabel}
            className="flex h-6 w-full overflow-hidden rounded-full bg-surface-strong"
          >
            {view.slices.map((slice, index) => (
              <div
                key={slice.category}
                className={`h-full ${sliceColor(index)}`}
                style={{ width: `${slice.percent}%` }}
              />
            ))}
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-subtle">
                <th scope="col" className="py-1 pr-2 font-medium">
                  Categoria
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Valor
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {view.slices.map((slice, index) => (
                <tr key={slice.category} className="text-foreground">
                  <th
                    scope="row"
                    className="flex items-center gap-2 py-1 pr-2 text-left font-normal"
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-3 w-3 rounded-full ${sliceColor(index)}`}
                    />
                    {slice.category}
                  </th>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {slice.amountLabel}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {slice.percent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="border-t border-border pt-3 text-lg font-semibold text-foreground">
            {view.totalLabel}
          </p>
        </div>
      )}
    </section>
  );
}
