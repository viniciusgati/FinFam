export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-100 p-8 text-center">
      <div
        role="status"
        aria-live="polite"
        className="flex w-full max-w-md flex-col items-center gap-4"
      >
        <span className="text-lg font-medium text-slate-600">
          Carregando…
        </span>
        <div
          aria-hidden="true"
          className="h-24 w-48 animate-pulse rounded-2xl bg-slate-200"
        />
        <div
          aria-hidden="true"
          className="h-7 w-64 animate-pulse rounded-full bg-slate-200"
        />
        <div
          aria-hidden="true"
          className="h-11 w-44 animate-pulse rounded-full bg-slate-200"
        />
      </div>
    </main>
  );
}
