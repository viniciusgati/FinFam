export default function Loading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-48 w-full animate-pulse rounded-2xl bg-slate-200" />
      <div className="h-6 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200" />
    </div>
  );
}
