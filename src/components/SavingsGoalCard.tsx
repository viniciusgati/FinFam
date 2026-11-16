import type { SavingsGoalProgress } from "@/lib/savings-goal";
import { formatCents } from "@/lib/money";

export interface SavingsGoalCardProps {
  progress: SavingsGoalProgress;
  className?: string;
}

/**
 * Card "Meta de economia": progresso do guardado estimado do ciclo contra a
 * meta configurada. Os números vêm da função pura `savingsGoalProgress`
 * (testada sem DOM); aqui só há a apresentação.
 */
export default function SavingsGoalCard({
  progress,
  className = "",
}: SavingsGoalCardProps) {
  return (
    <section
      aria-label="Meta de economia"
      className={`rounded-2xl border border-border bg-surface p-6 shadow-sm ${className}`.trim()}
    >
      <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
        Meta de economia
      </h2>

      {progress.achieved ? (
        <p className="mt-2 text-lg font-semibold text-emerald-300">
          Meta atingida!
        </p>
      ) : (
        <p className="mt-2 text-sm text-foreground-muted">
          {progress.percent}% da meta guardado no ciclo
        </p>
      )}

      <div
        role="progressbar"
        aria-label="Progresso da meta de economia"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-strong"
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-strong px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Meta
          </dt>
          <dd className="text-xl font-bold tabular-nums text-foreground">
            {formatCents(progress.goalCents)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-strong px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Guardado estimado
          </dt>
          <dd className="text-xl font-bold tabular-nums text-foreground">
            {formatCents(progress.savedCents)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-strong px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Restante
          </dt>
          <dd className="text-xl font-bold tabular-nums text-foreground">
            {formatCents(progress.remainingCents)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-strong px-4 py-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Por dia restante
          </dt>
          <dd className="text-xl font-bold tabular-nums text-foreground">
            {formatCents(progress.dailyRemainingCents)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
