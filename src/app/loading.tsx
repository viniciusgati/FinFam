export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-700 p-8 text-center">
      <div className="space-y-2">
        <div className="mx-auto h-3 w-16 animate-pulse rounded-full bg-white/20" />
        <div className="mx-auto h-5 w-48 animate-pulse rounded-full bg-white/20" />
      </div>

      <div className="h-24 w-40 animate-pulse rounded-2xl bg-white/20 sm:h-32 sm:w-56" />

      <div className="mx-auto h-3 w-56 animate-pulse rounded-full bg-white/20" />

      <div className="mx-auto h-10 w-72 animate-pulse rounded-full bg-white/20" />

      <div className="h-9 w-32 animate-pulse rounded-full bg-white/20" />
    </main>
  );
}
