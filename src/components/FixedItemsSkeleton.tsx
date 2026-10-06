export default function FixedItemsSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 p-4">
        <p className="text-sm text-slate-400">Carregando {title.toLowerCase()}…</p>
      </div>
    </div>
  );
}
