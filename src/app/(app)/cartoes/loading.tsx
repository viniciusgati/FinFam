export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 p-4">
        <p className="text-sm text-slate-400">Carregando…</p>
      </div>
      <div className="space-y-3">
        {[0, 1].map((row) => (
          <div
            key={row}
            className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}
