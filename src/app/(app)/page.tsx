import { loadDashboardData } from "@/lib/dashboard";
import {
  compareWithHistory,
  computeFinanceStatus,
  type FinanceStatus,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

function emptyStatus(): FinanceStatus {
  return computeFinanceStatus({
    monthlyIncomeCents: 0,
    fixedExpensesCents: 0,
    variableExpensesCents: 0,
    cardExpensesCents: 0,
  });
}

export default async function DashboardPage() {
  let status = emptyStatus();
  let feedback = "Ainda não há histórico suficiente.";
  let dbError = false;

  try {
    const data = await loadDashboardData();
    status = computeFinanceStatus(data);
    feedback = compareWithHistory(status.consumedPercent, data.previousPercents);
  } catch {
    dbError = true;
  }

  return (
    <section
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center text-white transition-colors duration-700"
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

      <p className="text-7xl font-black tabular-nums sm:text-9xl">
        {Math.round(status.consumedPercent)}
        <span className="text-4xl align-top sm:text-6xl">%</span>
      </p>

      <p className="text-2xl font-medium opacity-95">
        {status.daysRemaining} dias para o fim do mês
      </p>

      <p className="max-w-xl rounded-full bg-black/20 px-6 py-3 text-lg">
        {feedback}
      </p>

      {dbError && (
        <p className="max-w-xl text-sm opacity-80">
          Banco de dados não configurado. Defina <code>DATABASE_URL</code> e rode
          as migrations para ver os dados reais.
        </p>
      )}
    </section>
  );
}
