import {
  buildConsumptionChartView,
  type ConsumptionChartInput,
} from "@/lib/dashboard-charts";

const WIDTH = 100;
const HEIGHT = 40;
const PADDING_TOP = 4;
const CHART_HEIGHT = HEIGHT - PADDING_TOP;
const MARKER_HEIGHT = 1.6;

/**
 * Gráfico "Consumo por dia": barras do consumo **variável** (avulsos + compras
 * do mês no cartão, pela data da compra), linha tracejada do **dia típico**
 * (moda; mediana como fallback) e marcadores de vencimento (fixas/fatura) abaixo
 * das barras, fora da escala.
 *
 * Todo o texto/número vem de `buildConsumptionChartView` (testável sem DOM).
 */
export default function DailyConsumptionChart(props: ConsumptionChartInput) {
  const view = buildConsumptionChartView(props);
  const slot = view.days.length > 0 ? WIDTH / view.days.length : 0;
  const typicalY =
    PADDING_TOP + (1 - view.typicalPercent / 100) * CHART_HEIGHT;

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
          <svg
            role="img"
            aria-label={view.ariaLabel}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="mt-4 h-40 w-full overflow-visible"
          >
            {view.days.map((day) => {
              const future = props.elapsedDay > 0 && day.day > props.elapsedDay;
              const barHeight =
                view.maxVariableCents > 0
                  ? (day.variableCents / view.maxVariableCents) * CHART_HEIGHT
                  : 0;
              const x = slot * (day.day - 1) + slot * 0.15;
              const barWidth = slot * 0.7;
              const highlight = props.highlightDay === day.day;
              return (
                <g key={day.day}>
                  <rect
                    x={x}
                    y={PADDING_TOP + CHART_HEIGHT - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={0.6}
                    fill={highlight ? "#059669" : "#34d399"}
                    opacity={future ? 0.35 : 1}
                  />
                  {day.obligationCents > 0 && (
                    <rect
                      x={x}
                      y={HEIGHT - MARKER_HEIGHT}
                      width={barWidth}
                      height={MARKER_HEIGHT}
                      rx={0.3}
                      fill="#f59e0b"
                    />
                  )}
                </g>
              );
            })}

            {view.typical !== null && view.maxVariableCents > 0 && (
              <line
                x1={0}
                x2={WIDTH}
                y1={typicalY}
                y2={typicalY}
                stroke="#60a5fa"
                strokeWidth={0.8}
                strokeDasharray="2 1.5"
              />
            )}
          </svg>

          <div className="mt-2 space-y-1 text-sm text-subtle">
            <p>{view.summaryLabel}</p>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm bg-emerald-400"
                />
                Consumo do dia
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm bg-amber-500"
                />
                Vencimento (fixas/fatura)
              </li>
              {view.typical !== null && (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-4 border-t-2 border-dashed border-sky-400"
                  />
                  Dia típico ({view.typical.label})
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
