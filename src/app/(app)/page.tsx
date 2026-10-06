import Link from "next/link";
import { loadDashboardData } from "@/lib/dashboard";
import {
  computeFinanceStatus,
  dashboardView,
  levelLabel,
  textColorForBackground,
  type DashboardView,
  type FinanceLevel,
} from "@/lib/finance";
import { invoiceDueLabel, resolveReferenceDate } from "@/lib/invoices";
import RetryButton from "@/components/RetryButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const params = await searchParams;
  const mes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const referenceDate = resolveReferenceDate(mes);

  let view: DashboardView = { state: "error" };
  let backgroundColor = "hsl(0 0% 45%)";
  let daysRemaining = 0;
  let level: FinanceLevel = "neutral";

  try {
    const data = await loadDashboardData(referenceDate);
    const status = computeFinanceStatus(data);
    backgroundColor = status.color;
    daysRemaining = status.daysRemaining;
    level = status.level;
    view = dashboardView({
      dbError: false,
      incomeCents: status.incomeCents,
      consumedPercent: status.consumedPercent,
      projectedPercent: status.projectedPercent,
      previousPercents: data.previousPercents,
    });
  } catch {
    view = dashboardView({
      dbError: true,
      incomeCents: 0,
      consumedPercent: 0,
      projectedPercent: 0,
      previousPercents: [],
    });
  }

  if (view.state === "error") {
    return (
      <section
        role="alert"
        aria-live="assertive"
        className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
      >
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
            FinFam
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            Não foi possível carregar seus dados. Tente novamente.
          </h1>
        </header>

        <RetryButton />
      </section>
    );
  }

  if (view.state === "empty") {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
            FinFam
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Sem dados ainda</h1>
        </header>

        <p className="text-lg text-slate-600">
          Cadastre suas entradas fixas para ver o percentual de renda consumida.
        </p>

        <Link
          href="/entradas"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          Cadastrar entradas
        </Link>
      </section>
    );
  }

  return (
    <section
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center transition-colors duration-700"
      style={{ backgroundColor, color: textColorForBackground(backgroundColor) }}
    >
      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest opacity-80">
          FinFam
        </p>
        <h1 className="text-xl font-semibold opacity-90">
          Renda do mês consumida
        </h1>
      </header>

      <p className="text-7xl font-black tabular-nums sm:text-9xl">
        {view.percent}
        <span className="text-4xl align-top sm:text-6xl">%</span>
      </p>

      <p className="text-2xl font-semibold">{levelLabel(level)}</p>

      <p className="text-sm font-medium uppercase tracking-wide opacity-80">
        {invoiceDueLabel(referenceDate)}
      </p>

      <p className="text-2xl font-medium opacity-95">
        {daysRemaining} dias para o fim do mês
      </p>

      <p
        role="status"
        aria-live="polite"
        className="max-w-xl rounded-full px-6 py-3 text-lg"
      >
        {view.feedback}
      </p>
    </section>
  );
}
