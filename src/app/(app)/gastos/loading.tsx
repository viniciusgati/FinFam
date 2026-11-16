/**
 * Skeleton de `/gastos`: placeholders do seletor de mês e da lista de gastos
 * avulsos, coerentes com o conteúdo real da tela. Nenhum valor provisório é
 * renderizado durante o carregamento.
 */
export default function Loading() {
  return (
    <section
      aria-busy="true"
      role="status"
      aria-live="polite"
      className="mx-auto max-w-3xl space-y-6"
    >
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Gastos avulsos</h1>
        <p className="text-sm font-medium text-foreground-muted">Carregando…</p>
      </header>

      <div className="h-12 animate-pulse rounded-xl bg-surface-strong" />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground-muted">
          Mês
          <select
            disabled
            aria-label="Selecionar mês"
            className="w-40 rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-foreground disabled:opacity-60"
          />
        </label>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-strong" />
      </div>

      <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface-strong" />

      <div className="space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="h-16 animate-pulse rounded-xl border border-border bg-surface-strong"
          />
        ))}
      </div>
    </section>
  );
}
