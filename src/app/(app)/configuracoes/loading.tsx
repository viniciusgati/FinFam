/**
 * Skeleton de `/configuracoes`: placeholders do cabeçalho e do formulário do
 * ciclo financeiro, coerentes com o conteúdo real da tela. Nenhum valor
 * provisório é renderizado durante o carregamento.
 */
export default function Loading() {
  return (
    <section
      aria-busy="true"
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm font-medium text-foreground-muted">Carregando…</p>
      </header>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <label className="block space-y-1">
          <span className="block h-4 w-56 animate-pulse rounded bg-surface-strong" />
          <input
            type="number"
            disabled
            aria-label="Dia de início do ciclo financeiro"
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-foreground disabled:opacity-60 sm:max-w-[10rem]"
          />
        </label>
        <div className="h-3 w-64 animate-pulse rounded bg-surface-strong" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-surface-strong" />
      </div>
    </section>
  );
}
