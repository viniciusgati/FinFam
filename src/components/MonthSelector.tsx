"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { monthLabel, shiftMonthKey } from "@/lib/finance";

interface MonthSelectorProps {
  monthKey: string;
  isCurrentMonth: boolean;
}

const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

export default function MonthSelector({
  monthKey,
  isCurrentMonth,
}: MonthSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const previous = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);

  function navigate(target: string) {
    if (!target || target === monthKey) return;
    startTransition(() => {
      router.push(`/historico?mes=${target}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => navigate(previous)}
        aria-label={`Mês anterior: ${monthLabel(previous)}`}
        className={buttonClass}
      >
        <span aria-hidden="true">←</span> Mês anterior
      </button>

      <p
        aria-live="polite"
        className="min-w-[10rem] text-center text-lg font-semibold text-slate-900"
      >
        {monthLabel(monthKey)}
      </p>

      <input
        type="month"
        value={monthKey}
        disabled={isPending}
        onChange={(event) => navigate(event.target.value)}
        aria-label="Selecionar mês"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      />

      <button
        type="button"
        disabled={isPending || isCurrentMonth}
        onClick={() => navigate(next)}
        aria-label={`Próximo mês: ${monthLabel(next)}`}
        className={buttonClass}
      >
        Próximo mês <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
