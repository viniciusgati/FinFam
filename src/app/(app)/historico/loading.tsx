import { HISTORY_LOADING_MESSAGE } from "@/lib/history";

const buttonClass =
  "rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium text-foreground-muted disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Skeleton de `/historico`: exibido na abertura e na troca de mês. Os controles
 * do seletor aparecem desabilitados e nenhum "0" provisório é renderizado.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      aria-busy="true"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" disabled className={buttonClass}>
          <span aria-hidden="true">←</span> Mês anterior
        </button>

        <span className="min-w-[10rem] text-center text-lg font-semibold text-foreground">
          {HISTORY_LOADING_MESSAGE}
        </span>

        <input
          type="month"
          disabled
          aria-label="Selecionar mês"
          className={`${buttonClass} disabled:opacity-40`}
        />

        <button type="button" disabled className={buttonClass}>
          Próximo mês <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="h-20 animate-pulse rounded-2xl bg-surface-strong" />
      <div className="h-48 animate-pulse rounded-2xl bg-surface-strong" />
      <div className="h-40 animate-pulse rounded-2xl bg-surface-strong" />
      <div className="h-40 animate-pulse rounded-2xl bg-surface-strong" />
    </div>
  );
}
