import Link from "next/link";
import {
  buildConsumptionChartView,
  narrowDayLabels,
  type ConsumptionChartInput,
} from "@/lib/dashboard-charts";

const WIDTH = 100;
const HEIGHT = 40;
const PADDING_TOP = 4;
const CHART_HEIGHT = HEIGHT - PADDING_TOP;
const MARKER_HEIGHT = 1.6;

/**
 * Gráfico "Consumo por dia": barras do consumo **variável** (avulsos + compras
 * do mês no cartão, pela data da compra) e marcadores de vencimento (fixas/
 * fatura) no rodapé, fora da escala. Abaixo do plot, eixo de dias: uma célula
 * por dia (mesma largura do slot da barra) com o número do dia — hoje em
 * destaque, vencimento em âmbar, futuro atenuado. Em card estreito (container
 * < `@lg`/512px) só os marcos vêm à mostra (`narrowDayLabels`), sem dois
 * números de duas casas colados. O **dia típico**
 * (moda; mediana como fallback) só aparece no resumo textual: a linha de
 * referência no plot cortava o gráfico no meio e confundia a leitura (feedback
 * do usuário).
 *
 * Todo o texto/número vem de `buildConsumptionChartView` (testável sem DOM).
 */
export default function DailyConsumptionChart(props: ConsumptionChartInput) {
  const view = buildConsumptionChartView(props);
  const slot = view.days.length > 0 ? WIDTH / view.days.length : 0;
  const narrowLabels = narrowDayLabels(view.days.length, props.highlightDay);

  return (
    <section
      aria-label={view.title}
      className="@container rounded-2xl border border-border bg-surface p-6 shadow-sm"
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
          </svg>

          {/* Eixo de dias: células com a mesma largura dos slots das barras,
              número centralizado. No card estreito (`< @lg`) só os marcos de
              `narrowDayLabels` aparecem, sem desalinhar as células. */}
          <div
            aria-hidden="true"
            className="mt-1.5 flex text-[10px] leading-none"
          >
            {view.days.map((day) => {
              const highlight = props.highlightDay === day.day;
              const future = props.elapsedDay > 0 && day.day > props.elapsedDay;
              const classes = [
                highlight
                  ? "font-semibold text-emerald-400"
                  : day.obligationCents > 0
                    ? "text-amber-400"
                    : "text-subtle",
              ];
              if (future) classes.push("opacity-50");
              if (!narrowLabels.includes(day.day)) {
                classes.push("hidden @lg:inline");
              }
              return (
                <span key={day.day} className="flex-1 text-center">
                  <span className={classes.join(" ")}>{day.day}</span>
                </span>
              );
            })}
          </div>

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
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
