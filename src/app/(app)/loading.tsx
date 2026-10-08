export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div
        role="status"
        aria-live="polite"
        className="text-sm font-medium text-foreground-muted"
      >
        Carregando…
      </div>
      <div className="h-8 w-48 animate-pulse rounded bg-surface-strong" />
      <div className="h-48 w-full animate-pulse rounded-2xl bg-surface-strong" />
      <div className="h-6 w-2/3 animate-pulse rounded bg-surface-strong" />
      <div className="h-6 w-1/2 animate-pulse rounded bg-surface-strong" />
      <section
        aria-busy="true"
        aria-live="polite"
        role="status"
        className="space-y-3 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          Gastos por categoria
        </h2>
        <div className="h-6 w-1/2 animate-pulse rounded bg-surface-strong" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-strong" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-strong" />
      </section>
    </div>
  );
}
