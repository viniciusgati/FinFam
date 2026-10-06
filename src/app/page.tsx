import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard";
import {
  compareWithHistory,
  computeFinanceStatus,
  resolveDashboardState,
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

function LogoutButton({ user }: { user: string }) {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="rounded-full bg-black/20 px-5 py-2 text-sm font-medium transition hover:bg-black/30"
      >
        Sair ({user})
      </button>
    </form>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let status = emptyStatus();
  let feedback = "Ainda não há histórico suficiente.";
  let monthlyIncomeCents = 0;
  let dbError = false;

  try {
    const data = await loadDashboardData();
    monthlyIncomeCents = data.monthlyIncomeCents;
    status = computeFinanceStatus(data);
    feedback = compareWithHistory(status.consumedPercent, data.previousPercents);
  } catch {
    dbError = true;
  }

  if (dbError) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center text-white transition-colors duration-700"
        style={{ backgroundColor: status.color }}
      >
        <div role="alert" className="max-w-xl space-y-3">
          <h1 className="text-3xl font-bold">
            Não foi possível carregar seus dados
          </h1>
          <p className="text-lg opacity-95">
            Tente novamente em instantes. Se o problema continuar, saia e entre
            de novo.
          </p>
        </div>

        <LogoutButton user={session.user} />
      </main>
    );
  }

  if (resolveDashboardState({ monthlyIncomeCents }) === "empty") {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center text-white transition-colors duration-700"
        style={{ backgroundColor: status.color }}
      >
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest opacity-80">
            FinFam
          </p>
          <h1 className="text-3xl font-bold opacity-95">Sem dados ainda</h1>
        </header>

        <p className="max-w-xl text-lg opacity-95">
          Cadastre sua renda para ver quanto do mês já foi consumido.
        </p>

        <Link
          href="/entradas"
          className="rounded-full bg-white/20 px-6 py-3 text-lg font-semibold transition hover:bg-white/30"
        >
          Cadastrar entradas
        </Link>

        <LogoutButton user={session.user} />
      </main>
    );
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

      <LogoutButton user={session.user} />
    </main>
  );
}
