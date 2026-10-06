import type { Metadata } from "next";
import Link from "next/link";
import MonthSelector from "@/components/MonthSelector";
import RetryButton from "@/components/RetryButton";
import { loadDashboardData } from "@/lib/dashboard";
import {
  computeFinanceStatus,
  dashboardView,
  monthKey,
  type DashboardView,
} from "@/lib/finance";
import { invoiceDueLabel, resolveReferenceDate } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Histórico — FinFam" };

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const params = await searchParams;
  const mes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const referenceDate = resolveReferenceDate(mes);
  const referenceMonthKey = monthKey(referenceDate);
  const isCurrentMonth = referenceMonthKey >= monthKey(new Date());

  let view: DashboardView = { state: "error" };
  let backgroundColor = "hsl(0 0% 45%)";
  let daysRemaining = 0;

  try {
    const data = await loadDashboardData(referenceDate);
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <MonthSelector
        monthKey={referenceMonthKey}
        isCurrentMonth={isCurrentMonth}
      />

      {view.state === "error" && (
        <section
          role="alert"
          className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
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
      )}

      {view.state === "empty" && (
        <section className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
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
      )}

      {view.state === "ok" && (
        <section
          className="flex min-h-[50vh] flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center text-white transition-colors duration-700"
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

          <p className="text-sm font-medium uppercase tracking-wide opacity-80">
            {invoiceDueLabel(referenceDate)}
          </p>

          <p className="text-2xl font-medium opacity-95">
            {daysRemaining} dias para o fim do mês
          </p>

          <p className="max-w-xl rounded-full bg-black/20 px-6 py-3 text-lg">
            {view.feedback}
          </p>
        </section>
      )}
    </div>
  );
}
