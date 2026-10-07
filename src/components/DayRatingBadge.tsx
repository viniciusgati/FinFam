import { levelLabel, type FinanceLevel } from "@/lib/finance";

interface DayRatingBadgeProps {
  level: FinanceLevel;
  /** Rótulo opcional; por padrão deriva de `levelLabel(level)`. */
  label?: string;
  /** Contexto extra lido por leitores de tela (ex.: "Avaliação do dia"). */
  ariaLabel?: string;
}

const LEVEL_CLASSES: Record<FinanceLevel, string> = {
  neutral: "border-border-strong bg-surface-strong text-foreground",
  green: "border-emerald-700 bg-emerald-950 text-emerald-200",
  lime: "border-lime-700 bg-lime-950 text-lime-200",
  yellow: "border-amber-700 bg-amber-950 text-amber-200",
  orange: "border-orange-700 bg-orange-950 text-orange-200",
  red: "border-red-700 bg-red-950 text-red-200",
};

/**
 * Rótulo textual + cor da avaliação do dia.
 *
 * O texto (não só a cor) é sempre visível, e o `aria-label` permite associar o
 * badge ao seu contexto — acessível para daltonismo/baixa visão.
 */
export default function DayRatingBadge({
  level,
  label,
  ariaLabel,
}: DayRatingBadgeProps) {
  const text = label ?? levelLabel(level);

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `Avaliação do dia: ${text}`}
      className={`inline-flex items-center rounded-full border px-4 py-1.5 text-base font-semibold ${LEVEL_CLASSES[level]}`}
    >
      {text}
    </span>
  );
}
