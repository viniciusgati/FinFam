import { formatCents } from "@/lib/money";

interface DailySpendChartProps {
  /** Gasto por dia do mês (1 valor por dia), em centavos. */
  dailyExpensesCents: number[];
  /** Acumulado até `elapsedDay` (pode ser menor que o mês). */
  cumulativeExpensesCents: number[];
  /** Dia "até agora" (1-based); dias posteriores ficam atenuados. */
  elapsedDay: number;
  /** Dia de hoje a destacar (1-based), apenas no mês corrente. */
  highlightDay?: number;
}

const WIDTH = 100;
const HEIGHT = 40;
const PADDING_TOP = 4;
const CHART_HEIGHT = HEIGHT - PADDING_TOP;

function buildAriaLabel(
  dailyExpensesCents: number[],
  totalCents: number,
  highlightDay?: number,
): string {
  const parts = [
    `Gasto dia a dia do mês, ${dailyExpensesCents.length} dias`,
    `total de ${formatCents(totalCents)}`,
  ];
  if (highlightDay) parts.push(`hoje é o dia ${highlightDay}`);
  return parts.join("; ");
}

/**
 * Gráfico "Dia a dia" em SVG puro: uma barra por dia e uma linha do acumulado.
 *
 * Sem bibliotecas e sem divisão por zero: com todos os valores zerados as barras
 * ficam com altura 0 e o estado "Sem gastos neste mês" é exibido.
 */
export default function DailySpendChart({
  dailyExpensesCents,
  cumulativeExpensesCents,
  elapsedDay,
  highlightDay,
}: DailySpendChartProps) {
  const days = dailyExpensesCents.length;
  const totalCents = dailyExpensesCents.reduce((sum, value) => sum + value, 0);
  const maxDaily = dailyExpensesCents.reduce(
    (max, value) => Math.max(max, value),
    0,
  );
  const maxCumulative = cumulativeExpensesCents.reduce(
    (max, value) => Math.max(max, value),
    0,
  );
  const scale = Math.max(maxDaily, maxCumulative, 1);
  const slot = days > 0 ? WIDTH / days : 0;

  const linePoints = cumulativeExpensesCents
    .map((value, index) => {
      const x = slot * (index + 0.5);
      const y = PADDING_TOP + (1 - value / scale) * CHART_HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-foreground-muted">
        Dia a dia
      </figcaption>

      <svg
        role="img"
        aria-label={buildAriaLabel(dailyExpensesCents, totalCents, highlightDay)}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
      >
        {dailyExpensesCents.map((value, index) => {
          const day = index + 1;
          const future = elapsedDay > 0 && day > elapsedDay;
          const barHeight = maxDaily > 0 ? (value / scale) * CHART_HEIGHT : 0;
          const x = slot * index + slot * 0.15;
          const barWidth = slot * 0.7;
          return (
            <rect
              key={day}
              x={x}
              y={PADDING_TOP + CHART_HEIGHT - barHeight}
              width={barWidth}
              height={barHeight}
              rx={0.6}
              fill={highlightDay === day ? "#059669" : "#34d399"}
              opacity={future ? 0.35 : 1}
            />
          );
        })}

        {cumulativeExpensesCents.length > 1 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={0.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>

      {totalCents === 0 ? (
        <p className="text-sm text-subtle">Sem gastos neste mês</p>
      ) : (
        <p className="text-sm text-subtle">
          Total até agora: {formatCents(cumulativeExpensesCents.at(-1) ?? 0)}
        </p>
      )}
    </figure>
  );
}
