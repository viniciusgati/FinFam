import {
  FAMILY_EMPTY_TEXT,
  type FamilyInsight,
  type FamilyInsightTone,
} from "@/lib/family-insights";

const TONE_CLASSES: Record<FamilyInsightTone, string> = {
  warning: "border-amber-700 bg-amber-950 text-amber-100",
  positive: "border-emerald-700 bg-emerald-950 text-emerald-100",
  neutral: "border-border bg-surface-raised text-foreground-muted",
};

const MARKER_CLASSES: Record<FamilyInsightTone, string> = {
  warning: "text-amber-300",
  positive: "text-emerald-300",
  neutral: "text-foreground-muted",
};

/**
 * Lista de insights do card "Ajuda à família". Componente puro de apresentação:
 * recebe os insights já montados e, com lista vazia, exibe o vazio fixado
 * ({@link FAMILY_EMPTY_TEXT}).
 */
export default function FamilyInsightList({
  insights,
}: {
  insights: FamilyInsight[];
}) {
  const list: FamilyInsight[] =
    insights.length > 0
      ? insights
      : [
          {
            id: "empty",
            tone: "neutral",
            marker: null,
            text: FAMILY_EMPTY_TEXT,
          },
        ];

  return (
    <ul className="space-y-2">
      {list.map((insight) => (
        <li
          key={insight.id}
          className={`rounded-xl border px-4 py-3 ${TONE_CLASSES[insight.tone]}`}
        >
          {insight.marker && (
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${MARKER_CLASSES[insight.tone]}`}
            >
              {insight.marker}
            </p>
          )}
          <p className="text-sm">{insight.text}</p>
        </li>
      ))}
    </ul>
  );
}
