export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-8 text-foreground">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-xs flex-col items-center gap-4"
      >
        <span className="text-lg font-medium">Carregando…</span>
        <div className="h-5 w-24 animate-pulse rounded bg-surface-strong" />
        <div className="h-7 w-48 animate-pulse rounded bg-surface-strong" />
        <div className="h-24 w-40 animate-pulse rounded bg-surface-strong sm:h-32" />
        <div className="h-8 w-56 animate-pulse rounded bg-surface-strong" />
        <div className="h-12 w-72 animate-pulse rounded-full bg-surface-strong" />
      </div>
    </main>
  );
}
