export default function FutureMonthNotice() {
  return (
    <section className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center">
      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest text-subtle">
          FinFam
        </p>
        <h1 className="text-3xl font-bold text-foreground">Mês futuro</h1>
      </header>

      <p className="text-lg text-foreground-muted">
        Este mês ainda não começou. Os dados aparecem quando ele chegar.
      </p>
    </section>
  );
}
