export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 animate-pulse rounded bg-surface-strong" />
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface-raised p-4">
        <p className="text-sm text-subtle">Carregando…</p>
      </div>
      <div className="space-y-3">
        {[0, 1].map((row) => (
          <div
            key={row}
            className="h-16 animate-pulse rounded-xl border border-border bg-surface-raised"
          />
        ))}
      </div>
    </div>
  );
}
