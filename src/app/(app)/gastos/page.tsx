import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  currentMonthParam,
  isValidMonthParam,
  monthRange,
} from "@/lib/variable-expenses";
import GastosManager, { type ExpenseDTO } from "@/components/GastosManager";
import FutureMonthNotice from "@/components/FutureMonthNotice";
import { loadCategorySuggestions } from "@/lib/category-suggestions";
import { parseExpenseFilters } from "@/lib/expense-filters";
import { buildMonthOptions, isFutureMonth } from "@/lib/finance";
import RetryButton from "@/components/RetryButton";
import { todayISO } from "@/lib/quick-expense";

export const metadata: Metadata = { title: "Gastos — FinFam" };

export const dynamic = "force-dynamic";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string | string[];
    q?: string | string[];
    categoria?: string | string[];
    pagamento?: string | string[];
    status?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawMes = Array.isArray(params.mes) ? params.mes[0] : params.mes;
  const mes = isValidMonthParam(rawMes) ? rawMes : currentMonthParam();
  const currentMes = currentMonthParam();
  const initialFilters = parseExpenseFilters(params);

  if (isFutureMonth(mes, currentMes)) {
    return <FutureMonthNotice />;
  }

  const today = todayISO();
  const monthOptions = buildMonthOptions(currentMes, mes);

  let expenses: ExpenseDTO[] = [];
  let loadFailed = false;

  try {
    const { gte, lt } = monthRange(mes);
    const rows = await prisma.variableExpense.findMany({
      where: { date: { gte, lt } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    expenses = rows.map((row) => ({
      id: row.id,
      description: row.description,
      amountCents: row.amountCents,
      date: row.date.toISOString(),
      category: row.category,
      paymentMethod: row.paymentMethod,
      paid: row.paid,
      creditCardId: row.creditCardId,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch {
    loadFailed = true;
  }

  if (loadFailed) {
    return (
      <section
        role="alert"
        aria-live="assertive"
        className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 rounded-2xl p-8 text-center"
      >
        <header className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-widest text-subtle">
            Gastos
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Não foi possível carregar os gastos.
          </h1>
        </header>
        <RetryButton />
      </section>
    );
  }

  const categorySuggestions = await loadCategorySuggestions();

  return (
    <GastosManager
      key={mes}
      mes={mes}
      today={today}
      currentMes={currentMes}
      monthOptions={monthOptions}
      initialExpenses={expenses}
      initialFilters={initialFilters}
      categorySuggestions={categorySuggestions}
    />
  );
}
