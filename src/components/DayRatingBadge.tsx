import { levelLabel, type FinanceLevel } from "@/lib/finance";

interface DayRatingBadgeProps {
  level: FinanceLevel;
  /** Rótulo opcional; por padrão deriva de `levelLabel(level)`. */
  label?: string;
  /** Contexto extra lido por leitores de tela (ex.: "Avaliação do dia"). */
  ariaLabel?: string;
}

const LEVEL_CLASSES: Record<FinanceLevel, string> = {
  neutral: "border-slate-300 bg-slate-100 text-slate-700",
  green: "border-emerald-300 bg-emerald-100 text-emerald-800",
  lime: "border-lime-300 bg-lime-100 text-lime-800",
  yellow: "border-amber-300 bg-amber-100 text-amber-800",
  orange: "border-orange-300 bg-orange-100 text-orange-800",
  red: "border-red-300 bg-red-100 text-red-800",
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
