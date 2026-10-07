import { formatCents } from "@/lib/money";

interface IncomeVsExpenseChartProps {
  /** Entradas do mês, em centavos. */
  entriesCents: number;
  /** Saídas (gasto consumido) do mês, em centavos. */
  expensesCents: number;
}

/**
 * Comparativo "Entradas vs Saídas" em CSS puro (barras proporcionais), com os
 * valores em R$ (`formatCents`, pt-BR/BRL).
 *
 * Com tudo zerado não há escala válida (evita divisão por zero) e o estado
 * "Sem gastos neste mês" é exibido.
 */
export default function IncomeVsExpenseChart({
  entriesCents,
  expensesCents,
}: IncomeVsExpenseChartProps) {
  const max = Math.max(entriesCents, expensesCents, 0);
  const empty = entriesCents <= 0 && expensesCents <= 0;

  const rows = [
    { key: "entradas", label: "Entradas", value: entriesCents, bar: "bg-emerald-500" },
    { key: "saidas", label: "Saídas", value: expensesCents, bar: "bg-rose-500" },
  ];

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-slate-700">
        Entradas vs Saídas
      </figcaption>

      {empty ? (
        <p className="text-sm text-slate-500">Sem gastos neste mês</p>
      ) : (
        <div
          role="img"
          aria-label={`Entradas de ${formatCents(entriesCents)} e saídas de ${formatCents(expensesCents)} no mês`}
          className="space-y-3"
        >
          {rows.map((row) => {
            const width = max > 0 ? (row.value / max) * 100 : 0;
            return (
              <div key={row.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>{row.label}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {formatCents(row.value)}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${row.bar}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </figure>
  );
}
