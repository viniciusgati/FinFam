import type { Metadata } from "next";
import HistoryView from "@/components/HistoryView";
import MonthSelector from "@/components/MonthSelector";
import { monthKey } from "@/lib/finance";
import { historyView } from "@/lib/history";
import { loadMonthHistory } from "@/lib/history-data";
import { resolveReferenceDate } from "@/lib/invoices";

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
  const currentMonthKey = monthKey(new Date());
  const isCurrentMonth = referenceMonthKey >= currentMonthKey;
  const isFutureMonth = referenceMonthKey > currentMonthKey;

  let view;
  try {
    const snapshots = isFutureMonth
      ? []
      : await loadMonthHistory(referenceDate);
    view = historyView({
      dbError: false,
      isFutureMonth,
      referenceMonthKey,
      snapshots,
    });
  } catch {
    view = historyView({
      dbError: true,
      isFutureMonth: false,
      referenceMonthKey,
      snapshots: [],
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <MonthSelector
        monthKey={referenceMonthKey}
        isCurrentMonth={isCurrentMonth}
      />

      <HistoryView view={view} />
    </div>
  );
}
