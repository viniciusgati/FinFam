import Link from "next/link";
import { loadDashboardData } from "@/lib/dashboard";
import {
  computeFinanceStatus,
  dashboardView,
  type DashboardView,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let view: DashboardView = { state: "error" };
  let backgroundColor = "hsl(0 0% 45%)";
  let daysRemaining = 0;

  try {
    const data = await loadDashboardData();
    const status = computeFinanceStatus(data);
    backgroundColor = status.color;
    daysRemaining = status.daysRemaining;
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
        className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
      >
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
            FinFam
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            Não foi possível carregar seus dados
          </h1>
        </header>

        <p className="text-lg text-slate-600">
          Tente novamente em instantes. Se o problema continuar, saia e entre de
          novo.
        </p>
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
          Cadastre sua renda para ver quanto do mês já foi consumido.
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
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center text-white transition-colors duration-700"
      style={{ backgroundColor }}
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

      <p className="text-2xl font-medium opacity-95">
        {daysRemaining} dias para o fim do mês
      </p>

      <p className="max-w-xl rounded-full bg-black/20 px-6 py-3 text-lg">
        {view.feedback}
      </p>
    </section>
  );
}
