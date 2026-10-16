"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { monthLabel, shiftMonthKey } from "@/lib/finance";

interface MonthSelectorProps {
  monthKey: string;
  isCurrentMonth: boolean;
  /** Rota base da navegação; padrão `/historico` (dashboard usa `/`). */
  basePath?: string;
  /**
   * Intervalo da janela exibida (ex.: `15/09 a 14/10`), mostrado abaixo do
   * rótulo do mês para explicitar a moldura do ciclo.
   */
  rangeLabel?: string;
}

export interface MonthSelectorViewProps {
  monthKey: string;
  isCurrentMonth: boolean;
  isPending: boolean;
  rangeLabel?: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelectMonth: (monthKey: string) => void;
}

const buttonClass =
  "rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium text-foreground-muted transition hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-raised";

/**
 * Apresentação pura do seletor de mês (sem hooks/roteador), para o teste rodar
 * com `renderToStaticMarkup`. Os controles ficam desabilitados em `isPending` e
 * o rótulo mostra sempre o mês **selecionado**.
 */
export function MonthSelectorView({
  monthKey,
  isCurrentMonth,
  isPending,
  rangeLabel,
  onPrevious,
  onNext,
  onSelectMonth,
}: MonthSelectorViewProps) {
  const previous = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={onPrevious}
        aria-label={`Mês anterior: ${monthLabel(previous)}`}
        className={buttonClass}
      >
        <span aria-hidden="true">←</span> Mês anterior
      </button>

      <div className="min-w-[10rem] text-center">
        <p
          aria-live="polite"
          className="text-lg font-semibold text-foreground"
        >
          {monthLabel(monthKey)}
        </p>
        {rangeLabel && (
          <p className="text-xs font-medium text-subtle">{rangeLabel}</p>
        )}
      </div>

      <input
        type="month"
        value={monthKey}
        disabled={isPending}
        onChange={(event) => onSelectMonth(event.target.value)}
        aria-label="Selecionar mês"
        className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium text-foreground-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      />

      <button
        type="button"
        disabled={isPending || isCurrentMonth}
        onClick={onNext}
        aria-label={`Próximo mês: ${monthLabel(next)}`}
        className={buttonClass}
      >
        Próximo mês <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

export default function MonthSelector({
  monthKey,
  isCurrentMonth,
  basePath = "/historico",
  rangeLabel,
}: MonthSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(target: string) {
    if (!target || target === monthKey) return;
    startTransition(() => {
      router.push(`${basePath}?mes=${target}`);
    });
  }

  return (
    <MonthSelectorView
      monthKey={monthKey}
      isCurrentMonth={isCurrentMonth}
      isPending={isPending}
      rangeLabel={rangeLabel}
      onPrevious={() => navigate(shiftMonthKey(monthKey, -1))}
      onNext={() => navigate(shiftMonthKey(monthKey, 1))}
      onSelectMonth={navigate}
    />
  );
}
