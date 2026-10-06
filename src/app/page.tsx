import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
  const session = await getSession();
  if (!session) redirect("/login");

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

      {status.incomeCents <= 0 && !dbError && (
        <div className="flex max-w-xl flex-col items-center gap-3">
          <p className="text-base opacity-90">
            Cadastre suas entradas fixas para acompanhar a renda do mês.
          </p>
          <Link
            href="/entradas"
            className="rounded-full bg-black/20 px-5 py-2 text-sm font-medium transition hover:bg-black/30"
          >
            Cadastrar entrada
          </Link>
        </div>
      )}

      <nav className="flex flex-wrap justify-center gap-3 text-sm">
        <Link
          href="/entradas"
          className="rounded-full bg-black/20 px-5 py-2 font-medium transition hover:bg-black/30"
        >
          Entradas fixas
        </Link>
        <Link
          href="/saidas"
          className="rounded-full bg-black/20 px-5 py-2 font-medium transition hover:bg-black/30"
        >
          Saídas fixas
        </Link>
      </nav>

      {dbError && (
        <p className="max-w-xl text-sm opacity-80">
          Banco de dados não configurado. Defina <code>DATABASE_URL</code> e rode
          as migrations para ver os dados reais.
        </p>
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
