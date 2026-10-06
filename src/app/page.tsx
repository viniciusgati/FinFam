import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard";
import {
  compareWithHistory,
  computeFinanceStatus,
  type FinanceStatus,
} from "@/lib/finance";
import { invoiceDueLabel, resolveReferenceDate } from "@/lib/invoices";
import RetryButton from "@/components/RetryButton";

export const dynamic = "force-dynamic";

function emptyStatus(referenceDate: Date): FinanceStatus {
  return computeFinanceStatus({
    monthlyIncomeCents: 0,
    fixedExpensesCents: 0,
    variableExpensesCents: 0,
    cardExpensesCents: 0,
    referenceDate,
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const mes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const referenceDate = resolveReferenceDate(mes);

  let data: DashboardData | null = null;
  try {
    data = await loadDashboardData(referenceDate);
  } catch {
    data = null;
  }

  const status = data ? computeFinanceStatus(data) : emptyStatus(referenceDate);
  const feedback = data
    ? compareWithHistory(status.consumedPercent, data.previousPercents)
    : "";

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center text-white transition-colors duration-700"
      style={{ backgroundColor: status.color }}
    >
      <header className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-widest opacity-80">
          FinFam
        </p>
        <h1 className="text-xl font-semibold opacity-90">
          Renda do mês consumida
        </h1>
      </header>

      {data === null ? (
        <section className="flex flex-col items-center gap-4">
          <p className="max-w-xl text-2xl font-medium opacity-95">
            Não foi possível carregar seus dados. Tente novamente.
          </p>
          <RetryButton />
        </section>
      ) : status.incomeCents <= 0 ? (
        <p className="max-w-xl rounded-full bg-black/20 px-6 py-3 text-lg">
          Cadastre suas entradas fixas para ver o percentual de renda consumida.
        </p>
      ) : (
        <>
          <p className="text-7xl font-black tabular-nums sm:text-9xl">
            {Math.round(status.consumedPercent)}
            <span className="text-4xl align-top sm:text-6xl">%</span>
          </p>

          <p className="text-sm font-medium uppercase tracking-wide opacity-80">
            {invoiceDueLabel(referenceDate)}
          </p>

          <p className="text-2xl font-medium opacity-95">
            {status.daysRemaining} dias para o fim do mês
          </p>

          <p className="max-w-xl rounded-full bg-black/20 px-6 py-3 text-lg">
            {feedback}
          </p>
        </>
      )}

      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="rounded-full bg-black/20 px-5 py-2 text-sm font-medium transition hover:bg-black/30"
        >
          Sair ({session.user})
        </button>
      </form>
    </main>
  );
}
