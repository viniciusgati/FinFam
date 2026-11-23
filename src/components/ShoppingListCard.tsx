import Link from "next/link";
import { formatCents } from "@/lib/money";
import {
  ageLabel,
  daysOnList,
  isStaleDesirable,
  previewShoppingItems,
  type ShoppingItem,
  type ShoppingPlan,
} from "@/lib/shopping-list";

export interface ShoppingListCardProps {
  /** Plano agregado calculado na página (puro, sem consultas extras). */
  plan: ShoppingPlan;
  /** Itens ativos já ordenados; o card recorta em `DASHBOARD_ITEM_LIMIT`. */
  items: readonly ShoppingItem[];
  /** "Hoje" no fuso da família (`YYYY-MM-DD`), injetado pela página. */
  referenceDate: string;
  href?: string;
  className?: string;
}

function staleDesirableLabel(count: number): string {
  return count === 1 ? "1 desejável adiado" : `${count} desejáveis adiados`;
}

/**
 * Bloco "Lista de compras" da zona Resumo do ciclo (história #376).
 *
 * O planejamento (totais, dias de diária e aviso de itens sem preço) vem pronto
 * de `buildShoppingPlan`; aqui só há apresentação dos itens e dos rótulos de
 * tempo (`ageLabel`/`isStaleDesirable`). O card só é montado pela página quando
 * existe ao menos um item ativo — não há estado vazio.
 */
export default function ShoppingListCard({
  plan,
  items,
  referenceDate,
  href = "/compras",
  className = "",
}: ShoppingListCardProps) {
  const { items: preview, hiddenCount } = previewShoppingItems(items);
  const staleDesirableCount = items.filter((item) =>
    isStaleDesirable(item, referenceDate),
  ).length;

  return (
    <section
      aria-label="Lista de compras"
      className={`flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm ${className}`.trim()}
    >
      <header className="space-y-1">
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          Lista de compras
        </h2>
        <p className="text-lg font-semibold text-foreground">{plan.summary}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-raised px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Essenciais
          </dt>
          <dd className="text-base font-bold tabular-nums text-foreground">
            {formatCents(plan.essentialCents)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-raised px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Desejáveis
          </dt>
          <dd className="text-base font-bold tabular-nums text-foreground">
            {formatCents(plan.desirableCents)}
          </dd>
        </div>
      </dl>

      {plan.unpricedLabel !== null && (
        <p role="status" aria-live="polite" className="text-sm text-foreground-muted">
          {plan.unpricedLabel}
        </p>
      )}

      {staleDesirableCount > 0 && (
        <p className="text-sm font-medium text-amber-300">
          {staleDesirableLabel(staleDesirableCount)}
        </p>
      )}

      <ul className="divide-y divide-border">
        {preview.map((item) => {
          const stale = isStaleDesirable(item, referenceDate);
          const age = ageLabel(daysOnList(item.addedOn, referenceDate), stale);
          const unit = item.estimatedUnitPriceCents;
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2"
            >
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="text-sm text-foreground-muted">
                {unit !== null ? `${formatCents(unit)} por unidade · ` : ""}
                {age}
              </span>
            </li>
          );
        })}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {hiddenCount > 0 ? (
          <span className="text-foreground-muted">
            +{hiddenCount} {hiddenCount === 1 ? "item" : "itens"}
          </span>
        ) : (
          <span />
        )}
        <Link
          href={href}
          className="font-semibold text-emerald-700 transition hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          Ver todos
        </Link>
      </footer>
    </section>
  );
}
