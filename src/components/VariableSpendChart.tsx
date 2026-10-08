import { CONSUMPTION_UNAVAILABLE_LABEL } from "@/lib/dashboard-series";
import { formatCents } from "@/lib/money";

interface VariableSpendChartProps {
  /** Gasto variável (avulsos no orçamento) por dia do mês, em centavos. */
  variableDailyExpensesCents: number[];
  /** Média diária de consumo disponível (entradas − fixas), em centavos. */
  averageCents: number;
  /** Obrigações do mês (fixas + faturas), fora do eixo das barras. */
  obligationsCents: number;
  /** Dia "até agora" (1-based); dias posteriores ficam atenuados. */
  elapsedDay: number;
  /** Dia de hoje a destacar (1-based), apenas no mês corrente. */
  highlightDay?: number;
}

const WIDTH = 100;
const HEIGHT = 40;
const PADDING_TOP = 4;
const CHART_HEIGHT = HEIGHT - PADDING_TOP;

/** Estado vazio: nenhum gasto variável no mês. */
export function variableSpendEmptyLabel(): string {
  return "Ainda sem gastos variáveis neste mês";
}

/** Estado indisponível: as contas fixas consomem toda a renda do mês. */
export function variableSpendUnavailableLabel(): string {
  return CONSUMPTION_UNAVAILABLE_LABEL;
}

/**
 * `aria-label` do gráfico. Sem gasto variável informa a ausência (sem citar um
 * pico inexistente); caso contrário cita o pico (dia e valor) e, quando
 * disponível, a média de consumo.
 */
export function variableSpendChartAriaLabel(
  variableDailyExpensesCents: number[],
  averageCents: number,
  highlightDay?: number,
): string {
  const total = variableDailyExpensesCents.reduce((sum, value) => sum + value, 0);
  const parts = [
    `Gasto variável por dia, ${variableDailyExpensesCents.length} dias`,
  ];

  if (total === 0) {
    parts.push("sem gastos variáveis neste mês");
  } else {
    let peakDay = 1;
    let peakValue = variableDailyExpensesCents[0] ?? 0;
    variableDailyExpensesCents.forEach((value, index) => {
      if (value > peakValue) {
        peakValue = value;
        peakDay = index + 1;
      }
    });
    parts.push(`pico de ${formatCents(peakValue)} no dia ${peakDay}`);
    if (averageCents > 0) {
      parts.push(`média de consumo ${formatCents(averageCents)}`);
    }
  }

  if (highlightDay) parts.push(`hoje é o dia ${highlightDay}`);
  return parts.join("; ");
}

/**
 * Gráfico "Gasto variável por dia" em SVG puro: uma barra por dia (apenas
 * avulsos no orçamento) e uma linha horizontal da média de consumo. As
 * obrigações (fixas + faturas) ficam em nota separada, fora do eixo das barras.
 *
 * Sem bibliotecas e sem divisão por zero: a escala inclui a média para mantê-la
 * dentro do viewBox e o valor é sempre finito.
 */
export default function VariableSpendChart({
  variableDailyExpensesCents,
  averageCents,
  obligationsCents,
  elapsedDay,
  highlightDay,
}: VariableSpendChartProps) {
  const days = variableDailyExpensesCents.length;
  const totalVariable = variableDailyExpensesCents.reduce(
    (sum, value) => sum + value,
    0,
  );
  const maxDaily = variableDailyExpensesCents.reduce(
    (max, value) => Math.max(max, value),
    0,
  );
  const scale = Math.max(maxDaily, averageCents, 1);
  const slot = days > 0 ? WIDTH / days : 0;
  const averageY = PADDING_TOP + (1 - averageCents / scale) * CHART_HEIGHT;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-foreground-muted">
        Gasto variável por dia
      </figcaption>

      <svg
        role="img"
        aria-label={variableSpendChartAriaLabel(
          variableDailyExpensesCents,
          averageCents,
          highlightDay,
        )}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
      >
        {variableDailyExpensesCents.map((value, index) => {
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

        {averageCents > 0 && (
          <line
            x1={0}
            y1={averageY}
            x2={WIDTH}
            y2={averageY}
            stroke="#60a5fa"
            strokeWidth={0.6}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {totalVariable === 0 && (
        <p className="text-sm text-subtle">{variableSpendEmptyLabel()}</p>
      )}

      {averageCents > 0 ? (
        <p className="text-sm text-subtle">
          Média de consumo: {formatCents(averageCents)}
        </p>
      ) : (
        <p className="text-sm text-subtle">{variableSpendUnavailableLabel()}</p>
      )}

      <p className="text-sm text-subtle">
        Obrigações: {formatCents(obligationsCents)}
      </p>
    </figure>
  );
}
