export default function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex w-full flex-col gap-6">
      <div
        role="status"
        aria-live="polite"
        className="text-sm font-medium text-foreground-muted"
      >
        Carregando…
      </div>
      <div className="h-8 w-48 animate-pulse rounded bg-surface-strong" />

      <section aria-busy="true" className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          Resumo do ciclo
        </h2>
        <div className="h-48 w-full animate-pulse rounded-2xl bg-surface-strong" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-surface-strong" />
      </section>

      <section aria-busy="true" className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          Ações
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-surface-strong" />
          <div className="h-24 animate-pulse rounded-2xl bg-surface-strong" />
        </div>
        <div className="h-32 w-full animate-pulse rounded-2xl bg-surface-strong" />
      </section>

      <section aria-busy="true" className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          Compromissos
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-surface-strong" />
          <div className="h-48 animate-pulse rounded-2xl bg-surface-strong" />
        </div>
        <section
          aria-busy="true"
          aria-live="polite"
          role="status"
          className="space-y-3 rounded-2xl border border-border bg-surface p-6"
        >
          <h3 className="text-sm font-medium uppercase tracking-widest text-subtle">
            Gastos por categoria
          </h3>
          <div className="h-6 w-1/2 animate-pulse rounded bg-surface-strong" />
          <div className="h-6 w-2/3 animate-pulse rounded bg-surface-strong" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-surface-strong" />
        </section>
      </section>

      <section aria-busy="true" className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-subtle">
          Explorar
        </h2>
        <div className="h-40 w-full animate-pulse rounded-2xl bg-surface-strong" />
        <div className="h-40 w-full animate-pulse rounded-2xl bg-surface-strong" />
      </section>
    </div>
  );
}
