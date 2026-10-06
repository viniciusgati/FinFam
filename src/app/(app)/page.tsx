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

      {view.state === "ok" && (
        <>
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
        </>
      )}

      {view.state === "empty" && (
        <p className="max-w-xl rounded-full bg-black/20 px-6 py-3 text-lg">
          Ainda não há renda cadastrada. Cadastre suas entradas para acompanhar
          quanto do mês já foi consumido.
        </p>
      )}

      {view.state === "error" && (
        <p
          role="alert"
          className="max-w-xl rounded-full bg-black/20 px-6 py-3 text-lg"
        >
          Não foi possível carregar seus dados. Verifique DATABASE_URL e rode as
          migrations.
        </p>
      )}
    </section>
  );
}
