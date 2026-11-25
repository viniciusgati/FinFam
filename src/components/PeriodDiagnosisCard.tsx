import type {
  PeriodAnalysisTone,
  PeriodAnalysisView,
} from "@/lib/period-analysis-view";
import type { PeriodAnomalySeverity } from "@/lib/period-analysis";
import PeriodAiSummary from "@/components/PeriodAiSummary";

export interface PeriodDiagnosisCardProps {
  view: PeriodAnalysisView;
  /** Mês de início do ciclo, enviado à rota de narrativa por IA. */
  monthKey: string;
  className?: string;
}

const CONFIDENCE_CLASSES: Record<PeriodAnalysisTone, string> = {
  positive: "bg-emerald-950 text-emerald-200",
  warning: "bg-amber-950 text-amber-200",
  neutral: "bg-surface-strong text-foreground-muted",
};

const SEVERITY_CLASSES: Record<PeriodAnomalySeverity, string> = {
  critical: "border-red-800 bg-red-950 text-red-200",
  warning: "border-amber-800 bg-amber-950 text-amber-200",
  info: "border-border bg-surface-strong text-foreground-muted",
};

/**
 * Card "Diagnóstico do período": fluxo, ritmo, compromissos, maiores desvios,
 * pontos de atenção e cortes sugeridos. Todo o texto vem de
 * `periodAnalysisView` (testado sem DOM); aqui só há apresentação.
 */
export default function PeriodDiagnosisCard({
  view,
  monthKey,
  className = "",
}: PeriodDiagnosisCardProps) {
  const aiFallback = [
    view.summaryLabel,
    view.paceLabel,
    view.commitmentLabel,
    view.totalSavingsLabel,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");

  return (
    <section
      aria-label={view.title}
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm ${className}`.trim()}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          {view.title}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            CONFIDENCE_CLASSES[view.confidenceTone]
          }`}
        >
          {view.confidenceLabel}
        </span>
      </header>

      {view.isEmpty ? (
        <p className="mt-4 text-foreground-muted">{view.emptyMessage}</p>
      ) : (
        <>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {view.summaryLabel}
          </p>

          {view.paceLabel !== null && (
            <p className="mt-1 text-sm text-foreground-muted">
              {view.paceLabel}
            </p>
          )}

          {view.commitmentLabel !== null && (
            <p className="mt-1 text-sm text-foreground-muted">
              {view.commitmentLabel}
            </p>
          )}

          {view.categoryMovers.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                Maiores variações
              </h3>
              <ul className="mt-2 divide-y divide-border">
                {view.categoryMovers.map((mover) => (
                  <li
                    key={mover.category}
                    className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-1.5 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {mover.category}
                    </span>
                    <span className="text-foreground-muted">
                      {mover.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.anomalies.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                Pontos de atenção
              </h3>
              <ul className="mt-2 space-y-2">
                {view.anomalies.map((anomaly) => (
                  <li
                    key={anomaly.id}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      SEVERITY_CLASSES[anomaly.severity]
                    }`}
                  >
                    <p className="font-semibold">{anomaly.title}</p>
                    <p>{anomaly.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.levers.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                Onde dá para cortar
              </h3>
              <ul className="mt-2 space-y-2">
                {view.levers.map((lever) => (
                  <li
                    key={lever.id}
                    className="rounded-xl bg-surface-strong px-3 py-2 text-sm"
                  >
                    <p className="font-semibold text-foreground">
                      {lever.label}
                    </p>
                    <p className="text-foreground-muted">{lever.detail}</p>
                  </li>
                ))}
              </ul>
              {view.totalSavingsLabel !== null && (
                <p className="mt-2 text-sm font-semibold text-emerald-300">
                  {view.totalSavingsLabel}
                </p>
              )}
            </div>
          )}

          <PeriodAiSummary monthKey={monthKey} fallback={aiFallback} />

          {view.dataQualityLabel !== null && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-subtle">
              {view.dataQualityLabel}
            </p>
          )}
        </>
      )}
    </section>
  );
}
